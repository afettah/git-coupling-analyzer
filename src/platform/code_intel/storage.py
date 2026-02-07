"""Unified storage layer for LFCA."""

from __future__ import annotations
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterator, Any

import pyarrow as pa
import pyarrow.parquet as pq

import json
from code_intel.schema import init_database
from code_intel_interfaces.analyzer import AnalysisTask, TaskResult, TaskStatus


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
    
    # === Task Operations ===
    
    def create_task(self, task: AnalysisTask) -> None:
        """Record a new analysis task."""
        self.conn.execute("""
            INSERT INTO analysis_tasks 
            (task_id, analyzer_type, state, config_json, created_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (task.task_id, task.analyzer_type, TaskStatus.PENDING, json.dumps(task.config)))
        self.conn.commit()

    def update_task(self, task_id: str, state: TaskStatus, **kwargs) -> None:
        """Update task status and metrics."""
        allowed_fields = {
            "progress", "stage", "entity_count", "relationship_count", 
            "metrics_json", "started_at", "finished_at", "error"
        }
        
        updates = ["state = ?"]
        params = [state.value]
        
        for k, v in kwargs.items():
            if k in allowed_fields:
                updates.append(f"{k} = ?")
                if k == "metrics_json" and not isinstance(v, str):
                    v = json.dumps(v)
                params.append(v)
        
        query = f"UPDATE analysis_tasks SET {', '.join(updates)} WHERE task_id = ?"
        params.append(task_id)
        
        self.conn.execute(query, params)
        self.conn.commit()

    def get_task(self, task_id: str) -> dict | None:
        """Get task status."""
        row = self.conn.execute("""
            SELECT task_id, analyzer_type, state, progress, stage, 
                   entity_count, relationship_count, metrics_json, 
                   started_at, finished_at, error, created_at
            FROM analysis_tasks WHERE task_id = ?
        """, (task_id,)).fetchone()
        
        if not row:
            return None
            
        return {
            "task_id": row[0],
            "analyzer_type": row[1],
            "state": row[2],
            "progress": row[3],
            "stage": row[4],
            "entity_count": row[5],
            "relationship_count": row[6],
            "metrics": json.loads(row[7]) if row[7] else {},
            "started_at": row[8],
            "finished_at": row[9],
            "error": row[10],
            "created_at": row[11]
        }

    def get_latest_task(self, analyzer_type: str | None = None) -> dict | None:
        """Get the latest task, optionally filtered by type."""
        query = "SELECT task_id FROM analysis_tasks"
        params = []
        if analyzer_type:
            query += " WHERE analyzer_type = ?"
            params.append(analyzer_type)
        query += " ORDER BY created_at DESC LIMIT 1"
        
        row = self.conn.execute(query, params).fetchone()
        if not row:
            return None
        return self.get_task(row[0])

    # === Unified Entity Operations ===
    
    def get_or_create_entity(
        self, 
        kind: str, 
        name: str, 
        qualified_name: str | None = None,
        language: str | None = None,
        parent_id: int | None = None,
        metadata_json: dict | None = None
    ) -> int:
        """Get entity_id for qualified_name, creating if needed."""
        if qualified_name:
            row = self.conn.execute(
                "SELECT entity_id FROM entities WHERE qualified_name = ?",
                (qualified_name,)
            ).fetchone()
            if row:
                return row[0]
        
        cursor = self.conn.execute("""
            INSERT INTO entities (kind, name, qualified_name, language, parent_id, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (kind, name, qualified_name, language, parent_id, json.dumps(metadata_json) if metadata_json else None))
        return cursor.lastrowid

    def get_entity_by_qualified_name(self, qualified_name: str) -> dict | None:
        """Get entity info by qualified name."""
        row = self.conn.execute("""
            SELECT entity_id, kind, name, qualified_name, language, parent_id, metadata_json
            FROM entities 
            WHERE qualified_name = ?
            LIMIT 1
        """, (qualified_name,)).fetchone()
        
        if not row:
            return None
        return {
            "entity_id": row[0],
            "kind": row[1],
            "name": row[2],
            "qualified_name": row[3],
            "language": row[4],
            "parent_id": row[5],
            "metadata": json.loads(row[6]) if row[6] else {}
        }

    # === Unified Relationship Operations ===
    
    def upsert_relationships(self, relationships: list[dict]):
        """Batch insert or update relationships."""
        if not relationships:
            return
            
        data = [
            (
                r["source_type"],
                r["rel_kind"],
                r["src_entity_id"],
                r["dst_entity_id"],
                r.get("weight", 1.0),
                json.dumps(r.get("properties", {})),
                r.get("run_id")
            )
            for r in relationships
        ]
        
        self.conn.executemany("""
            INSERT INTO relationships (
                source_type, rel_kind, src_entity_id, dst_entity_id, 
                weight, properties_json, run_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, data)
        self.conn.commit()

    # === File Operations ===
    # DEPRECATED: use entity methods instead
    
    def get_current_files(self) -> list[dict]:
        """Get all entities that exist at HEAD."""
        rows = self.conn.execute("""
            SELECT entity_id, qualified_name, metadata_json
            FROM entities
            WHERE exists_at_head = TRUE AND kind = 'file'
            ORDER BY qualified_name
        """).fetchall()
        
        results = []
        for r in rows:
            meta = json.loads(r[2]) if r[2] else {}
            results.append({
                "file_id": r[0], 
                "path": r[1], 
                "total_commits": meta.get("total_commits", 0)
            })
        return results
    
    def get_current_files_with_stats(self) -> list[dict]:
        """Get all files at HEAD with coupling stats and details."""
        import pyarrow.dataset as ds
        from datetime import datetime
        
        # Get basic entity info
        rows = self.conn.execute("""
            SELECT 
                entity_id, 
                qualified_name, 
                metadata_json
            FROM entities
            WHERE exists_at_head = TRUE AND kind = 'file'
            ORDER BY qualified_name
        """).fetchall()
        
        # Build entity_id lookup
        file_ids = {r[0] for r in rows}
        
        # Get coupling stats per entity
        coupling_stats = {}
        for file_id in file_ids:
            coupling_row = self.conn.execute("""
                SELECT 
                    COUNT(*) as coupled_count,
                    MAX(weight) as max_coupling,
                    AVG(weight) as avg_coupling,
                    SUM(CASE WHEN weight > 0.5 THEN 1 ELSE 0 END) as strong_coupling_count
                FROM (
                    SELECT weight FROM relationships WHERE src_entity_id = ? AND source_type = 'git'
                    UNION ALL
                    SELECT weight FROM relationships WHERE dst_entity_id = ? AND source_type = 'git'
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
            meta = json.loads(r[2]) if r[2] else {}
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
                "total_commits": meta.get("total_commits", 0),
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
        """Mark which entities exist at HEAD."""
        with self.transaction():
            # Reset all to not at HEAD
            self.conn.execute("UPDATE entities SET exists_at_head = FALSE WHERE kind = 'file'")
            
            # Mark current files
            for path in current_paths:
                self.conn.execute("""
                    UPDATE entities SET exists_at_head = TRUE
                    WHERE qualified_name = ? AND kind = 'file'
                """, (path,))
    
    # === Edge Operations ===
    # DEPRECATED: use relationship methods instead
    
    # === Parquet Operations (for bulk time-series data) ===
    
    def write_parquet(self, name: str, table: pa.Table):
        """Write a Parquet file."""
        path = self.parquet_dir / f"{name}.parquet"
        pq.write_table(table, path, compression="zstd")
    
    def read_parquet(self, name: str) -> pa.Table:
        """Read a Parquet file."""
        path = self.parquet_dir / f"{name}.parquet"
        return pq.read_table(path)
