"""Unified storage layer for Code Intelligence Platform."""

from __future__ import annotations
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

import pyarrow as pa
import pyarrow.parquet as pq

import json
from code_intel.schema import init_database
from code_intel_interfaces.analyzer import AnalysisTask, TaskStatus


# TODO (ISSUE 011): Consider connection pooling for performance
@dataclass
class Storage:
    """Unified storage access for a repository."""
    
    db_path: Path
    parquet_dir: Path
    _conn: sqlite3.Connection | None = field(default=None, repr=False)
    _transaction_depth: int = field(default=0, repr=False)
    
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
        if self._transaction_depth > 0:
            self._transaction_depth += 1
            try:
                yield self.conn
            finally:
                self._transaction_depth -= 1
            return

        self._transaction_depth = 1
        self.conn.execute("BEGIN IMMEDIATE")
        try:
            yield self.conn
            self.conn.commit()
        except Exception:
            self.conn.rollback()
            raise
        finally:
            self._transaction_depth = 0

    def _commit_if_needed(self) -> None:
        if self._transaction_depth == 0:
            self.conn.commit()

    @staticmethod
    def _loads_json(value: str | None, fallback):
        if not value:
            return fallback
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return fallback
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TASK OPERATIONS (Analysis task tracking)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def create_task(self, task: AnalysisTask, config_id: str | None = None) -> None:
        """Record a new analysis task."""
        self.conn.execute("""
            INSERT INTO analysis_tasks 
            (task_id, analyzer_type, state, config_json, config_id, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (
            task.task_id,
            task.analyzer_type,
            TaskStatus.PENDING.value,
            json.dumps(task.config),
            config_id,
        ))
        self._commit_if_needed()
    
    def get_latest_task(self, analyzer_type: str) -> dict | None:
        """Get the latest task for an analyzer type."""
        row = self.conn.execute("""
            SELECT task_id, analyzer_type, state, progress, stage, config_id,
                   entity_count, relationship_count, metrics_json, 
                   started_at, finished_at, error, created_at
            FROM analysis_tasks 
            WHERE analyzer_type = ?
            ORDER BY created_at DESC
            LIMIT 1
        """, (analyzer_type,)).fetchone()
        
        if not row:
            return None
            
        return {
            "task_id": row[0],
            "analyzer_type": row[1],
            "state": row[2],
            "progress": row[3],
            "stage": row[4],
            "config_id": row[5],
            "entity_count": row[6],
            "relationship_count": row[7],
            "metrics": self._loads_json(row[8], {}),
            "started_at": row[9],
            "finished_at": row[10],
            "error": row[11],
            "created_at": row[12],
        }

    def update_task(self, task_id: str, state: TaskStatus, **kwargs) -> None:
        """Update task status and metrics."""
        allowed_fields = {
            "progress", "stage", "entity_count", "relationship_count", 
            "metrics_json", "started_at", "finished_at", "error"
        }
        
        state_value = state.value if isinstance(state, TaskStatus) else str(state)
        updates = ["state = ?"]
        params = [state_value]
        
        for k, v in kwargs.items():
            if k in allowed_fields:
                updates.append(f"{k} = ?")
                if k == "metrics_json" and not isinstance(v, str):
                    v = json.dumps(v)
                params.append(v)
        
        query = f"UPDATE analysis_tasks SET {', '.join(updates)} WHERE task_id = ?"
        params.append(task_id)
        
        self.conn.execute(query, params)
        self._commit_if_needed()

    def get_task(self, task_id: str) -> dict | None:
        """Get task status."""
        row = self.conn.execute("""
            SELECT task_id, analyzer_type, state, progress, stage, config_id,
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
            "config_id": row[5],
            "entity_count": row[6],
            "relationship_count": row[7],
            "metrics": self._loads_json(row[8], {}),
            "started_at": row[9],
            "finished_at": row[10],
            "error": row[11],
            "created_at": row[12],
        }

    def list_tasks(
        self,
        analyzer_type: str | None = None,
        state: str | None = None,
        limit: int = 100,
    ) -> list[dict]:
        """List analysis tasks."""
        where: list[str] = []
        params: list[object] = []
        if analyzer_type:
            where.append("analyzer_type = ?")
            params.append(analyzer_type)
        if state:
            where.append("state = ?")
            params.append(state)
        where_sql = f"WHERE {' AND '.join(where)}" if where else ""
        rows = self.conn.execute(
            f"""
            SELECT task_id, analyzer_type, state, progress, stage, config_id,
                   entity_count, relationship_count, metrics_json,
                   started_at, finished_at, error, created_at
            FROM analysis_tasks
            {where_sql}
            ORDER BY created_at DESC
            LIMIT ?
            """,
            [*params, limit],
        ).fetchall()
        return [
            {
                "task_id": row[0],
                "analyzer_type": row[1],
                "state": row[2],
                "progress": row[3],
                "stage": row[4],
                "config_id": row[5],
                "entity_count": row[6],
                "relationship_count": row[7],
                "metrics": self._loads_json(row[8], {}),
                "started_at": row[9],
                "finished_at": row[10],
                "error": row[11],
                "created_at": row[12],
            }
            for row in rows
        ]

    # ═══════════════════════════════════════════════════════════════════════════
    # ENTITY OPERATIONS (Files, classes, functions, packages)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def get_or_create_entity(
        self,
        kind: str,
        name: str,
        qualified_name: str | None = None,
        language: str | None = None,
        parent_id: int | None = None,
        metadata_json: dict | None = None
    ) -> int:
        """Get or create an entity, returning entity_id."""
        # Try to find existing entity by qualified_name and kind
        if qualified_name:
            row = self.conn.execute(
                "SELECT entity_id FROM entities WHERE qualified_name = ? AND kind = ?",
                (qualified_name, kind)
            ).fetchone()
            if row:
                return row[0]
        
        # Create new entity
        metadata_str = json.dumps(metadata_json) if metadata_json else None
        cursor = self.conn.execute("""
            INSERT INTO entities (kind, name, qualified_name, language, parent_id, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (kind, name, qualified_name, language, parent_id, metadata_str))
        return cursor.lastrowid
    
    def get_entity(self, entity_id: int) -> dict | None:
        """Get entity by ID."""
        row = self.conn.execute("""
            SELECT entity_id, kind, name, qualified_name, language, parent_id, 
                   exists_at_head, metadata_json, created_at, updated_at
            FROM entities WHERE entity_id = ?
        """, (entity_id,)).fetchone()
        
        if not row:
            return None
        
        return {
            "entity_id": row[0],
            "kind": row[1],
            "name": row[2],
            "qualified_name": row[3],
            "language": row[4],
            "parent_id": row[5],
            "exists_at_head": bool(row[6]),
            "metadata": json.loads(row[7]) if row[7] else {},
            "created_at": row[8],
            "updated_at": row[9]
        }
    
    def get_entity_by_qualified_name(self, qualified_name: str, kind: str | None = None) -> dict | None:
        """Get entity by qualified name."""
        if kind:
            row = self.conn.execute("""
                SELECT entity_id, kind, name, qualified_name, language, parent_id, 
                       exists_at_head, metadata_json, created_at, updated_at
                FROM entities WHERE qualified_name = ? AND kind = ?
            """, (qualified_name, kind)).fetchone()
        else:
            row = self.conn.execute("""
                SELECT entity_id, kind, name, qualified_name, language, parent_id, 
                       exists_at_head, metadata_json, created_at, updated_at
                FROM entities WHERE qualified_name = ?
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
            "exists_at_head": bool(row[6]),
            "metadata": json.loads(row[7]) if row[7] else {},
            "created_at": row[8],
            "updated_at": row[9]
        }
    
    def update_entity_metadata(self, entity_id: int, metadata: dict):
        """Update entity metadata (merges with existing)."""
        current = self.conn.execute(
            "SELECT metadata_json FROM entities WHERE entity_id = ?", 
            (entity_id,)
        ).fetchone()
        
        current_meta = json.loads(current[0]) if current and current[0] else {}
        current_meta.update(metadata)
        
        self.conn.execute(
            "UPDATE entities SET metadata_json = ?, updated_at = CURRENT_TIMESTAMP WHERE entity_id = ?",
            (json.dumps(current_meta), entity_id)
        )
        self._commit_if_needed()
    
    def update_entity_head_status(self, entity_id: int, exists_at_head: bool):
        """Update whether entity exists at HEAD."""
        self.conn.execute(
            "UPDATE entities SET exists_at_head = ?, updated_at = CURRENT_TIMESTAMP WHERE entity_id = ?",
            (exists_at_head, entity_id)
        )
        self._commit_if_needed()
    
    def get_entities_at_head(self, kind: str | None = None) -> list[dict]:
        """Get all entities that exist at HEAD."""
        if kind:
            rows = self.conn.execute("""
                SELECT entity_id, kind, name, qualified_name, metadata_json
                FROM entities
                WHERE exists_at_head = TRUE AND kind = ?
                ORDER BY qualified_name
            """, (kind,)).fetchall()
        else:
            rows = self.conn.execute("""
                SELECT entity_id, kind, name, qualified_name, metadata_json
                FROM entities
                WHERE exists_at_head = TRUE
                ORDER BY qualified_name
            """).fetchall()
        
        return [
            {
                "entity_id": r[0],
                "kind": r[1],
                "name": r[2],
                "qualified_name": r[3],
                "metadata": json.loads(r[4]) if r[4] else {}
            }
            for r in rows
        ]
    
    def update_head_status_bulk(self, kind: str, current_qualified_names: set[str]):
        """Bulk update head status for entities of a specific kind."""
        with self.transaction():
            # Reset all entities of this kind to not at HEAD
            self.conn.execute(
                "UPDATE entities SET exists_at_head = FALSE, updated_at = CURRENT_TIMESTAMP WHERE kind = ?",
                (kind,)
            )

            if not current_qualified_names:
                return

            names = sorted(current_qualified_names)
            chunk_size = 800

            # Mark existing entities in bulk.
            for i in range(0, len(names), chunk_size):
                chunk = names[i : i + chunk_size]
                placeholders = ",".join("?" for _ in chunk)
                self.conn.execute(
                    f"""
                    UPDATE entities
                    SET exists_at_head = TRUE, updated_at = CURRENT_TIMESTAMP
                    WHERE kind = ? AND qualified_name IN ({placeholders})
                    """,
                    [kind, *chunk],
                )

            # Insert missing entities in bulk.
            existing: set[str] = set()
            for i in range(0, len(names), chunk_size):
                chunk = names[i : i + chunk_size]
                placeholders = ",".join("?" for _ in chunk)
                rows = self.conn.execute(
                    f"""
                    SELECT qualified_name
                    FROM entities
                    WHERE kind = ? AND qualified_name IN ({placeholders})
                    """,
                    [kind, *chunk],
                ).fetchall()
                existing.update(str(row[0]) for row in rows if row and row[0])

            missing = [name for name in names if name not in existing]
            if missing:
                self.conn.executemany(
                    """
                    INSERT OR IGNORE INTO entities (
                        kind, name, qualified_name, exists_at_head, metadata_json, created_at, updated_at
                    ) VALUES (?, ?, ?, TRUE, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """,
                    [
                        (
                            kind,
                            name.rsplit("/", 1)[-1],
                            name,
                            json.dumps({"exists_at_head": True}),
                        )
                        for name in missing
                    ],
                )

    # ═══════════════════════════════════════════════════════════════════════════
    # RELATIONSHIP OPERATIONS (Unified edges across all analyzers)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def upsert_relationships(self, relationships: list[dict]):
        """Insert or update relationships."""
        self.conn.executemany("""
            INSERT OR REPLACE INTO relationships (
                source_type, rel_kind, src_entity_id, dst_entity_id, 
                weight, properties_json, run_id
            ) VALUES (
                :source_type, :rel_kind, :src_entity_id, :dst_entity_id,
                :weight, :properties_json, :run_id
            )
        """, relationships)
        self._commit_if_needed()
    
    def get_relationships(
        self,
        entity_id: int | None = None,
        source_type: str | None = None,
        rel_kind: str | None = None,
        min_weight: float = 0.0,
        limit: int = 100
    ) -> list[dict]:
        """Get relationships with filters."""
        conditions = []
        params = []
        
        if entity_id:
            conditions.append("(src_entity_id = ? OR dst_entity_id = ?)")
            params.extend([entity_id, entity_id])
        
        if source_type:
            conditions.append("source_type = ?")
            params.append(source_type)
        
        if rel_kind:
            conditions.append("rel_kind = ?")
            params.append(rel_kind)
        
        conditions.append("weight >= ?")
        params.append(min_weight)
        
        where_clause = " AND ".join(conditions) if conditions else "1=1"
        params.append(limit)
        
        rows = self.conn.execute(f"""
            SELECT 
                rel_id, source_type, rel_kind, src_entity_id, dst_entity_id,
                weight, properties_json, run_id, created_at
            FROM relationships
            WHERE {where_clause}
            ORDER BY weight DESC
            LIMIT ?
        """, params).fetchall()
        
        return [
            {
                "rel_id": r[0],
                "source_type": r[1],
                "rel_kind": r[2],
                "src_entity_id": r[3],
                "dst_entity_id": r[4],
                "weight": r[5],
                "properties": json.loads(r[6]) if r[6] else {},
                "run_id": r[7],
                "created_at": r[8]
            }
            for r in rows
        ]

    # ═══════════════════════════════════════════════════════════════════════════
    # VALIDATION LOG OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════════
    
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
        self._commit_if_needed()
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
        self._commit_if_needed()
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

    # ═══════════════════════════════════════════════════════════════════════════
    # PARQUET OPERATIONS (Bulk time-series data)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def write_parquet(self, name: str, table: pa.Table):
        """Write a Parquet file."""
        path = self.parquet_dir / f"{name}.parquet"
        pq.write_table(table, path, compression="zstd")
    
    def read_parquet(self, name: str) -> pa.Table:
        """Read a Parquet file."""
        path = self.parquet_dir / f"{name}.parquet"
        return pq.read_table(path)
    
    def parquet_exists(self, name: str) -> bool:
        """Check if a Parquet file exists."""
        path = self.parquet_dir / f"{name}.parquet"
        return path.exists()

    # ═══════════════════════════════════════════════════════════════════════════
    # PROJECT SCAN OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _infer_repo_id(self) -> str:
        row = self.conn.execute(
            "SELECT value FROM repo_meta WHERE key = 'repo_id'"
        ).fetchone()
        if row and row[0]:
            return str(row[0])
        raise ValueError("repo_id is not stored in repo_meta")

    def save_project_scan(self, scan_data: dict) -> str:
        """Save one project scan snapshot."""
        repo_id = scan_data.get("repo_id") or self._infer_repo_id()
        first_ts = scan_data.get("first_commit_ts")
        last_ts = scan_data.get("last_commit_ts")
        first_date = scan_data.get("first_commit_date")
        last_date = scan_data.get("last_commit_date")
        if first_ts and not first_date:
            first_date = datetime.fromtimestamp(first_ts, tz=timezone.utc).date().isoformat()
        if last_ts and not last_date:
            last_date = datetime.fromtimestamp(last_ts, tz=timezone.utc).date().isoformat()

        self.conn.execute(
            """
            INSERT INTO project_scan (
                scan_id, repo_id, repo_path, commit_oid, branch_name,
                total_files, total_dirs, commit_count, unique_authors,
                first_commit_ts, last_commit_ts, first_commit_date, last_commit_date,
                extensions_json, languages_json, frameworks_json, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                scan_data["scan_id"],
                repo_id,
                scan_data["repo_path"],
                scan_data.get("commit_oid"),
                scan_data.get("branch_name"),
                int(scan_data.get("total_files", 0)),
                int(scan_data.get("total_dirs", 0)),
                scan_data.get("commit_count", scan_data.get("total_commits")),
                scan_data.get("unique_authors"),
                first_ts,
                last_ts,
                first_date,
                last_date,
                json.dumps(scan_data.get("extensions", {})),
                json.dumps(scan_data.get("languages", {})),
                json.dumps(scan_data.get("frameworks", [])),
                json.dumps(scan_data.get("metadata", {})),
            ),
        )
        self._commit_if_needed()
        return scan_data["scan_id"]

    def get_project_scan(self, scan_id: str) -> dict | None:
        row = self.conn.execute(
            """
            SELECT scan_id, repo_id, repo_path, scanned_at, commit_oid, branch_name,
                   total_files, total_dirs, commit_count, unique_authors,
                   first_commit_ts, last_commit_ts, first_commit_date, last_commit_date,
                   extensions_json, languages_json, frameworks_json, metadata_json
            FROM project_scan
            WHERE scan_id = ?
            """,
            (scan_id,),
        ).fetchone()
        if not row:
            return None
        return {
            "scan_id": row[0],
            "repo_id": row[1],
            "repo_path": row[2],
            "scanned_at": row[3],
            "commit_oid": row[4],
            "branch_name": row[5],
            "total_files": row[6] or 0,
            "total_dirs": row[7] or 0,
            "commit_count": row[8] or 0,
            "total_commits": row[8] or 0,
            "unique_authors": row[9] or 0,
            "first_commit_ts": row[10],
            "last_commit_ts": row[11],
            "first_commit_date": row[12],
            "last_commit_date": row[13],
            "extensions": self._loads_json(row[14], {}),
            "languages": self._loads_json(row[15], {}),
            "frameworks": self._loads_json(row[16], []),
            "metadata": self._loads_json(row[17], {}),
        }

    def get_latest_project_scan(
        self,
        repo_id: str | None = None,
        repo_path: str | None = None,
    ) -> dict | None:
        """Get the latest project scan for a repo."""
        where = ""
        params: list[object] = []
        if repo_id:
            where = "WHERE repo_id = ?"
            params = [repo_id]
        elif repo_path:
            where = "WHERE repo_path = ?"
            params = [repo_path]
        row = self.conn.execute(
            f"""
            SELECT scan_id
            FROM project_scan
            {where}
            ORDER BY scanned_at DESC
            LIMIT 1
            """,
            params,
        ).fetchone()
        if not row:
            return None
        return self.get_project_scan(row[0])

    def replace_project_tree(
        self,
        scan_id: str,
        tree_nodes: list[dict],
        repo_id: str | None = None,
    ) -> None:
        """Replace tree nodes for a scan."""
        resolved_repo_id = repo_id
        if resolved_repo_id is None:
            row = self.conn.execute(
                "SELECT repo_id FROM project_scan WHERE scan_id = ?",
                (scan_id,),
            ).fetchone()
            if not row:
                raise ValueError(f"Unknown scan_id: {scan_id}")
            resolved_repo_id = str(row[0])

        self.conn.execute("DELETE FROM project_tree WHERE scan_id = ?", (scan_id,))
        if tree_nodes:
            self.conn.executemany(
                """
                INSERT INTO project_tree (
                    scan_id, repo_id, path, name, node_type, extension, language,
                    size_bytes, depth, parent_path
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        scan_id,
                        resolved_repo_id,
                        node["path"],
                        node.get("name") or Path(node["path"]).name or node["path"],
                        node["node_type"],
                        node.get("extension"),
                        node.get("language"),
                        node.get("size_bytes"),
                        int(node.get("depth", 0)),
                        node.get("parent_path"),
                    )
                    for node in tree_nodes
                ],
            )
        self._commit_if_needed()

    def fetch_tree_rows_for_preview(
        self,
        repo_id: str,
        max_depth: int | None = None,
    ) -> list[dict]:
        latest = self.get_latest_project_scan(repo_id=repo_id)
        if not latest:
            return []
        params: list[object] = [latest["scan_id"]]
        depth_sql = ""
        if max_depth is not None:
            depth_sql = "AND depth <= ?"
            params.append(max_depth)
        rows = self.conn.execute(
            f"""
            SELECT path, name, node_type, extension, language, size_bytes, depth, parent_path
            FROM project_tree
            WHERE scan_id = ?
            {depth_sql}
            ORDER BY depth ASC, path ASC
            """,
            params,
        ).fetchall()
        return [
            {
                "path": row[0],
                "name": row[1],
                "node_type": row[2],
                "extension": row[3],
                "language": row[4],
                "size_bytes": row[5],
                "depth": row[6],
                "parent_path": row[7],
            }
            for row in rows
        ]

    def browse_project_tree(
        self,
        scan_id: str | None = None,
        parent_path: str | None = None,
        node_type: str | None = None,
        language: str | None = None,
        limit: int = 1000,
        repo_id: str | None = None,
        max_depth: int | None = None,
    ) -> list[dict]:
        """Browse stored project tree rows."""
        resolved_scan_id = scan_id
        if resolved_scan_id is None:
            if not repo_id:
                raise ValueError("Either scan_id or repo_id is required")
            latest = self.get_latest_project_scan(repo_id=repo_id)
            if not latest:
                return []
            resolved_scan_id = latest["scan_id"]

        conditions = ["scan_id = ?"]
        params: list[object] = [resolved_scan_id]
        if parent_path is not None:
            conditions.append("parent_path = ?")
            params.append(parent_path)
        if node_type:
            conditions.append("node_type = ?")
            params.append(node_type)
        if language:
            conditions.append("language = ?")
            params.append(language)
        if max_depth is not None:
            conditions.append("depth <= ?")
            params.append(max_depth)
        params.append(limit)
        where_clause = " AND ".join(conditions)
        rows = self.conn.execute(
            f"""
            SELECT path, name, node_type, extension, language, size_bytes, depth, parent_path
            FROM project_tree
            WHERE {where_clause}
            ORDER BY depth ASC, path ASC
            LIMIT ?
            """,
            params,
        ).fetchall()
        return [
            {
                "path": row[0],
                "name": row[1],
                "node_type": row[2],
                "extension": row[3],
                "language": row[4],
                "size_bytes": row[5],
                "depth": row[6],
                "parent_path": row[7],
            }
            for row in rows
        ]

    # ═══════════════════════════════════════════════════════════════════════════
    # ANALYSIS CONFIG OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _config_row_to_dict(self, row: sqlite3.Row | tuple | None) -> dict | None:
        if not row:
            return None
        return {
            "config_id": row[0],
            "repo_id": row[1],
            "name": row[2],
            "description": row[3] or "",
            "analyzer_type": row[4] or "git",
            "preset_id": row[5],
            "config": self._loads_json(row[6], {}),
            "include_patterns": self._loads_json(row[7], []),
            "exclude_patterns": self._loads_json(row[8], []),
            "is_active": bool(row[9]),
            "is_preset": bool(row[10]),
            "created_at": row[11],
            "updated_at": row[12],
        }

    def create_analysis_config(self, config_data: dict) -> str:
        """Create a project-scoped analysis config record."""
        repo_id = config_data.get("repo_id") or self._infer_repo_id()
        config_id = config_data["config_id"]
        is_active = bool(config_data.get("is_active", False))
        # Activate via set_active_config() to avoid unique active-config conflicts.
        insert_active = 0
        self.conn.execute(
            """
            INSERT INTO analysis_configs (
                config_id, repo_id, name, description, analyzer_type,
                preset_id, config_json, include_patterns, exclude_patterns,
                is_active, is_preset,
                created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            """,
            (
                config_id,
                repo_id,
                config_data.get("name", "Configuration"),
                config_data.get("description", ""),
                config_data.get("analyzer_type", "git"),
                config_data.get("preset_id"),
                json.dumps(config_data.get("config", {})),
                json.dumps(config_data.get("include_patterns", [])),
                json.dumps(config_data.get("exclude_patterns", [])),
                insert_active,
                bool(config_data.get("is_preset", False)),
            ),
        )
        if is_active:
            self.set_active_config(repo_id, config_id)
        self._commit_if_needed()
        return config_id

    def get_analysis_config(self, config_id: str, repo_id: str | None = None) -> dict | None:
        """Get one analysis config."""
        if repo_id:
            row = self.conn.execute(
                """
                SELECT config_id, repo_id, name, description, analyzer_type,
                       preset_id, config_json, include_patterns, exclude_patterns,
                       is_active, is_preset, created_at, updated_at
                FROM analysis_configs
                WHERE config_id = ? AND repo_id = ?
                """,
                (config_id, repo_id),
            ).fetchone()
        else:
            row = self.conn.execute(
                """
                SELECT config_id, repo_id, name, description, analyzer_type,
                       preset_id, config_json, include_patterns, exclude_patterns,
                       is_active, is_preset, created_at, updated_at
                FROM analysis_configs
                WHERE config_id = ?
                """,
                (config_id,),
            ).fetchone()
        return self._config_row_to_dict(row)

    def list_analysis_configs(
        self,
        repo_id: str | None = None,
        analyzer_type: str | None = None,
        is_preset: bool | None = None,
        limit: int = 100,
    ) -> list[dict]:
        """List analysis configs."""
        conditions: list[str] = []
        params: list[object] = []
        if repo_id:
            conditions.append("repo_id = ?")
            params.append(repo_id)
        if analyzer_type:
            conditions.append("analyzer_type = ?")
            params.append(analyzer_type)
        if is_preset is not None:
            conditions.append("is_preset = ?")
            params.append(int(is_preset))
        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        rows = self.conn.execute(
            f"""
            SELECT config_id, repo_id, name, description, analyzer_type,
                   preset_id, config_json, include_patterns, exclude_patterns,
                   is_active, is_preset, created_at, updated_at
            FROM analysis_configs
            {where_clause}
            ORDER BY updated_at DESC, created_at DESC
            LIMIT ?
            """,
            [*params, limit],
        ).fetchall()
        return [self._config_row_to_dict(row) for row in rows if row]

    def update_analysis_config(
        self,
        repo_id: str,
        config_id: str,
        patch: dict,
    ) -> dict | None:
        current = self.get_analysis_config(config_id=config_id, repo_id=repo_id)
        if not current:
            return None
        has_active_patch = "is_active" in patch
        requested_active = bool(patch.get("is_active")) if has_active_patch else bool(current["is_active"])
        # Avoid unique-index violations by only activating through set_active_config().
        persisted_active = False if (has_active_patch and requested_active) else requested_active
        merged = {
            **current,
            "name": patch.get("name", current["name"]),
            "description": patch.get("description", current["description"]),
            "preset_id": patch.get("preset_id", current["preset_id"]),
            "config": patch.get("config", current["config"]),
            "include_patterns": patch.get("include_patterns", current["include_patterns"]),
            "exclude_patterns": patch.get("exclude_patterns", current["exclude_patterns"]),
            "is_active": persisted_active,
        }
        self.conn.execute(
            """
            UPDATE analysis_configs
            SET name = ?, description = ?, preset_id = ?, config_json = ?,
                include_patterns = ?, exclude_patterns = ?, is_active = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE config_id = ? AND repo_id = ?
            """,
            (
                merged["name"],
                merged["description"],
                merged["preset_id"],
                json.dumps(merged["config"]),
                json.dumps(merged["include_patterns"]),
                json.dumps(merged["exclude_patterns"]),
                int(merged["is_active"]),
                config_id,
                repo_id,
            ),
        )
        if has_active_patch and requested_active:
            self.set_active_config(repo_id, config_id)
        self._commit_if_needed()
        return self.get_analysis_config(config_id=config_id, repo_id=repo_id)

    def delete_analysis_config(self, repo_id: str, config_id: str) -> bool:
        cur = self.conn.execute(
            "DELETE FROM analysis_configs WHERE config_id = ? AND repo_id = ?",
            (config_id, repo_id),
        )
        self._commit_if_needed()
        return cur.rowcount > 0

    def set_active_config(self, repo_id: str, config_id: str) -> None:
        """Set one config active for a repo."""
        self.conn.execute(
            "UPDATE analysis_configs SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE repo_id = ?",
            (repo_id,),
        )
        self.conn.execute(
            """
            UPDATE analysis_configs
            SET is_active = 1, updated_at = CURRENT_TIMESTAMP
            WHERE repo_id = ? AND config_id = ?
            """,
            (repo_id, config_id),
        )
        self._commit_if_needed()

    def get_active_config(self, repo_id: str) -> dict | None:
        row = self.conn.execute(
            """
            SELECT config_id, repo_id, name, description, analyzer_type,
                   preset_id, config_json, include_patterns, exclude_patterns,
                   is_active, is_preset, created_at, updated_at
            FROM analysis_configs
            WHERE repo_id = ? AND is_active = 1
            LIMIT 1
            """,
            (repo_id,),
        ).fetchone()
        return self._config_row_to_dict(row)
