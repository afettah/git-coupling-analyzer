"""Database schema definitions for LFCA."""

import sqlite3
from pathlib import Path

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

-- Repository metadata
CREATE TABLE IF NOT EXISTS repo_meta (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_info (
    key TEXT PRIMARY KEY,
    value TEXT
);
"""

def init_database(db_path: Path) -> sqlite3.Connection:
    """Initialize database with schema."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
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
