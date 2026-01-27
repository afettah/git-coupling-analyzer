"""Unified storage layer for LFCA."""

from __future__ import annotations
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterator, Any

import pyarrow as pa
import pyarrow.parquet as pq

from lfca.schema import init_database


@dataclass
class Storage:
    """Unified storage access for a repository."""
    
    db_path: Path
    parquet_dir: Path
    _conn: sqlite3.Connection | None = field(default=None, repr=False)
    
    def __post_init__(self):
        self.parquet_dir.mkdir(parents=True, exist_ok=True)
    
    @property
    def conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = init_database(self.db_path)
        return self._conn
    
    def close(self):
        if self._conn:
            self._conn.close()
            self._conn = None
    
    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        self.conn.execute("BEGIN IMMEDIATE")
        try:
            yield self.conn
            self.conn.commit()
        except Exception:
            self.conn.rollback()
            raise
    
    # === File Operations ===
    
    def get_or_create_file(self, path: str) -> int:
        """Get file_id for path, creating if needed."""
        row = self.conn.execute(
            "SELECT file_id FROM files WHERE path_current = ? OR path_latest = ?",
            (path, path)
        ).fetchone()
        if row:
            return row[0]
        
        cursor = self.conn.execute(
            "INSERT INTO files (path_current, path_latest) VALUES (?, ?)",
            (path, path)
        )
        return cursor.lastrowid
    
    def get_file_by_path(self, path: str) -> dict | None:
        """Get file info by current or latest path."""
        row = self.conn.execute("""
            SELECT file_id, path_current, path_latest, exists_at_head, total_commits
            FROM files 
            WHERE path_current = ? OR path_latest = ?
            LIMIT 1
        """, (path, path)).fetchone()
        
        if not row:
            return None
        return {
            "file_id": row[0],
            "path_current": row[1],
            "path_latest": row[2],
            "exists_at_head": bool(row[3]),
            "total_commits": row[4]
        }
    
    def get_current_files(self) -> list[dict]:
        """Get all files that exist at HEAD."""
        rows = self.conn.execute("""
            SELECT file_id, path_current, total_commits
            FROM files
            WHERE exists_at_head = TRUE AND path_current IS NOT NULL
            ORDER BY path_current
        """).fetchall()
        
        return [
            {"file_id": r[0], "path": r[1], "total_commits": r[2]}
            for r in rows
        ]
    
    def update_head_status(self, current_paths: set[str]):
        """Mark which files exist at HEAD."""
        with self.transaction():
            # Reset all to not at HEAD
            self.conn.execute("UPDATE files SET exists_at_head = FALSE")
            
            # Mark current files
            for path in current_paths:
                self.conn.execute("""
                    UPDATE files SET exists_at_head = TRUE, path_current = ?
                    WHERE path_current = ? OR path_latest = ?
                """, (path, path, path))
    
    # === Edge Operations ===
    
    def upsert_edges(self, edges: list[dict]):
        """Insert or update coupling edges."""
        self.conn.executemany("""
            INSERT OR REPLACE INTO edges (
                src_file_id, dst_file_id, pair_count,
                src_count, dst_count, src_weight, dst_weight,
                jaccard, jaccard_weighted, p_dst_given_src, p_src_given_dst
            ) VALUES (
                :src_file_id, :dst_file_id, :pair_count,
                :src_count, :dst_count, :src_weight, :dst_weight,
                :jaccard, :jaccard_weighted, :p_dst_given_src, :p_src_given_dst
            )
        """, edges)
        self.conn.commit()
    
    def get_edges_for_file(
        self, 
        file_id: int, 
        metric: str = "jaccard",
        min_weight: float = 0.0,
        limit: int = 50,
        current_only: bool = True
    ) -> list[dict]:
        """Get coupled files for a given file."""
        
        filter_clause = "AND f.exists_at_head = TRUE" if current_only else ""
        
        query = f"""
            SELECT 
                e.dst_file_id as coupled_file_id,
                f.path_current as coupled_path,
                e.pair_count,
                e.jaccard,
                e.jaccard_weighted,
                e.p_dst_given_src,
                e.p_src_given_dst
            FROM edges e
            JOIN files f ON e.dst_file_id = f.file_id
            WHERE e.src_file_id = ? 
              AND e.{metric} >= ?
              {filter_clause}
            
            UNION ALL
            
            SELECT 
                e.src_file_id as coupled_file_id,
                f.path_current as coupled_path,
                e.pair_count,
                e.jaccard,
                e.jaccard_weighted,
                e.p_src_given_dst as p_dst_given_src,
                e.p_dst_given_src as p_src_given_dst
            FROM edges e
            JOIN files f ON e.src_file_id = f.file_id
            WHERE e.dst_file_id = ?
              AND e.{metric} >= ?
              {filter_clause}
            
            ORDER BY {metric} DESC
            LIMIT ?
        """
        
        rows = self.conn.execute(
            query, (file_id, min_weight, file_id, min_weight, limit)
        ).fetchall()
        
        return [
            {
                "file_id": r[0],
                "path": r[1],
                "pair_count": r[2],
                "jaccard": r[3],
                "jaccard_weighted": r[4],
                "p_dst_given_src": r[5],
                "p_src_given_dst": r[6]
            }
            for r in rows
        ]
    
    # === Parquet Operations (for bulk time-series data) ===
    
    def write_parquet(self, name: str, table: pa.Table):
        """Write a Parquet file."""
        path = self.parquet_dir / f"{name}.parquet"
        pq.write_table(table, path, compression="zstd")
    
    def read_parquet(self, name: str) -> pa.Table:
        """Read a Parquet file."""
        path = self.parquet_dir / f"{name}.parquet"
        return pq.read_table(path)
