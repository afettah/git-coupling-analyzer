# LFCA Implementation Plan

> **Version**: 1.0  
> **Date**: 2026-01-27  
> **Status**: Ready for Implementation

---

## Overview

This document provides step-by-step implementation details for improving the LFCA system. Each section includes:
- Files to modify/create
- Detailed changes
- Pseudo code

---

## Table of Contents

1. [Storage Layer Redesign](#1-storage-layer-redesign) ✅ **DONE**
2. [Current File Structure Fix](#2-current-file-structure-fix) ✅ **DONE**
3. [Git Extraction Improvements](#3-git-extraction-improvements) ✅ **DONE**
4. [Coupling Configuration](#4-coupling-configuration) ✅ **DONE**
5. [Query API Expansion](#5-query-api-expansion) ✅ **DONE**
6. [Advanced Clustering](#6-advanced-clustering) ✅ **DONE**
7. [Run Management](#7-run-management) ✅ **DONE**
8. [Frontend Updates](#8-frontend-updates) ✅ **DONE**

---

## 1. Storage Layer Redesign ✅ DONE

### Decision: Hybrid Storage (SQLite + Parquet)

After analysis, **keep Parquet for bulk data** but **use SQLite for graph queries**:

| Data Type | Storage | Reason |
|-----------|---------|--------|
| Commits metadata | Parquet | Bulk reads, columnar scans |
| File changes | Parquet | Time-series, partitioned |
| File index | SQLite | Lookups, JOINs |
| **Edges/Coupling** | **SQLite** | Graph queries, filtering |
| Clusters | SQLite | Relational queries |
| Current files | SQLite | Fast tree queries |

### 1.1 Create New Database Schema

**File: `lfca/schema.py`** (NEW)

```python
"""Database schema definitions for LFCA."""

SCHEMA_VERSION = 2

TABLES = """
-- File identity and current state
CREATE TABLE IF NOT EXISTS files (
    file_id INTEGER PRIMARY KEY AUTOINCREMENT,
    path_current TEXT,                    -- Current path (may be NULL if deleted)
    path_latest TEXT NOT NULL,            -- Most recent known path
    exists_at_head BOOLEAN DEFAULT FALSE, -- True if file exists at HEAD
    first_commit_oid TEXT,
    last_commit_oid TEXT,
    total_commits INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_files_path_current ON files(path_current) WHERE path_current IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_exists ON files(exists_at_head);
CREATE INDEX IF NOT EXISTS idx_files_path_latest ON files(path_latest);

-- File path history (renames)
CREATE TABLE IF NOT EXISTS file_lineage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL REFERENCES files(file_id),
    path TEXT NOT NULL,
    start_commit_oid TEXT NOT NULL,
    end_commit_oid TEXT,
    UNIQUE(file_id, path, start_commit_oid)
);

CREATE INDEX IF NOT EXISTS idx_lineage_file ON file_lineage(file_id);

-- Coupling edges (replaces Parquet edges)
CREATE TABLE IF NOT EXISTS edges (
    src_file_id INTEGER NOT NULL REFERENCES files(file_id),
    dst_file_id INTEGER NOT NULL REFERENCES files(file_id),
    pair_count REAL NOT NULL,
    src_count INTEGER NOT NULL,
    dst_count INTEGER NOT NULL,
    src_weight REAL NOT NULL,
    dst_weight REAL NOT NULL,
    jaccard REAL NOT NULL,
    jaccard_weighted REAL NOT NULL,
    p_dst_given_src REAL NOT NULL,
    p_src_given_dst REAL NOT NULL,
    PRIMARY KEY (src_file_id, dst_file_id)
);

CREATE INDEX IF NOT EXISTS idx_edges_src ON edges(src_file_id);
CREATE INDEX IF NOT EXISTS idx_edges_dst ON edges(dst_file_id);
CREATE INDEX IF NOT EXISTS idx_edges_jaccard ON edges(jaccard DESC);

-- Component/folder level edges
CREATE TABLE IF NOT EXISTS component_edges (
    src_component TEXT NOT NULL,
    dst_component TEXT NOT NULL,
    depth INTEGER NOT NULL,
    pair_count REAL NOT NULL,
    jaccard REAL NOT NULL,
    file_pair_count INTEGER NOT NULL,
    PRIMARY KEY (src_component, dst_component, depth)
);

CREATE INDEX IF NOT EXISTS idx_comp_edges_src ON component_edges(src_component, depth);

-- Clusters
CREATE TABLE IF NOT EXISTS clusters (
    cluster_run_id TEXT NOT NULL,
    cluster_id INTEGER NOT NULL,
    file_id INTEGER NOT NULL REFERENCES files(file_id),
    PRIMARY KEY (cluster_run_id, cluster_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_clusters_run ON clusters(cluster_run_id);
CREATE INDEX IF NOT EXISTS idx_clusters_file ON clusters(file_id);

-- Cluster metadata
CREATE TABLE IF NOT EXISTS cluster_runs (
    cluster_run_id TEXT PRIMARY KEY,
    analysis_run_id TEXT NOT NULL,
    algorithm TEXT NOT NULL,
    parameters_json TEXT,
    cluster_count INTEGER,
    modularity REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    state TEXT DEFAULT 'pending'
);

-- Analysis runs
CREATE TABLE IF NOT EXISTS analysis_runs (
    run_id TEXT PRIMARY KEY,
    state TEXT NOT NULL DEFAULT 'pending',
    config_json TEXT,
    git_head_oid TEXT,
    commit_count INTEGER DEFAULT 0,
    file_count INTEGER DEFAULT 0,
    edge_count INTEGER DEFAULT 0,
    started_at TEXT,
    finished_at TEXT,
    error TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_info (
    key TEXT PRIMARY KEY,
    value TEXT
);
"""

def init_database(db_path: Path) -> sqlite3.Connection:
    """Initialize database with schema."""
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.executescript(TABLES)
    conn.execute(
        "INSERT OR REPLACE INTO schema_info (key, value) VALUES ('version', ?)",
        (str(SCHEMA_VERSION),)
    )
    conn.commit()
    return conn
```

### 1.2 Update Storage Module

**File: `lfca/storage.py`** (REPLACE)

```python
"""Unified storage layer for LFCA."""

from __future__ import annotations
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
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
    _conn: sqlite3.Connection | None = None
    
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
```

### 1.3 Update Config

**File: `lfca/config.py`** (REPLACE)

```python
"""Configuration and path management."""

from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class RepoPaths:
    data_dir: Path
    repo_id: str

    @property
    def repo_root(self) -> Path:
        return self.data_dir / "repos" / self.repo_id

    @property
    def mirror_path(self) -> Path:
        return self.repo_root / "mirror.git"

    @property
    def db_path(self) -> Path:
        return self.repo_root / "lfca.sqlite"

    @property
    def parquet_dir(self) -> Path:
        return self.repo_root / "parquet"

    @property
    def logs_dir(self) -> Path:
        return self.repo_root / "logs"

    def ensure_dirs(self) -> None:
        self.repo_root.mkdir(parents=True, exist_ok=True)
        self.parquet_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)


@dataclass
class CouplingConfig:
    """Global coupling analysis configuration."""
    
    # Commit-level filters
    min_revisions: int = 5
    max_changeset_size: int = 50
    
    # Changeset grouping
    changeset_mode: str = "by_commit"  # by_commit | by_author_time | by_ticket_id
    author_time_window_hours: int = 24
    ticket_id_pattern: str | None = None
    
    # Logical changeset filters
    max_logical_changeset_size: int = 100
    
    # File-level thresholds
    min_cooccurrence: int = 5
    
    # Component level
    component_depth: int = 2
    min_component_cooccurrence: int = 5
    
    # Time filters
    window_days: int | None = None
    decay_half_life_days: int | None = None
    
    # Edge computation
    topk_edges_per_file: int = 50
    
    def to_dict(self) -> dict:
        return {
            "min_revisions": self.min_revisions,
            "max_changeset_size": self.max_changeset_size,
            "changeset_mode": self.changeset_mode,
            "author_time_window_hours": self.author_time_window_hours,
            "ticket_id_pattern": self.ticket_id_pattern,
            "max_logical_changeset_size": self.max_logical_changeset_size,
            "min_cooccurrence": self.min_cooccurrence,
            "component_depth": self.component_depth,
            "min_component_cooccurrence": self.min_component_cooccurrence,
            "window_days": self.window_days,
            "decay_half_life_days": self.decay_half_life_days,
            "topk_edges_per_file": self.topk_edges_per_file,
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "CouplingConfig":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})
```

---

## 2. Current File Structure Fix ✅ DONE

### 2.1 Add HEAD File Sync

**File: `lfca/sync.py`** (NEW)

```python
"""Synchronize current file state with git HEAD."""

from __future__ import annotations
import subprocess
from pathlib import Path

from lfca.config import RepoPaths
from lfca.storage import Storage


def get_files_at_head(mirror_path: Path) -> set[str]:
    """Get list of files at HEAD from git."""
    result = subprocess.run(
        ["git", "-C", str(mirror_path), "ls-tree", "-r", "--name-only", "HEAD"],
        capture_output=True,
        text=True,
        check=True
    )
    return set(line for line in result.stdout.strip().split('\n') if line)


def sync_head_files(paths: RepoPaths, storage: Storage) -> int:
    """
    Sync database with current HEAD state.
    Returns count of current files.
    """
    current_paths = get_files_at_head(paths.mirror_path)
    storage.update_head_status(current_paths)
    return len(current_paths)


def build_file_tree(storage: Storage) -> dict:
    """Build hierarchical tree of current files."""
    files = storage.get_current_files()
    
    tree = {}
    for f in files:
        path = f["path"]
        parts = path.split("/")
        
        node = tree
        for i, part in enumerate(parts[:-1]):
            if part not in node:
                node[part] = {"__type": "dir", "__children": {}}
            node = node[part]["__children"]
        
        # Leaf file
        filename = parts[-1]
        node[filename] = {
            "__type": "file",
            "file_id": f["file_id"],
            "commits": f["total_commits"]
        }
    
    return tree


def get_folder_list(storage: Storage, depth: int = 2) -> list[str]:
    """Get unique folder paths at given depth."""
    files = storage.get_current_files()
    
    folders = set()
    for f in files:
        parts = f["path"].split("/")
        if len(parts) > depth:
            folder = "/".join(parts[:depth])
            folders.add(folder)
    
    return sorted(folders)
```

### 2.2 Update Extraction to Sync HEAD

**File: `lfca/extract.py`** (MODIFY)

Add at end of `HistoryExtractor.run()`:

```python
# At the end of run() method, after closing sinks:

def run(self, ...) -> ExtractStats:
    # ... existing extraction code ...
    
    # NEW: Sync current files with HEAD
    from lfca.sync import sync_head_files
    from lfca.storage import Storage
    
    storage = Storage(self.paths.db_path, self.paths.parquet_dir)
    current_file_count = sync_head_files(self.paths, storage)
    logger.info(f"Synced {current_file_count} files at HEAD")
    storage.close()
    
    return stats
```

---

## 3. Git Extraction Improvements ✅ DONE

### 3.1 Update Git Module

**File: `lfca/git.py`** (MODIFY)

```python
# Add ref parameter to iter_log

def iter_log(
    repo_path: Path,
    since: str | None = None,
    until: str | None = None,
    ref: str = "HEAD",
    all_refs: bool = False
) -> Iterable[tuple[CommitHeader, list[tuple[str, str, str | None]]]]:
    """
    Iterate git log.
    
    Args:
        repo_path: Path to git repo (should be mirror.git)
        since: Date filter
        until: Date filter  
        ref: Git ref to traverse (default HEAD)
        all_refs: If True, traverse all refs (--all)
    """
    args = [
        "git", "-C", str(repo_path),
        "log",
        "--name-status",
        "--find-renames=60%",
        "--date-order",
        "-z",
    ]
    
    if since:
        args.append(f"--since={since}")
    if until:
        args.append(f"--until={until}")
    
    if all_refs:
        args.append("--all")
    else:
        args.append(ref)
    
    # ... rest of implementation unchanged ...


def get_head_oid(repo_path: Path) -> str:
    """Get current HEAD commit OID."""
    result = subprocess.run(
        ["git", "-C", str(repo_path), "rev-parse", "HEAD"],
        capture_output=True, text=True, check=True
    )
    return result.stdout.strip()
```

### 3.2 Rewrite Extraction with New Storage

**File: `lfca/extract.py`** (REPLACE core logic)

```python
"""Git history extraction."""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Callable

import pyarrow as pa

from lfca.config import RepoPaths, CouplingConfig
from lfca.git import iter_log, get_head_oid
from lfca.storage import Storage
from lfca.sync import sync_head_files
from lfca.logging_utils import get_logger

logger = get_logger(__name__)


@dataclass
class ExtractStats:
    commit_count: int = 0
    file_count: int = 0
    change_count: int = 0
    transaction_count: int = 0


@dataclass
class Transaction:
    """A logical changeset (commit or grouped commits)."""
    file_ids: list[int]
    weight: float = 1.0
    timestamp: int = 0


class HistoryExtractor:
    def __init__(
        self, 
        paths: RepoPaths, 
        config: CouplingConfig | None = None
    ):
        self.paths = paths
        self.config = config or CouplingConfig()
        self.storage = Storage(paths.db_path, paths.parquet_dir)
    
    def run(
        self,
        since: str | None = None,
        until: str | None = None,
        progress_callback: Callable[[int], None] | None = None,
    ) -> ExtractStats:
        """Run extraction from mirror."""
        logger.info(f"Starting extraction (since={since}, until={until})")
        self.paths.ensure_dirs()
        
        stats = ExtractStats()
        file_commit_counts: Counter[int] = Counter()
        
        # Collect commits for Parquet
        commits_data = []
        changes_data = []
        
        # Process git log from MIRROR
        for header, changes in iter_log(
            self.paths.mirror_path,  # Use mirror!
            since=since,
            until=until
        ):
            stats.commit_count += 1
            
            if progress_callback and stats.commit_count % 100 == 0:
                progress_callback(stats.commit_count)
            
            # Skip large changesets
            if len(changes) > self.config.max_changeset_size:
                continue
            
            is_merge = len(header.parents) > 1
            
            commits_data.append({
                "commit_oid": header.commit_oid,
                "author_name": header.author_name,
                "author_email": header.author_email,
                "authored_ts": header.authored_ts,
                "committer_ts": header.committer_ts,
                "is_merge": is_merge,
                "parent_count": len(header.parents),
                "message_subject": header.subject,
            })
            
            file_ids_in_commit = set()
            
            with self.storage.transaction():
                for status, path, old_path in changes:
                    if not path:
                        continue
                    
                    # Get or create file
                    file_id = self.storage.get_or_create_file(path)
                    file_ids_in_commit.add(file_id)
                    
                    changes_data.append({
                        "commit_oid": header.commit_oid,
                        "file_id": file_id,
                        "path": path,
                        "status": status,
                        "old_path": old_path,
                        "commit_ts": header.committer_ts,
                    })
                    
                    # Track renames
                    if old_path and (status.startswith("R") or status.startswith("C")):
                        self._record_rename(file_id, old_path, path, header.commit_oid)
            
            # Update file commit counts
            for fid in file_ids_in_commit:
                file_commit_counts[fid] += 1
            
            stats.change_count += len(changes)
        
        # Write Parquet files
        self._write_parquet("commits", commits_data)
        self._write_parquet("changes", changes_data)
        
        # Update file stats
        self._update_file_stats(file_commit_counts)
        
        # Sync HEAD
        sync_head_files(self.paths, self.storage)
        
        stats.file_count = len(file_commit_counts)
        logger.info(f"Extraction complete: {stats.commit_count} commits, {stats.file_count} files")
        
        return stats
    
    def _record_rename(self, file_id: int, old_path: str, new_path: str, commit_oid: str):
        """Record file rename in lineage."""
        self.storage.conn.execute("""
            INSERT OR IGNORE INTO file_lineage (file_id, path, start_commit_oid, end_commit_oid)
            VALUES (?, ?, ?, NULL)
        """, (file_id, old_path, commit_oid))
    
    def _update_file_stats(self, counts: Counter[int]):
        """Update total_commits for files."""
        for file_id, count in counts.items():
            self.storage.conn.execute(
                "UPDATE files SET total_commits = ? WHERE file_id = ?",
                (count, file_id)
            )
        self.storage.conn.commit()
    
    def _write_parquet(self, name: str, data: list[dict]):
        """Write data to Parquet."""
        if not data:
            return
        table = pa.Table.from_pylist(data)
        self.storage.write_parquet(name, table)
    
    def close(self):
        self.storage.close()
```

---

## 4. Coupling Configuration ✅ DONE

### 4.1 Changeset Grouping

**File: `lfca/changesets.py`** (NEW)

```python
"""Changeset grouping strategies."""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import Iterator

from lfca.config import CouplingConfig


@dataclass
class Changeset:
    """A logical changeset (one or more commits grouped)."""
    id: str
    file_ids: set[int]
    weight: float = 1.0
    timestamp: int = 0


def group_by_commit(
    commits: list[dict],
    changes: list[dict],
    config: CouplingConfig
) -> Iterator[Changeset]:
    """Each commit is its own changeset."""
    
    # Group changes by commit
    commit_files: dict[str, set[int]] = defaultdict(set)
    commit_ts: dict[str, int] = {}
    
    for change in changes:
        commit_files[change["commit_oid"]].add(change["file_id"])
    
    for commit in commits:
        commit_ts[commit["commit_oid"]] = commit["committer_ts"]
    
    for commit_oid, file_ids in commit_files.items():
        if len(file_ids) > config.max_changeset_size:
            continue
        
        yield Changeset(
            id=commit_oid,
            file_ids=file_ids,
            timestamp=commit_ts.get(commit_oid, 0)
        )


def group_by_author_time(
    commits: list[dict],
    changes: list[dict],
    config: CouplingConfig
) -> Iterator[Changeset]:
    """Group commits by same author within time window."""
    
    window_seconds = config.author_time_window_hours * 3600
    
    # Sort commits by time
    sorted_commits = sorted(commits, key=lambda c: c["committer_ts"])
    
    # Group changes by commit
    commit_files: dict[str, set[int]] = defaultdict(set)
    for change in changes:
        commit_files[change["commit_oid"]].add(change["file_id"])
    
    # Group by author + time window
    groups: list[Changeset] = []
    current_group: Changeset | None = None
    current_author: str | None = None
    current_end_time: int = 0
    
    for commit in sorted_commits:
        author = commit["author_email"]
        ts = commit["committer_ts"]
        files = commit_files.get(commit["commit_oid"], set())
        
        if (current_group is None or 
            author != current_author or 
            ts > current_end_time):
            # Start new group
            if current_group and len(current_group.file_ids) <= config.max_logical_changeset_size:
                yield current_group
            
            current_group = Changeset(
                id=f"{author}:{ts}",
                file_ids=set(),
                timestamp=ts
            )
            current_author = author
            current_end_time = ts + window_seconds
        
        current_group.file_ids.update(files)
    
    if current_group and len(current_group.file_ids) <= config.max_logical_changeset_size:
        yield current_group


def group_by_ticket_id(
    commits: list[dict],
    changes: list[dict],
    config: CouplingConfig
) -> Iterator[Changeset]:
    """Group commits by ticket ID extracted from message."""
    
    if not config.ticket_id_pattern:
        raise ValueError("ticket_id_pattern required for by_ticket_id mode")
    
    pattern = re.compile(config.ticket_id_pattern)
    
    # Group changes by commit
    commit_files: dict[str, set[int]] = defaultdict(set)
    for change in changes:
        commit_files[change["commit_oid"]].add(change["file_id"])
    
    # Group by ticket
    ticket_files: dict[str, set[int]] = defaultdict(set)
    ticket_ts: dict[str, int] = {}
    
    for commit in commits:
        message = commit.get("message_subject", "")
        match = pattern.search(message)
        
        if match:
            ticket_id = match.group(1) if match.groups() else match.group(0)
        else:
            ticket_id = commit["commit_oid"]  # Fallback to commit
        
        files = commit_files.get(commit["commit_oid"], set())
        ticket_files[ticket_id].update(files)
        
        if ticket_id not in ticket_ts:
            ticket_ts[ticket_id] = commit["committer_ts"]
    
    for ticket_id, file_ids in ticket_files.items():
        if len(file_ids) > config.max_logical_changeset_size:
            continue
        
        yield Changeset(
            id=ticket_id,
            file_ids=file_ids,
            timestamp=ticket_ts.get(ticket_id, 0)
        )


def get_changesets(
    commits: list[dict],
    changes: list[dict],
    config: CouplingConfig
) -> Iterator[Changeset]:
    """Get changesets based on configured grouping mode."""
    
    if config.changeset_mode == "by_commit":
        yield from group_by_commit(commits, changes, config)
    elif config.changeset_mode == "by_author_time":
        yield from group_by_author_time(commits, changes, config)
    elif config.changeset_mode == "by_ticket_id":
        yield from group_by_ticket_id(commits, changes, config)
    else:
        raise ValueError(f"Unknown changeset_mode: {config.changeset_mode}")
```

---

## 5. Query API Expansion ✅ DONE

### 5.1 New API Endpoints

**File: `lfca/api.py`** (REPLACE/REWRITE)

```python
"""FastAPI application."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import List

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from lfca.config import RepoPaths, CouplingConfig
from lfca.storage import Storage
from lfca.sync import build_file_tree, get_folder_list

app = FastAPI(title="LFCA API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_storage(repo_id: str, data_dir: str = "data") -> Storage:
    paths = RepoPaths(Path(data_dir), repo_id)
    return Storage(paths.db_path, paths.parquet_dir)


# === Models ===

class RepoInfo(BaseModel):
    id: str
    name: str
    state: str
    file_count: int = 0
    commit_count: int = 0


class FileInfo(BaseModel):
    file_id: int
    path: str
    exists_at_head: bool
    total_commits: int


class CoupledFile(BaseModel):
    file_id: int
    path: str
    pair_count: float
    jaccard: float
    jaccard_weighted: float
    p_dst_given_src: float
    p_src_given_dst: float


class FileHistory(BaseModel):
    file_id: int
    path: str
    commits: List[dict]
    renames: List[dict]


class AnalysisRequest(BaseModel):
    min_revisions: int = 5
    max_changeset_size: int = 50
    changeset_mode: str = "by_commit"
    author_time_window_hours: int = 24
    ticket_id_pattern: str | None = None
    min_cooccurrence: int = 5
    window_days: int | None = None


class ClusterRequest(BaseModel):
    algorithm: str = "louvain"
    weight_column: str = "jaccard"
    min_weight: float = 0.1
    folders: List[str] = Field(default_factory=list)
    params: dict = Field(default_factory=dict)


# === Endpoints ===

# --- Repository Structure ---

@app.get("/repos/{repo_id}/files/tree")
def get_file_tree(repo_id: str, data_dir: str = "data") -> dict:
    """Get current file tree (only files at HEAD)."""
    storage = get_storage(repo_id, data_dir)
    try:
        return build_file_tree(storage)
    finally:
        storage.close()


@app.get("/repos/{repo_id}/files", response_model=List[FileInfo])
def list_files(
    repo_id: str,
    q: str | None = None,
    current_only: bool = True,
    limit: int = 500,
    data_dir: str = "data"
) -> List[FileInfo]:
    """List files, optionally filtered by path prefix."""
    storage = get_storage(repo_id, data_dir)
    try:
        if current_only:
            query = """
                SELECT file_id, path_current, exists_at_head, total_commits
                FROM files
                WHERE exists_at_head = TRUE
            """
        else:
            query = """
                SELECT file_id, COALESCE(path_current, path_latest), exists_at_head, total_commits
                FROM files
            """
        
        if q:
            query += f" AND path_current LIKE '{q}%'"
        
        query += f" ORDER BY path_current LIMIT {limit}"
        
        rows = storage.conn.execute(query).fetchall()
        return [
            FileInfo(file_id=r[0], path=r[1], exists_at_head=bool(r[2]), total_commits=r[3])
            for r in rows
        ]
    finally:
        storage.close()


@app.get("/repos/{repo_id}/folders")
def list_folders(
    repo_id: str,
    depth: int = 2,
    data_dir: str = "data"
) -> List[str]:
    """Get folder list at given depth."""
    storage = get_storage(repo_id, data_dir)
    try:
        return get_folder_list(storage, depth)
    finally:
        storage.close()


# --- File History ---

@app.get("/repos/{repo_id}/files/{path:path}/history")
def get_file_history(
    repo_id: str,
    path: str,
    limit: int = 100,
    data_dir: str = "data"
) -> FileHistory:
    """Get commit history for a file."""
    storage = get_storage(repo_id, data_dir)
    try:
        file_info = storage.get_file_by_path(path)
        if not file_info:
            raise HTTPException(404, f"File not found: {path}")
        
        file_id = file_info["file_id"]
        
        # Get commits from changes parquet
        import pyarrow.dataset as ds
        changes_path = storage.parquet_dir / "changes.parquet"
        
        if changes_path.exists():
            dataset = ds.dataset(changes_path)
            table = dataset.to_table(
                filter=ds.field("file_id") == file_id
            )
            commits = table.to_pylist()[:limit]
        else:
            commits = []
        
        # Get renames
        renames = storage.conn.execute("""
            SELECT path, start_commit_oid, end_commit_oid
            FROM file_lineage
            WHERE file_id = ?
            ORDER BY start_commit_oid
        """, (file_id,)).fetchall()
        
        return FileHistory(
            file_id=file_id,
            path=path,
            commits=commits,
            renames=[
                {"path": r[0], "start": r[1], "end": r[2]}
                for r in renames
            ]
        )
    finally:
        storage.close()


# --- Commit Co-changes ---

@app.get("/repos/{repo_id}/commits/{commit_oid}/files")
def get_commit_files(
    repo_id: str,
    commit_oid: str,
    data_dir: str = "data"
) -> dict:
    """Get all files changed in a specific commit."""
    storage = get_storage(repo_id, data_dir)
    try:
        import pyarrow.dataset as ds
        changes_path = storage.parquet_dir / "changes.parquet"
        
        if not changes_path.exists():
            raise HTTPException(404, "Changes data not found")
        
        dataset = ds.dataset(changes_path)
        table = dataset.to_table(
            filter=ds.field("commit_oid") == commit_oid
        )
        
        changes = table.to_pylist()
        
        # Get current paths for file_ids
        file_ids = [c["file_id"] for c in changes]
        if file_ids:
            placeholders = ",".join("?" * len(file_ids))
            rows = storage.conn.execute(f"""
                SELECT file_id, COALESCE(path_current, path_latest), exists_at_head
                FROM files WHERE file_id IN ({placeholders})
            """, file_ids).fetchall()
            file_map = {r[0]: {"path": r[1], "exists": bool(r[2])} for r in rows}
        else:
            file_map = {}
        
        return {
            "commit_oid": commit_oid,
            "files": [
                {
                    "file_id": c["file_id"],
                    "path": file_map.get(c["file_id"], {}).get("path", c["path"]),
                    "status": c["status"],
                    "exists_at_head": file_map.get(c["file_id"], {}).get("exists", False)
                }
                for c in changes
            ]
        }
    finally:
        storage.close()


# --- Range Co-changes ---

@app.get("/repos/{repo_id}/cochanges")
def get_cochanges_in_range(
    repo_id: str,
    path: str,
    since: str | None = None,
    until: str | None = None,
    limit: int = 50,
    data_dir: str = "data"
) -> dict:
    """Get files that co-changed with given file in date range."""
    storage = get_storage(repo_id, data_dir)
    try:
        file_info = storage.get_file_by_path(path)
        if not file_info:
            raise HTTPException(404, f"File not found: {path}")
        
        file_id = file_info["file_id"]
        
        import pyarrow.dataset as ds
        changes_path = storage.parquet_dir / "changes.parquet"
        
        if not changes_path.exists():
            raise HTTPException(404, "Changes data not found")
        
        # Build filter
        filters = [ds.field("file_id") == file_id]
        if since:
            since_ts = int(datetime.fromisoformat(since).timestamp())
            filters.append(ds.field("commit_ts") >= since_ts)
        if until:
            until_ts = int(datetime.fromisoformat(until).timestamp())
            filters.append(ds.field("commit_ts") <= until_ts)
        
        combined_filter = filters[0]
        for f in filters[1:]:
            combined_filter = combined_filter & f
        
        dataset = ds.dataset(changes_path)
        table = dataset.to_table(filter=combined_filter)
        
        # Get commits where this file changed
        target_commits = set(table.column("commit_oid").to_pylist())
        
        if not target_commits:
            return {"file": path, "commits_in_range": 0, "cochanged_files": []}
        
        # Get all files in those commits
        all_changes = dataset.to_table(
            filter=ds.field("commit_oid").isin(list(target_commits))
        ).to_pylist()
        
        # Count co-occurrences
        from collections import Counter
        cochange_counts: Counter[int] = Counter()
        for c in all_changes:
            if c["file_id"] != file_id:
                cochange_counts[c["file_id"]] += 1
        
        # Get file paths
        top_ids = [fid for fid, _ in cochange_counts.most_common(limit)]
        if top_ids:
            placeholders = ",".join("?" * len(top_ids))
            rows = storage.conn.execute(f"""
                SELECT file_id, COALESCE(path_current, path_latest)
                FROM files WHERE file_id IN ({placeholders}) AND exists_at_head = TRUE
            """, top_ids).fetchall()
            path_map = {r[0]: r[1] for r in rows}
        else:
            path_map = {}
        
        total_commits = len(target_commits)
        
        return {
            "file": path,
            "commits_in_range": total_commits,
            "cochanged_files": [
                {
                    "path": path_map.get(fid),
                    "file_id": fid,
                    "cochange_count": count,
                    "percentage": round(count / total_commits * 100, 1)
                }
                for fid, count in cochange_counts.most_common(limit)
                if fid in path_map
            ]
        }
    finally:
        storage.close()


# --- Global Coupling ---

@app.get("/repos/{repo_id}/coupling", response_model=List[CoupledFile])
def get_coupling(
    repo_id: str,
    path: str,
    metric: str = "jaccard",
    min_weight: float = 0.0,
    limit: int = 50,
    current_only: bool = True,
    data_dir: str = "data"
) -> List[CoupledFile]:
    """Get globally coupled files based on pre-computed edges."""
    storage = get_storage(repo_id, data_dir)
    try:
        file_info = storage.get_file_by_path(path)
        if not file_info:
            raise HTTPException(404, f"File not found: {path}")
        
        edges = storage.get_edges_for_file(
            file_info["file_id"],
            metric=metric,
            min_weight=min_weight,
            limit=limit,
            current_only=current_only
        )
        
        return [CoupledFile(**e) for e in edges]
    finally:
        storage.close()


@app.get("/repos/{repo_id}/coupling/graph")
def get_coupling_graph(
    repo_id: str,
    path: str,
    metric: str = "jaccard",
    min_weight: float = 0.1,
    limit: int = 30,
    data_dir: str = "data"
) -> dict:
    """Get coupling as graph (nodes + edges) for visualization."""
    storage = get_storage(repo_id, data_dir)
    try:
        file_info = storage.get_file_by_path(path)
        if not file_info:
            raise HTTPException(404, f"File not found: {path}")
        
        focus_id = file_info["file_id"]
        edges_data = storage.get_edges_for_file(
            focus_id, metric=metric, min_weight=min_weight, limit=limit
        )
        
        # Build nodes
        node_ids = {focus_id}
        for e in edges_data:
            node_ids.add(e["file_id"])
        
        # Get paths
        placeholders = ",".join("?" * len(node_ids))
        rows = storage.conn.execute(f"""
            SELECT file_id, path_current FROM files WHERE file_id IN ({placeholders})
        """, list(node_ids)).fetchall()
        path_map = {r[0]: r[1] for r in rows}
        
        nodes = [
            {"id": nid, "path": path_map.get(nid, f"file:{nid}"), "is_focus": nid == focus_id}
            for nid in node_ids
        ]
        
        edges = [
            {
                "source": focus_id,
                "target": e["file_id"],
                "weight": e[metric],
                "pair_count": e["pair_count"]
            }
            for e in edges_data
        ]
        
        return {"nodes": nodes, "edges": edges, "focus_id": focus_id}
    finally:
        storage.close()


# --- Component Level Coupling ---

@app.get("/repos/{repo_id}/coupling/components")
def get_component_coupling(
    repo_id: str,
    component: str,
    depth: int = 2,
    limit: int = 20,
    data_dir: str = "data"
) -> dict:
    """Get coupling at component/folder level."""
    storage = get_storage(repo_id, data_dir)
    try:
        rows = storage.conn.execute("""
            SELECT dst_component, pair_count, jaccard, file_pair_count
            FROM component_edges
            WHERE src_component = ? AND depth = ?
            ORDER BY jaccard DESC
            LIMIT ?
        """, (component, depth, limit)).fetchall()
        
        return {
            "component": component,
            "depth": depth,
            "coupled_components": [
                {
                    "component": r[0],
                    "pair_count": r[1],
                    "jaccard": r[2],
                    "file_pair_count": r[3]
                }
                for r in rows
            ]
        }
    finally:
        storage.close()
```

---

## 6. Advanced Clustering ✅ DONE

### 6.1 Clustering Interface

**File: `lfca/clustering/__init__.py`** (NEW)

```python
"""Clustering algorithms."""

from lfca.clustering.base import ClusterAlgorithm, ClusterResult
from lfca.clustering.registry import get_algorithm, list_algorithms

__all__ = ["ClusterAlgorithm", "ClusterResult", "get_algorithm", "list_algorithms"]
```

**File: `lfca/clustering/base.py`** (NEW)

```python
"""Base clustering interface."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ClusterResult:
    algorithm: str
    parameters: dict
    cluster_count: int
    clusters: list[dict]  # [{id, size, file_ids, files, ...}]
    metrics: dict = field(default_factory=dict)
    
    def to_dict(self) -> dict:
        return {
            "algorithm": self.algorithm,
            "parameters": self.parameters,
            "cluster_count": self.cluster_count,
            "clusters": self.clusters,
            "metrics": self.metrics
        }


class ClusterAlgorithm(ABC):
    """Base class for clustering algorithms."""
    
    name: str = "base"
    
    @classmethod
    @abstractmethod
    def get_params_schema(cls) -> dict:
        """Return JSON schema for algorithm parameters."""
        pass
    
    @abstractmethod
    def run(
        self,
        edges: list[dict],
        file_ids: set[int],
        file_paths: dict[int, str],
        params: dict
    ) -> ClusterResult:
        """
        Run clustering.
        
        Args:
            edges: List of edge dicts with src_file_id, dst_file_id, and weight columns
            file_ids: Set of file IDs to cluster
            file_paths: Mapping of file_id -> path
            params: Algorithm-specific parameters
        
        Returns:
            ClusterResult with clusters
        """
        pass
```

**File: `lfca/clustering/registry.py`** (NEW)

```python
"""Algorithm registry."""

from __future__ import annotations

from typing import Type

from lfca.clustering.base import ClusterAlgorithm

_REGISTRY: dict[str, Type[ClusterAlgorithm]] = {}


def register(cls: Type[ClusterAlgorithm]) -> Type[ClusterAlgorithm]:
    """Decorator to register an algorithm."""
    _REGISTRY[cls.name] = cls
    return cls


def get_algorithm(name: str) -> ClusterAlgorithm:
    """Get algorithm instance by name."""
    if name not in _REGISTRY:
        raise ValueError(f"Unknown algorithm: {name}. Available: {list(_REGISTRY.keys())}")
    return _REGISTRY[name]()


def list_algorithms() -> list[dict]:
    """List available algorithms with their parameter schemas."""
    return [
        {"name": name, "params_schema": cls.get_params_schema()}
        for name, cls in _REGISTRY.items()
    ]
```

### 6.2 Algorithm Implementations

**File: `lfca/clustering/components.py`** (NEW)

```python
"""Connected components clustering."""

from lfca.clustering.base import ClusterAlgorithm, ClusterResult
from lfca.clustering.registry import register


class UnionFind:
    def __init__(self, items):
        self.parent = {item: item for item in items}
        self.rank = {item: 0 for item in items}
    
    def find(self, item):
        if self.parent[item] != item:
            self.parent[item] = self.find(self.parent[item])
        return self.parent[item]
    
    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return
        if self.rank[ra] < self.rank[rb]:
            self.parent[ra] = rb
        elif self.rank[ra] > self.rank[rb]:
            self.parent[rb] = ra
        else:
            self.parent[rb] = ra
            self.rank[ra] += 1


@register
class ConnectedComponents(ClusterAlgorithm):
    name = "components"
    
    @classmethod
    def get_params_schema(cls) -> dict:
        return {
            "type": "object",
            "properties": {
                "min_weight": {
                    "type": "number",
                    "default": 0.1,
                    "description": "Minimum edge weight to include"
                }
            }
        }
    
    def run(self, edges, file_ids, file_paths, params) -> ClusterResult:
        min_weight = params.get("min_weight", 0.1)
        weight_col = params.get("weight_column", "jaccard")
        
        uf = UnionFind(file_ids)
        
        for edge in edges:
            weight = edge.get(weight_col, edge.get("jaccard", 0))
            if weight >= min_weight:
                src = edge["src_file_id"]
                dst = edge["dst_file_id"]
                if src in uf.parent and dst in uf.parent:
                    uf.union(src, dst)
        
        # Group by root
        clusters_map: dict[int, list[int]] = {}
        for fid in file_ids:
            root = uf.find(fid)
            clusters_map.setdefault(root, []).append(fid)
        
        # Sort by size
        sorted_clusters = sorted(clusters_map.values(), key=len, reverse=True)
        
        clusters = [
            {
                "id": i + 1,
                "size": len(c),
                "file_ids": c,
                "files": [file_paths.get(fid, f"file:{fid}") for fid in c]
            }
            for i, c in enumerate(sorted_clusters)
        ]
        
        return ClusterResult(
            algorithm="components",
            parameters={"min_weight": min_weight},
            cluster_count=len(clusters),
            clusters=clusters
        )
```

**File: `lfca/clustering/louvain.py`** (NEW)

```python
"""Louvain community detection."""

from lfca.clustering.base import ClusterAlgorithm, ClusterResult
from lfca.clustering.registry import register


@register
class Louvain(ClusterAlgorithm):
    name = "louvain"
    
    @classmethod
    def get_params_schema(cls) -> dict:
        return {
            "type": "object",
            "properties": {
                "resolution": {
                    "type": "number",
                    "default": 1.0,
                    "description": "Resolution parameter (higher = smaller communities)"
                },
                "min_weight": {
                    "type": "number",
                    "default": 0.0,
                    "description": "Minimum edge weight"
                },
                "random_state": {
                    "type": "integer",
                    "description": "Random seed for reproducibility"
                }
            }
        }
    
    def run(self, edges, file_ids, file_paths, params) -> ClusterResult:
        try:
            import networkx as nx
            from community import community_louvain
        except ImportError:
            raise ImportError("Install python-louvain: pip install python-louvain networkx")
        
        resolution = params.get("resolution", 1.0)
        min_weight = params.get("min_weight", 0.0)
        weight_col = params.get("weight_column", "jaccard")
        random_state = params.get("random_state")
        
        # Build graph
        G = nx.Graph()
        G.add_nodes_from(file_ids)
        
        for edge in edges:
            weight = edge.get(weight_col, edge.get("jaccard", 0))
            if weight >= min_weight:
                G.add_edge(
                    edge["src_file_id"],
                    edge["dst_file_id"],
                    weight=weight
                )
        
        # Run Louvain
        partition = community_louvain.best_partition(
            G,
            weight="weight",
            resolution=resolution,
            random_state=random_state
        )
        
        # Calculate modularity
        modularity = community_louvain.modularity(partition, G, weight="weight")
        
        # Group by community
        communities: dict[int, list[int]] = {}
        for node, comm_id in partition.items():
            communities.setdefault(comm_id, []).append(node)
        
        sorted_comms = sorted(communities.values(), key=len, reverse=True)
        
        clusters = [
            {
                "id": i + 1,
                "size": len(c),
                "file_ids": c,
                "files": [file_paths.get(fid, f"file:{fid}") for fid in c]
            }
            for i, c in enumerate(sorted_comms)
        ]
        
        return ClusterResult(
            algorithm="louvain",
            parameters={"resolution": resolution, "min_weight": min_weight},
            cluster_count=len(clusters),
            clusters=clusters,
            metrics={"modularity": modularity}
        )
```

**File: `lfca/clustering/label_propagation.py`** (NEW)

```python
"""Label propagation clustering."""

from lfca.clustering.base import ClusterAlgorithm, ClusterResult
from lfca.clustering.registry import register


@register
class LabelPropagation(ClusterAlgorithm):
    name = "label_propagation"
    
    @classmethod
    def get_params_schema(cls) -> dict:
        return {
            "type": "object",
            "properties": {
                "min_weight": {
                    "type": "number",
                    "default": 0.0
                },
                "max_iterations": {
                    "type": "integer",
                    "default": 100
                }
            }
        }
    
    def run(self, edges, file_ids, file_paths, params) -> ClusterResult:
        try:
            import networkx as nx
        except ImportError:
            raise ImportError("Install networkx: pip install networkx")
        
        min_weight = params.get("min_weight", 0.0)
        weight_col = params.get("weight_column", "jaccard")
        
        G = nx.Graph()
        G.add_nodes_from(file_ids)
        
        for edge in edges:
            weight = edge.get(weight_col, edge.get("jaccard", 0))
            if weight >= min_weight:
                G.add_edge(edge["src_file_id"], edge["dst_file_id"], weight=weight)
        
        communities = list(nx.community.label_propagation_communities(G))
        
        clusters = [
            {
                "id": i + 1,
                "size": len(c),
                "file_ids": list(c),
                "files": [file_paths.get(fid, f"file:{fid}") for fid in c]
            }
            for i, c in enumerate(sorted(communities, key=len, reverse=True))
        ]
        
        return ClusterResult(
            algorithm="label_propagation",
            parameters={"min_weight": min_weight},
            cluster_count=len(clusters),
            clusters=clusters
        )
```

**File: `lfca/clustering/hierarchical.py`** (NEW)

```python
"""Hierarchical agglomerative clustering."""

from lfca.clustering.base import ClusterAlgorithm, ClusterResult
from lfca.clustering.registry import register


@register
class Hierarchical(ClusterAlgorithm):
    name = "hierarchical"
    
    @classmethod
    def get_params_schema(cls) -> dict:
        return {
            "type": "object",
            "properties": {
                "n_clusters": {
                    "type": "integer",
                    "description": "Number of clusters (required if distance_threshold not set)"
                },
                "distance_threshold": {
                    "type": "number",
                    "description": "Distance threshold for cutting dendrogram"
                },
                "linkage": {
                    "type": "string",
                    "enum": ["ward", "complete", "average", "single"],
                    "default": "average"
                }
            }
        }
    
    def run(self, edges, file_ids, file_paths, params) -> ClusterResult:
        try:
            import numpy as np
            from scipy.cluster.hierarchy import linkage, fcluster
            from scipy.spatial.distance import squareform
        except ImportError:
            raise ImportError("Install scipy: pip install scipy numpy")
        
        n_clusters = params.get("n_clusters")
        distance_threshold = params.get("distance_threshold")
        linkage_method = params.get("linkage", "average")
        weight_col = params.get("weight_column", "jaccard")
        
        if n_clusters is None and distance_threshold is None:
            n_clusters = 10  # Default
        
        # Build distance matrix (1 - similarity)
        file_list = sorted(file_ids)
        n = len(file_list)
        id_to_idx = {fid: i for i, fid in enumerate(file_list)}
        
        dist_matrix = np.ones((n, n))
        np.fill_diagonal(dist_matrix, 0)
        
        for edge in edges:
            src_idx = id_to_idx.get(edge["src_file_id"])
            dst_idx = id_to_idx.get(edge["dst_file_id"])
            if src_idx is not None and dst_idx is not None:
                weight = edge.get(weight_col, edge.get("jaccard", 0))
                distance = 1 - weight
                dist_matrix[src_idx, dst_idx] = distance
                dist_matrix[dst_idx, src_idx] = distance
        
        # Perform hierarchical clustering
        condensed = squareform(dist_matrix)
        Z = linkage(condensed, method=linkage_method)
        
        if distance_threshold:
            labels = fcluster(Z, t=distance_threshold, criterion='distance')
        else:
            labels = fcluster(Z, t=n_clusters, criterion='maxclust')
        
        # Group by label
        clusters_map: dict[int, list[int]] = {}
        for idx, label in enumerate(labels):
            fid = file_list[idx]
            clusters_map.setdefault(int(label), []).append(fid)
        
        sorted_clusters = sorted(clusters_map.values(), key=len, reverse=True)
        
        clusters = [
            {
                "id": i + 1,
                "size": len(c),
                "file_ids": c,
                "files": [file_paths.get(fid, f"file:{fid}") for fid in c]
            }
            for i, c in enumerate(sorted_clusters)
        ]
        
        return ClusterResult(
            algorithm="hierarchical",
            parameters={"n_clusters": n_clusters, "linkage": linkage_method},
            cluster_count=len(clusters),
            clusters=clusters
        )
```

**File: `lfca/clustering/dbscan.py`** (NEW)

```python
"""DBSCAN clustering."""

from lfca.clustering.base import ClusterAlgorithm, ClusterResult
from lfca.clustering.registry import register


@register
class DBSCAN(ClusterAlgorithm):
    name = "dbscan"
    
    @classmethod
    def get_params_schema(cls) -> dict:
        return {
            "type": "object",
            "properties": {
                "eps": {
                    "type": "number",
                    "default": 0.5,
                    "description": "Maximum distance between samples (1 - similarity)"
                },
                "min_samples": {
                    "type": "integer",
                    "default": 2,
                    "description": "Minimum samples in neighborhood"
                }
            }
        }
    
    def run(self, edges, file_ids, file_paths, params) -> ClusterResult:
        try:
            import numpy as np
            from sklearn.cluster import DBSCAN as SklearnDBSCAN
        except ImportError:
            raise ImportError("Install scikit-learn: pip install scikit-learn numpy")
        
        eps = params.get("eps", 0.5)
        min_samples = params.get("min_samples", 2)
        weight_col = params.get("weight_column", "jaccard")
        
        # Build distance matrix
        file_list = sorted(file_ids)
        n = len(file_list)
        id_to_idx = {fid: i for i, fid in enumerate(file_list)}
        
        dist_matrix = np.ones((n, n))
        np.fill_diagonal(dist_matrix, 0)
        
        for edge in edges:
            src_idx = id_to_idx.get(edge["src_file_id"])
            dst_idx = id_to_idx.get(edge["dst_file_id"])
            if src_idx is not None and dst_idx is not None:
                weight = edge.get(weight_col, edge.get("jaccard", 0))
                distance = 1 - weight
                dist_matrix[src_idx, dst_idx] = distance
                dist_matrix[dst_idx, src_idx] = distance
        
        # Run DBSCAN
        clustering = SklearnDBSCAN(eps=eps, min_samples=min_samples, metric='precomputed')
        labels = clustering.fit_predict(dist_matrix)
        
        # Group by label (-1 is noise)
        clusters_map: dict[int, list[int]] = {}
        noise_files = []
        
        for idx, label in enumerate(labels):
            fid = file_list[idx]
            if label == -1:
                noise_files.append(fid)
            else:
                clusters_map.setdefault(int(label), []).append(fid)
        
        sorted_clusters = sorted(clusters_map.values(), key=len, reverse=True)
        
        clusters = [
            {
                "id": i + 1,
                "size": len(c),
                "file_ids": c,
                "files": [file_paths.get(fid, f"file:{fid}") for fid in c]
            }
            for i, c in enumerate(sorted_clusters)
        ]
        
        return ClusterResult(
            algorithm="dbscan",
            parameters={"eps": eps, "min_samples": min_samples},
            cluster_count=len(clusters),
            clusters=clusters,
            metrics={
                "noise_count": len(noise_files),
                "noise_files": [file_paths.get(fid) for fid in noise_files[:20]]
            }
        )
```

### 6.3 Clustering API Endpoint

**Add to `lfca/api.py`:**

```python
@app.get("/repos/{repo_id}/clustering/algorithms")
def list_clustering_algorithms() -> list[dict]:
    """List available clustering algorithms with their parameters."""
    from lfca.clustering import list_algorithms
    return list_algorithms()


@app.post("/repos/{repo_id}/clustering/run")
def run_clustering(
    repo_id: str,
    request: ClusterRequest,
    data_dir: str = "data"
) -> dict:
    """Run clustering algorithm."""
    from lfca.clustering import get_algorithm
    
    storage = get_storage(repo_id, data_dir)
    try:
        # Get edges
        if request.folders:
            # Filter to specific folders
            folder_patterns = [f"{f}/%" for f in request.folders]
            placeholders = " OR ".join(["path_current LIKE ?" for _ in folder_patterns])
            rows = storage.conn.execute(f"""
                SELECT file_id, path_current FROM files
                WHERE exists_at_head = TRUE AND ({placeholders})
            """, folder_patterns).fetchall()
        else:
            rows = storage.conn.execute("""
                SELECT file_id, path_current FROM files WHERE exists_at_head = TRUE
            """).fetchall()
        
        file_ids = {r[0] for r in rows}
        file_paths = {r[0]: r[1] for r in rows}
        
        # Get all edges between these files
        placeholders = ",".join("?" * len(file_ids))
        edges = storage.conn.execute(f"""
            SELECT src_file_id, dst_file_id, pair_count, jaccard, jaccard_weighted,
                   p_dst_given_src, p_src_given_dst
            FROM edges
            WHERE src_file_id IN ({placeholders}) AND dst_file_id IN ({placeholders})
        """, list(file_ids) + list(file_ids)).fetchall()
        
        edges_list = [
            {
                "src_file_id": e[0], "dst_file_id": e[1], "pair_count": e[2],
                "jaccard": e[3], "jaccard_weighted": e[4],
                "p_dst_given_src": e[5], "p_src_given_dst": e[6]
            }
            for e in edges
        ]
        
        # Run algorithm
        algo = get_algorithm(request.algorithm)
        result = algo.run(
            edges_list,
            file_ids,
            file_paths,
            {**request.params, "weight_column": request.weight_column, "min_weight": request.min_weight}
        )
        
        return result.to_dict()
    
    finally:
        storage.close()
```

---

## 7. Run Management ✅ DONE

### 7.1 Analysis Runner

**File: `lfca/runner.py`** (NEW)

```python
"""Analysis run management."""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from pathlib import Path

from lfca.config import RepoPaths, CouplingConfig
from lfca.extract import HistoryExtractor
from lfca.edges import EdgeBuilder
from lfca.mirror import mirror_repo
from lfca.storage import Storage
from lfca.git import get_head_oid
from lfca.logging_utils import get_logger

logger = get_logger(__name__)


def create_run(paths: RepoPaths, config: CouplingConfig) -> str:
    """Create a new analysis run."""
    run_id = uuid.uuid4().hex[:12]
    
    storage = Storage(paths.db_path, paths.parquet_dir)
    storage.conn.execute("""
        INSERT INTO analysis_runs (run_id, state, config_json, created_at)
        VALUES (?, 'pending', ?, ?)
    """, (run_id, json.dumps(config.to_dict()), datetime.utcnow().isoformat()))
    storage.conn.commit()
    storage.close()
    
    return run_id


def run_analysis(
    paths: RepoPaths,
    run_id: str,
    repo_path: Path,
    config: CouplingConfig,
    since: str | None = None,
    until: str | None = None,
    progress_callback=None
) -> dict:
    """Execute full analysis pipeline."""
    
    storage = Storage(paths.db_path, paths.parquet_dir)
    
    def update_state(state: str, **kwargs):
        sets = ", ".join(f"{k} = ?" for k in kwargs.keys())
        if sets:
            sets = ", " + sets
        storage.conn.execute(f"""
            UPDATE analysis_runs SET state = ?{sets} WHERE run_id = ?
        """, [state] + list(kwargs.values()) + [run_id])
        storage.conn.commit()
    
    try:
        update_state("running", started_at=datetime.utcnow().isoformat())
        
        # 1. Mirror
        logger.info("Mirroring repository...")
        mirror_repo(repo_path, paths)
        
        head_oid = get_head_oid(paths.mirror_path)
        update_state("running", git_head_oid=head_oid)
        
        # 2. Extract
        logger.info("Extracting history...")
        extractor = HistoryExtractor(paths, config)
        stats = extractor.run(since=since, until=until, progress_callback=progress_callback)
        extractor.close()
        
        update_state("running", commit_count=stats.commit_count, file_count=stats.file_count)
        
        # 3. Build edges
        logger.info("Building coupling edges...")
        builder = EdgeBuilder(paths, config)
        edge_count = builder.build()
        
        update_state(
            "complete",
            edge_count=edge_count,
            finished_at=datetime.utcnow().isoformat()
        )
        
        logger.info(f"Analysis complete: {stats.commit_count} commits, {stats.file_count} files, {edge_count} edges")
        
        return {
            "run_id": run_id,
            "state": "complete",
            "commit_count": stats.commit_count,
            "file_count": stats.file_count,
            "edge_count": edge_count
        }
    
    except Exception as e:
        logger.exception("Analysis failed")
        update_state("failed", error=str(e), finished_at=datetime.utcnow().isoformat())
        raise
    
    finally:
        storage.close()
```

### 7.2 Edge Builder Update

**File: `lfca/edges.py`** (REPLACE)

```python
"""Edge building with proper metrics."""

from __future__ import annotations

import math
from collections import Counter, defaultdict
from dataclasses import dataclass
from itertools import combinations

from lfca.config import RepoPaths, CouplingConfig
from lfca.storage import Storage
from lfca.changesets import get_changesets
from lfca.logging_utils import get_logger

logger = get_logger(__name__)


class EdgeBuilder:
    def __init__(self, paths: RepoPaths, config: CouplingConfig):
        self.paths = paths
        self.config = config
        self.storage = Storage(paths.db_path, paths.parquet_dir)
    
    def build(self) -> int:
        """Build coupling edges from transactions."""
        
        # Load commits and changes from Parquet
        commits = self.storage.read_parquet("commits").to_pylist()
        changes = self.storage.read_parquet("changes").to_pylist()
        
        logger.info(f"Building edges from {len(commits)} commits...")
        
        # Get changesets based on grouping mode
        changesets = list(get_changesets(commits, changes, self.config))
        
        # Count pairs and file occurrences
        pair_counts: dict[tuple[int, int], float] = defaultdict(float)
        file_counts: Counter[int] = Counter()
        file_weights: dict[int, float] = defaultdict(float)
        
        for cs in changesets:
            file_ids = sorted(cs.file_ids)
            
            # Skip if too few files
            if len(file_ids) < 2:
                continue
            
            # Calculate weight
            weight = cs.weight
            if len(file_ids) > self.config.max_changeset_size:
                weight *= 1.0 / math.log(1.0 + len(file_ids))
            
            # Apply time decay if configured
            if self.config.decay_half_life_days and cs.timestamp:
                # Implemented in changesets module
                pass
            
            # Count pairs
            for a, b in combinations(file_ids, 2):
                pair_counts[(a, b)] += weight
            
            for fid in file_ids:
                file_counts[fid] += 1
                file_weights[fid] += weight
        
        logger.info(f"Counted {len(pair_counts)} file pairs")
        
        # Filter by min_cooccurrence
        min_cooc = self.config.min_cooccurrence
        filtered_pairs = {
            k: v for k, v in pair_counts.items()
            if v >= min_cooc
        }
        
        logger.info(f"After filtering: {len(filtered_pairs)} pairs")
        
        # Build edges with metrics
        edges = []
        for (src, dst), pair_count in filtered_pairs.items():
            src_count = file_counts[src]
            dst_count = file_counts[dst]
            src_weight = file_weights[src]
            dst_weight = file_weights[dst]
            
            # Jaccard (unweighted)
            denom = src_count + dst_count - pair_count
            jaccard = pair_count / denom if denom > 0 else 0
            
            # Weighted Jaccard
            denom_w = src_weight + dst_weight - pair_count
            jaccard_weighted = pair_count / denom_w if denom_w > 0 else 0
            
            # Conditional probabilities
            p_dst_given_src = pair_count / src_count if src_count > 0 else 0
            p_src_given_dst = pair_count / dst_count if dst_count > 0 else 0
            
            edges.append({
                "src_file_id": src,
                "dst_file_id": dst,
                "pair_count": pair_count,
                "src_count": src_count,
                "dst_count": dst_count,
                "src_weight": src_weight,
                "dst_weight": dst_weight,
                "jaccard": jaccard,
                "jaccard_weighted": jaccard_weighted,
                "p_dst_given_src": p_dst_given_src,
                "p_src_given_dst": p_src_given_dst
            })
        
        # Apply top-K per file
        if self.config.topk_edges_per_file:
            edges = self._apply_topk(edges)
        
        # Store in SQLite
        self.storage.upsert_edges(edges)
        
        # Build component-level edges
        self._build_component_edges(edges)
        
        logger.info(f"Stored {len(edges)} edges")
        return len(edges)
    
    def _apply_topk(self, edges: list[dict]) -> list[dict]:
        """Keep top-K edges per file."""
        k = self.config.topk_edges_per_file
        
        # Group by source and dest
        by_file: dict[int, list[dict]] = defaultdict(list)
        for e in edges:
            by_file[e["src_file_id"]].append(e)
            by_file[e["dst_file_id"]].append(e)
        
        # Keep top-K per file
        kept = set()
        for file_id, file_edges in by_file.items():
            sorted_edges = sorted(file_edges, key=lambda x: x["jaccard"], reverse=True)
            for e in sorted_edges[:k]:
                kept.add((e["src_file_id"], e["dst_file_id"]))
        
        return [e for e in edges if (e["src_file_id"], e["dst_file_id"]) in kept]
    
    def _build_component_edges(self, edges: list[dict]):
        """Aggregate edges at component/folder level."""
        depth = self.config.component_depth
        
        # Get file paths
        file_ids = set()
        for e in edges:
            file_ids.add(e["src_file_id"])
            file_ids.add(e["dst_file_id"])
        
        if not file_ids:
            return
        
        placeholders = ",".join("?" * len(file_ids))
        rows = self.storage.conn.execute(f"""
            SELECT file_id, path_current FROM files WHERE file_id IN ({placeholders})
        """, list(file_ids)).fetchall()
        
        file_to_path = {r[0]: r[1] for r in rows if r[1]}
        
        def get_component(path: str) -> str:
            parts = path.split("/")
            return "/".join(parts[:depth]) if len(parts) > depth else path
        
        file_to_comp = {fid: get_component(p) for fid, p in file_to_path.items()}
        
        # Aggregate
        comp_edges: dict[tuple[str, str], dict] = defaultdict(
            lambda: {"pair_count": 0.0, "jaccard_sum": 0.0, "file_pairs": 0}
        )
        
        for e in edges:
            src_comp = file_to_comp.get(e["src_file_id"])
            dst_comp = file_to_comp.get(e["dst_file_id"])
            
            if src_comp and dst_comp and src_comp != dst_comp:
                key = tuple(sorted([src_comp, dst_comp]))
                comp_edges[key]["pair_count"] += e["pair_count"]
                comp_edges[key]["jaccard_sum"] += e["jaccard"]
                comp_edges[key]["file_pairs"] += 1
        
        # Store
        for (src, dst), data in comp_edges.items():
            avg_jaccard = data["jaccard_sum"] / data["file_pairs"] if data["file_pairs"] else 0
            self.storage.conn.execute("""
                INSERT OR REPLACE INTO component_edges
                (src_component, dst_component, depth, pair_count, jaccard, file_pair_count)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (src, dst, depth, data["pair_count"], avg_jaccard, data["file_pairs"]))
        
        self.storage.conn.commit()
    
    def close(self):
        self.storage.close()
```

---

## 8. Frontend Updates ✅ DONE

### 8.1 Update API Client

**File: `frontend/src/api.ts`** (REPLACE)

```typescript
import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

// === Types ===

export interface RepoInfo {
    id: string;
    name: string;
    state: string;
    file_count: number;
    commit_count: number;
}

export interface FileInfo {
    file_id: number;
    path: string;
    exists_at_head: boolean;
    total_commits: number;
}

export interface CoupledFile {
    file_id: number;
    path: string;
    pair_count: number;
    jaccard: number;
    jaccard_weighted: number;
    p_dst_given_src: number;
    p_src_given_dst: number;
}

export interface ClusterResult {
    algorithm: string;
    parameters: Record<string, any>;
    cluster_count: number;
    clusters: Array<{
        id: number;
        size: number;
        files: string[];
    }>;
    metrics: Record<string, any>;
}

export interface AnalysisConfig {
    min_revisions?: number;
    max_changeset_size?: number;
    changeset_mode?: 'by_commit' | 'by_author_time' | 'by_ticket_id';
    min_cooccurrence?: number;
    window_days?: number;
}

export interface ClusterConfig {
    algorithm: string;
    weight_column?: string;
    min_weight?: number;
    folders?: string[];
    params?: Record<string, any>;
}

// === API Functions ===

export const getRepos = () => 
    api.get<RepoInfo[]>('/repos').then(res => res.data);

export const createRepo = (payload: { path: string; name?: string }) =>
    api.post<RepoInfo>('/repos', payload).then(res => res.data);

export const startAnalysis = (repoId: string, config: AnalysisConfig) =>
    api.post(`/repos/${repoId}/analysis/start`, config).then(res => res.data);

export const getAnalysisStatus = (repoId: string) =>
    api.get(`/repos/${repoId}/analysis/status`).then(res => res.data);

// Files - current structure only
export const getFileTree = (repoId: string) =>
    api.get(`/repos/${repoId}/files/tree`).then(res => res.data);

export const listFiles = (repoId: string, params?: { q?: string; current_only?: boolean }) =>
    api.get<FileInfo[]>(`/repos/${repoId}/files`, { params }).then(res => res.data);

export const getFolders = (repoId: string, depth?: number) =>
    api.get<string[]>(`/repos/${repoId}/folders`, { params: { depth } }).then(res => res.data);

// File history
export const getFileHistory = (repoId: string, path: string) =>
    api.get(`/repos/${repoId}/files/${encodeURIComponent(path)}/history`).then(res => res.data);

// Commit files
export const getCommitFiles = (repoId: string, commitOid: string) =>
    api.get(`/repos/${repoId}/commits/${commitOid}/files`).then(res => res.data);

// Co-changes in range
export const getCochanges = (repoId: string, path: string, since?: string, until?: string) =>
    api.get(`/repos/${repoId}/cochanges`, { 
        params: { path, since, until } 
    }).then(res => res.data);

// Global coupling
export const getCoupling = (repoId: string, path: string, params?: {
    metric?: string;
    min_weight?: number;
    limit?: number;
}) => api.get<CoupledFile[]>(`/repos/${repoId}/coupling`, { 
    params: { path, ...params } 
}).then(res => res.data);

export const getCouplingGraph = (repoId: string, path: string, params?: {
    metric?: string;
    min_weight?: number;
    limit?: number;
}) => api.get(`/repos/${repoId}/coupling/graph`, { 
    params: { path, ...params } 
}).then(res => res.data);

// Component coupling
export const getComponentCoupling = (repoId: string, component: string, depth?: number) =>
    api.get(`/repos/${repoId}/coupling/components`, { 
        params: { component, depth } 
    }).then(res => res.data);

// Clustering
export const getClusteringAlgorithms = (repoId: string) =>
    api.get<Array<{ name: string; params_schema: any }>>(`/repos/${repoId}/clustering/algorithms`)
        .then(res => res.data);

export const runClustering = (repoId: string, config: ClusterConfig) =>
    api.post<ClusterResult>(`/repos/${repoId}/clustering/run`, config).then(res => res.data);

export default api;
```

### 8.2 Update File Tree Component

**File: `frontend/src/components/FolderTree.tsx`** (REPLACE)

```tsx
import { useState, useEffect } from 'react';
import { getFileTree, getCoupling } from '../api';
import { Folder, File, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';

interface FolderTreeProps {
    repoId: string;
    onFileSelect?: (path: string) => void;
}

interface TreeNode {
    __type?: 'file' | 'dir';
    __children?: Record<string, TreeNode>;
    file_id?: number;
    commits?: number;
    [key: string]: any;
}

export default function FolderTree({ repoId, onFileSelect }: FolderTreeProps) {
    const [tree, setTree] = useState<Record<string, TreeNode>>({});
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadTree();
    }, [repoId]);

    const loadTree = async () => {
        setLoading(true);
        try {
            const data = await getFileTree(repoId);
            setTree(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = (path: string) => {
        const next = new Set(expanded);
        if (next.has(path)) {
            next.delete(path);
        } else {
            next.add(path);
        }
        setExpanded(next);
    };

    const renderNode = (name: string, node: TreeNode, path: string, depth: number) => {
        const fullPath = path ? `${path}/${name}` : name;
        const isDir = node.__type === 'dir' || node.__children;
        const isExpanded = expanded.has(fullPath);

        if (isDir) {
            const children = node.__children || {};
            return (
                <div key={fullPath}>
                    <div
                        className="flex items-center gap-1 py-1 px-2 hover:bg-slate-800 rounded cursor-pointer text-sm"
                        style={{ paddingLeft: `${depth * 16 + 8}px` }}
                        onClick={() => toggleExpand(fullPath)}
                    >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <Folder size={14} className="text-amber-400" />
                        <span className="text-slate-300">{name}</span>
                    </div>
                    {isExpanded && (
                        <div>
                            {Object.entries(children)
                                .sort(([a, nodeA], [b, nodeB]) => {
                                    const aIsDir = nodeA.__type === 'dir' || nodeA.__children;
                                    const bIsDir = nodeB.__type === 'dir' || nodeB.__children;
                                    if (aIsDir && !bIsDir) return -1;
                                    if (!aIsDir && bIsDir) return 1;
                                    return a.localeCompare(b);
                                })
                                .map(([childName, childNode]) =>
                                    renderNode(childName, childNode, fullPath, depth + 1)
                                )}
                        </div>
                    )}
                </div>
            );
        }

        // File node
        return (
            <div
                key={fullPath}
                className="flex items-center gap-1 py-1 px-2 hover:bg-slate-800 rounded cursor-pointer text-sm"
                style={{ paddingLeft: `${depth * 16 + 24}px` }}
                onClick={() => onFileSelect?.(fullPath)}
            >
                <File size={14} className="text-sky-400" />
                <span className="text-slate-400">{name}</span>
                {node.commits && (
                    <span className="text-xs text-slate-600 ml-auto">{node.commits}</span>
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-slate-500" />
            </div>
        );
    }

    return (
        <div className="p-4 overflow-auto">
            <h3 className="text-sm font-bold text-slate-400 mb-4">Current Files</h3>
            <div className="font-mono text-xs">
                {Object.entries(tree)
                    .sort(([a, nodeA], [b, nodeB]) => {
                        const aIsDir = nodeA.__type === 'dir' || nodeA.__children;
                        const bIsDir = nodeB.__type === 'dir' || nodeB.__children;
                        if (aIsDir && !bIsDir) return -1;
                        if (!aIsDir && bIsDir) return 1;
                        return a.localeCompare(b);
                    })
                    .map(([name, node]) => renderNode(name, node, '', 0))}
            </div>
        </div>
    );
}
```

### 8.3 Update Clustering View

**File: `frontend/src/components/ClusteringView.tsx`** (REPLACE)

```tsx
import { useState, useEffect } from 'react';
import { getClusteringAlgorithms, runClustering, getFolders, type ClusterResult } from '../api';
import { Box, Play, Loader2, Settings } from 'lucide-react';

interface ClusteringViewProps {
    repoId: string;
}

interface AlgorithmInfo {
    name: string;
    params_schema: {
        properties: Record<string, { type: string; default?: any; description?: string }>;
    };
}

export default function ClusteringView({ repoId }: ClusteringViewProps) {
    const [algorithms, setAlgorithms] = useState<AlgorithmInfo[]>([]);
    const [selectedAlgo, setSelectedAlgo] = useState('louvain');
    const [weightColumn, setWeightColumn] = useState('jaccard');
    const [minWeight, setMinWeight] = useState(0.1);
    const [folders, setFolders] = useState('');
    const [params, setParams] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<ClusterResult | null>(null);
    const [availableFolders, setAvailableFolders] = useState<string[]>([]);

    useEffect(() => {
        loadAlgorithms();
        loadFolders();
    }, [repoId]);

    const loadAlgorithms = async () => {
        try {
            const data = await getClusteringAlgorithms(repoId);
            setAlgorithms(data);
        } catch (e) {
            console.error(e);
        }
    };

    const loadFolders = async () => {
        try {
            const data = await getFolders(repoId, 2);
            setAvailableFolders(data);
        } catch (e) {
            console.error(e);
        }
    };

    const handleRun = async () => {
        setLoading(true);
        setResults(null);
        try {
            const result = await runClustering(repoId, {
                algorithm: selectedAlgo,
                weight_column: weightColumn,
                min_weight: minWeight,
                folders: folders.split(',').map(f => f.trim()).filter(Boolean),
                params
            });
            setResults(result);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const selectedSchema = algorithms.find(a => a.name === selectedAlgo)?.params_schema;

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8">
                <div className="flex items-center gap-2 text-sky-400 font-bold mb-6">
                    <Box size={24} />
                    <h2 className="text-xl">Clustering Analysis</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Algorithm</label>
                        <select
                            value={selectedAlgo}
                            onChange={(e) => {
                                setSelectedAlgo(e.target.value);
                                setParams({});
                            }}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2"
                        >
                            {algorithms.map(a => (
                                <option key={a.name} value={a.name}>{a.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Weight Metric</label>
                        <select
                            value={weightColumn}
                            onChange={(e) => setWeightColumn(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2"
                        >
                            <option value="jaccard">Jaccard Similarity</option>
                            <option value="jaccard_weighted">Weighted Jaccard</option>
                            <option value="p_dst_given_src">P(B|A)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Min Weight</label>
                        <input
                            type="number"
                            step="0.05"
                            min="0"
                            max="1"
                            value={minWeight}
                            onChange={(e) => setMinWeight(parseFloat(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2"
                        />
                    </div>
                </div>

                {/* Algorithm-specific parameters */}
                {selectedSchema && Object.keys(selectedSchema.properties).length > 0 && (
                    <div className="mb-6">
                        <div className="flex items-center gap-2 text-slate-400 text-sm font-medium mb-3">
                            <Settings size={16} />
                            Algorithm Parameters
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {Object.entries(selectedSchema.properties).map(([key, prop]) => (
                                <div key={key}>
                                    <label className="block text-xs text-slate-500 mb-1">
                                        {key} {prop.description && `- ${prop.description}`}
                                    </label>
                                    <input
                                        type={prop.type === 'number' || prop.type === 'integer' ? 'number' : 'text'}
                                        step={prop.type === 'number' ? '0.1' : undefined}
                                        value={params[key] ?? prop.default ?? ''}
                                        onChange={(e) => setParams({
                                            ...params,
                                            [key]: prop.type === 'number' || prop.type === 'integer'
                                                ? parseFloat(e.target.value)
                                                : e.target.value
                                        })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                        Filter to folders (comma-separated)
                    </label>
                    <input
                        type="text"
                        placeholder="e.g. src/api, src/hooks"
                        value={folders}
                        onChange={(e) => setFolders(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2"
                        list="folder-suggestions"
                    />
                    <datalist id="folder-suggestions">
                        {availableFolders.map(f => <option key={f} value={f} />)}
                    </datalist>
                </div>

                <button
                    onClick={handleRun}
                    disabled={loading}
                    className="w-full py-3 bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 text-slate-900 font-bold rounded-xl transition-all flex justify-center items-center gap-2"
                >
                    {loading ? <Loader2 size={20} className="animate-spin" /> : <Play size={20} fill="currentColor" />}
                    Run {selectedAlgo} Clustering
                </button>
            </div>

            {results && (
                <div className="space-y-4">
                    <div className="flex justify-between items-end mb-2">
                        <h3 className="text-lg font-bold">
                            {results.cluster_count} Clusters Found
                        </h3>
                        {results.metrics.modularity && (
                            <span className="text-sm text-slate-400">
                                Modularity: {results.metrics.modularity.toFixed(3)}
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {results.clusters.map((cluster) => (
                            <div key={cluster.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-sky-400 font-bold">Cluster {cluster.id}</span>
                                    <span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-400">
                                        {cluster.size} files
                                    </span>
                                </div>
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {cluster.files.slice(0, 10).map((f, j) => (
                                        <div key={j} className="text-xs text-slate-400 truncate font-mono">{f}</div>
                                    ))}
                                    {cluster.size > 10 && (
                                        <div className="text-[10px] text-slate-600">...and {cluster.size - 10} more</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
```

---

## 9. File Summary ✅ DONE

### New Files
| File | Description |
|------|-------------|
| `lfca/schema.py` | Database schema definitions |
| `lfca/sync.py` | HEAD file synchronization |
| `lfca/changesets.py` | Changeset grouping strategies |
| `lfca/runner.py` | Analysis run management |
| `lfca/clustering/__init__.py` | Clustering package init |
| `lfca/clustering/base.py` | Base clustering interface |
| `lfca/clustering/registry.py` | Algorithm registry |
| `lfca/clustering/components.py` | Connected components |
| `lfca/clustering/louvain.py` | Louvain algorithm |
| `lfca/clustering/label_propagation.py` | Label propagation |
| `lfca/clustering/hierarchical.py` | Hierarchical clustering |
| `lfca/clustering/dbscan.py` | DBSCAN clustering |

### Modified Files
| File | Changes |
|------|---------|
| `lfca/config.py` | Add CouplingConfig, simplify RepoPaths |
| `lfca/storage.py` | Replace with unified storage layer |
| `lfca/git.py` | Add ref parameter, get_head_oid |
| `lfca/extract.py` | Use new storage, sync HEAD |
| `lfca/edges.py` | New metrics, component edges |
| `lfca/api.py` | All new endpoints |
| `frontend/src/api.ts` | New API client |
| `frontend/src/components/FolderTree.tsx` | Current files only |
| `frontend/src/components/ClusteringView.tsx` | Multi-algorithm support |

### Deleted Files
| File | Reason |
|------|--------|
| `lfca/indexes.py` | Merged into storage.py |
| `lfca/cluster.py` | Replaced by clustering package |

---

## 10. Dependencies ✅ DONE

Add to `pyproject.toml`:

```toml
[project]
dependencies = [
    "pyarrow>=14.0.0",
]

[project.optional-dependencies]
api = [
    "fastapi>=0.110.0",
    "uvicorn>=0.27.0",
    "pydantic>=2.6.0",
]
clustering = [
    "networkx>=3.0",
    "python-louvain>=0.16",
    "scipy>=1.10.0",
    "scikit-learn>=1.3.0",
    "numpy>=1.24.0",
]
all = [
    "lfca[api,clustering]",
]
```

---

## 11. Migration Script ✅ DONE

**File: `scripts/migrate_v2.py`** (NEW)

```python
#!/usr/bin/env python3
"""Migrate from v1 to v2 storage format."""

import sqlite3
from pathlib import Path
import pyarrow.parquet as pq

def migrate_repo(repo_path: Path):
    """Migrate a single repository."""
    old_db = repo_path / "artifacts/v1/indexes/file_index.sqlite"
    new_db = repo_path / "lfca.sqlite"
    
    if not old_db.exists():
        print(f"No v1 data found in {repo_path}")
        return
    
    print(f"Migrating {repo_path}...")
    
    # Create new schema
    from lfca.schema import init_database
    new_conn = init_database(new_db)
    
    # Migrate files
    old_conn = sqlite3.connect(old_db)
    rows = old_conn.execute("""
        SELECT file_id, path_current, path_latest FROM file_index
    """).fetchall()
    
    for file_id, path_current, path_latest in rows:
        new_conn.execute("""
            INSERT INTO files (file_id, path_current, path_latest)
            VALUES (?, ?, ?)
        """, (file_id, path_current, path_latest or path_current))
    
    # Migrate edges from Parquet
    edges_parquet = repo_path / "artifacts/v1/edges/edges_file_topk.parquet"
    if edges_parquet.exists():
        table = pq.read_table(edges_parquet)
        for row in table.to_pylist():
            new_conn.execute("""
                INSERT OR IGNORE INTO edges (
                    src_file_id, dst_file_id, pair_count,
                    src_count, dst_count, src_weight, dst_weight,
                    jaccard, jaccard_weighted, p_dst_given_src, p_src_given_dst
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                row["src_file_id"], row["dst_file_id"], row["pair_count"],
                row["src_count"], row["dst_count"], 
                row.get("src_weight", row["src_count"]),
                row.get("dst_weight", row["dst_count"]),
                row["weight_jaccard"], row["weight_jaccard"],
                row["pair_count"] / row["src_count"] if row["src_count"] else 0,
                row["pair_count"] / row["dst_count"] if row["dst_count"] else 0,
            ))
    
    new_conn.commit()
    new_conn.close()
    old_conn.close()
    
    print(f"  Migrated {len(rows)} files")


if __name__ == "__main__":
    import sys
    data_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "data")
    
    repos_dir = data_dir / "repos"
    if repos_dir.exists():
        for repo_dir in repos_dir.iterdir():
            if repo_dir.is_dir():
                migrate_repo(repo_dir)
```

---

## 12. Execution Order ✅ DONE

1. **Create new files** (schema.py, sync.py, changesets.py, clustering/*)
2. **Update storage.py** and **config.py**
3. **Update git.py** with ref support
4. **Update extract.py** to use new storage + sync HEAD
5. **Create edges.py** with new metrics
6. **Create runner.py** for run management
7. **Replace api.py** with new endpoints
8. **Update frontend** (api.ts, components)
9. **Run migration script** for existing data
10. **Test all endpoints**
