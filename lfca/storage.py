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
    
    def get_current_files_with_stats(self) -> list[dict]:
        """Get all files at HEAD with coupling stats and details."""
        import pyarrow.dataset as ds
        from datetime import datetime
        
        # Get basic file info
        rows = self.conn.execute("""
            SELECT 
                f.file_id, 
                f.path_current, 
                f.total_commits,
                f.first_commit_oid,
                f.last_commit_oid
            FROM files f
            WHERE f.exists_at_head = TRUE AND f.path_current IS NOT NULL
            ORDER BY f.path_current
        """).fetchall()
        
        # Build file_id lookup
        file_ids = {r[0] for r in rows}
        
        # Get coupling stats per file
        coupling_stats = {}
        for file_id in file_ids:
            coupling_row = self.conn.execute("""
                SELECT 
                    COUNT(*) as coupled_count,
                    MAX(jaccard) as max_coupling,
                    AVG(jaccard) as avg_coupling,
                    SUM(CASE WHEN jaccard > 0.5 THEN 1 ELSE 0 END) as strong_coupling_count
                FROM (
                    SELECT jaccard FROM edges WHERE src_file_id = ?
                    UNION ALL
                    SELECT jaccard FROM edges WHERE dst_file_id = ?
                )
            """, (file_id, file_id)).fetchone()
            coupling_stats[file_id] = coupling_row
        
        # Get additional stats from parquet if available
        changes_path = self.parquet_dir / "changes.parquet"
        commits_path = self.parquet_dir / "commits.parquet"
        
        file_changes_stats = {}
        file_last_modified = {}
        file_authors = {}
        
        if changes_path.exists() and commits_path.exists():
            try:
                # Load changes and commits data
                changes_ds = ds.dataset(changes_path)
                commits_ds = ds.dataset(commits_path)
                
                changes_table = changes_ds.to_table()
                commits_table = commits_ds.to_table()
                
                changes = changes_table.to_pylist()
                commits_lookup = {c["commit_oid"]: c for c in commits_table.to_pylist()}
                
                # Calculate per-file stats
                for change in changes:
                    fid = change["file_id"]
                    if fid not in file_ids:
                        continue
                        
                    commit_info = commits_lookup.get(change["commit_oid"], {})
                    author = commit_info.get("author_name", "Unknown")
                    commit_ts = change.get("commit_ts") or commit_info.get("authored_ts")
                    
                    if fid not in file_changes_stats:
                        file_changes_stats[fid] = {"lines_added": 0, "lines_deleted": 0}
                    
                    # Track lines if available (may not be in older data)
                    file_changes_stats[fid]["lines_added"] += change.get("lines_added", 0) or 0
                    file_changes_stats[fid]["lines_deleted"] += change.get("lines_deleted", 0) or 0
                    
                    # Track last modified
                    if commit_ts:
                        ts = commit_ts.as_py() if hasattr(commit_ts, 'as_py') else commit_ts
                        if fid not in file_last_modified or ts > file_last_modified[fid]["ts"]:
                            file_last_modified[fid] = {"ts": ts, "author": author}
                    
                    # Track unique authors
                    if fid not in file_authors:
                        file_authors[fid] = set()
                    file_authors[fid].add(author)
                    
            except Exception as e:
                # If parquet read fails, continue with basic stats
                pass
        
        files = []
        for r in rows:
            file_id = r[0]
            coupling_row = coupling_stats.get(file_id, (0, 0, 0, 0))
            changes_stat = file_changes_stats.get(file_id, {})
            last_mod = file_last_modified.get(file_id, {})
            authors = file_authors.get(file_id, set())
            
            # Format last modified timestamp
            last_modified_str = None
            if last_mod.get("ts"):
                ts = last_mod["ts"]
                if isinstance(ts, datetime):
                    last_modified_str = ts.isoformat()
                elif hasattr(ts, 'isoformat'):
                    last_modified_str = ts.isoformat()
            
            files.append({
                "file_id": file_id,
                "path": r[1],
                "total_commits": r[2] or 0,
                "first_commit_oid": r[3],
                "last_commit_oid": r[4],
                "coupled_count": coupling_row[0] if coupling_row else 0,
                "max_coupling": round(coupling_row[1], 3) if coupling_row and coupling_row[1] else 0,
                "avg_coupling": round(coupling_row[2], 3) if coupling_row and coupling_row[2] else 0,
                "strong_coupling_count": coupling_row[3] if coupling_row else 0,
                "lines_added": changes_stat.get("lines_added", 0),
                "lines_deleted": changes_stat.get("lines_deleted", 0),
                "last_modified": last_modified_str,
                "last_author": last_mod.get("author"),
                "authors": len(authors),
            })
        
        return files
    
    # === Validation Log Operations ===
    
    def record_validation_issue(
        self,
        run_id: str,
        issue_type: str,
        severity: str,
        message: str,
        commit_oid: str | None = None,
        token_value: str | None = None,
        expected_value: str | None = None,
        author: str | None = None,
        committed_at: int | None = None,
        subject: str | None = None,
        cursor_position: int | None = None,
    ) -> int:
        """Record a validation issue to the log."""
        cursor = self.conn.execute("""
            INSERT INTO validation_log 
            (run_id, commit_oid, issue_type, severity, token_value, expected_value, 
             message, author, committed_at, subject, cursor_position)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (run_id, commit_oid, issue_type, severity, token_value, expected_value,
              message, author, committed_at, subject, cursor_position))
        return cursor.lastrowid
    
    def record_validation_issues_batch(
        self,
        run_id: str,
        issues: list,
    ) -> int:
        """Record multiple validation issues efficiently."""
        if not issues:
            return 0
        
        data = [
            (run_id, i.commit_oid, i.issue_type, i.severity, i.token_value,
             i.expected_value, i.message, i.author, i.committed_at, i.subject,
             i.cursor_position)
            for i in issues
        ]
        
        self.conn.executemany("""
            INSERT INTO validation_log 
            (run_id, commit_oid, issue_type, severity, token_value, expected_value,
             message, author, committed_at, subject, cursor_position)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, data)
        return len(data)
    
    def get_validation_stats(self, run_id: str) -> dict:
        """Get validation statistics for a run."""
        row = self.conn.execute("""
            SELECT 
                COUNT(*) as total_issues,
                SUM(CASE WHEN severity = 'warning' THEN 1 ELSE 0 END) as warnings,
                SUM(CASE WHEN severity = 'error' THEN 1 ELSE 0 END) as errors,
                SUM(CASE WHEN issue_type = 'invalid_status' THEN 1 ELSE 0 END) as invalid_status,
                SUM(CASE WHEN issue_type = 'invalid_path' THEN 1 ELSE 0 END) as invalid_path,
                SUM(CASE WHEN issue_type = 'incomplete_change' THEN 1 ELSE 0 END) as incomplete_change
            FROM validation_log
            WHERE run_id = ?
        """, (run_id,)).fetchone()
        
        return {
            "total_issues": row[0] or 0,
            "warnings": row[1] or 0,
            "errors": row[2] or 0,
            "invalid_status": row[3] or 0,
            "invalid_path": row[4] or 0,
            "incomplete_change": row[5] or 0,
        }
    
    def query_validation_log(
        self,
        run_id: str,
        issue_type: str | None = None,
        severity: str | None = None,
        limit: int = 100,
        offset: int = 0
    ) -> list[dict]:
        """Query validation log with filters."""
        conditions = ["run_id = ?"]
        params = [run_id]
        
        if issue_type:
            conditions.append("issue_type = ?")
            params.append(issue_type)
        
        if severity:
            conditions.append("severity = ?")
            params.append(severity)
        
        where_clause = " AND ".join(conditions)
        params.extend([limit, offset])
        
        rows = self.conn.execute(f"""
            SELECT 
                id, commit_oid, issue_type, severity,
                token_value, expected_value, message,
                author, committed_at, subject, cursor_position,
                created_at
            FROM validation_log
            WHERE {where_clause}
            ORDER BY id DESC
            LIMIT ? OFFSET ?
        """, params).fetchall()
        
        return [
            {
                "id": r[0],
                "commit_oid": r[1],
                "issue_type": r[2],
                "severity": r[3],
                "token_value": r[4],
                "expected_value": r[5],
                "message": r[6],
                "author": r[7],
                "committed_at": r[8],
                "subject": r[9],
                "cursor_position": r[10],
                "created_at": r[11],
            }
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
                e.p_src_given_dst,
                e.src_count,
                e.dst_count
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
                e.p_dst_given_src as p_src_given_dst,
                e.dst_count as src_count,
                e.src_count as dst_count
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
                "p_src_given_dst": r[6],
                "src_count": r[7],
                "dst_count": r[8]
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
