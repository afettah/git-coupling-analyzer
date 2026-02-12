"""Database schema definitions for Code Intelligence Platform."""

from __future__ import annotations

import sqlite3
import threading
import time
from pathlib import Path

SCHEMA_VERSION = 3

_SCHEMA_INIT_LOCK = threading.Lock()
_SCHEMA_READY: set[str] = set()

TABLES = """
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS repo_meta (
    key   TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS schema_info (
    key   TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS entities (
    entity_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    kind            TEXT NOT NULL,
    name            TEXT NOT NULL,
    qualified_name  TEXT,
    language        TEXT,
    parent_id       INTEGER REFERENCES entities(entity_id) ON DELETE SET NULL,
    line_start      INTEGER,
    line_end        INTEGER,
    exists_at_head  BOOLEAN DEFAULT TRUE,
    metadata_json   TEXT,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_entities_kind ON entities(kind);
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
CREATE INDEX IF NOT EXISTS idx_entities_parent ON entities(parent_id);
CREATE INDEX IF NOT EXISTS idx_entities_language ON entities(language);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entities_qualified
  ON entities(qualified_name, kind)
  WHERE qualified_name IS NOT NULL;

CREATE TABLE IF NOT EXISTS relationships (
    rel_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type     TEXT NOT NULL,
    rel_kind        TEXT NOT NULL,
    src_entity_id   INTEGER NOT NULL REFERENCES entities(entity_id) ON DELETE CASCADE,
    dst_entity_id   INTEGER NOT NULL REFERENCES entities(entity_id) ON DELETE CASCADE,
    weight          REAL DEFAULT 1.0,
    properties_json TEXT,
    run_id          TEXT,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rel_source ON relationships(source_type);
CREATE INDEX IF NOT EXISTS idx_rel_kind ON relationships(rel_kind);
CREATE INDEX IF NOT EXISTS idx_rel_src ON relationships(src_entity_id);
CREATE INDEX IF NOT EXISTS idx_rel_dst ON relationships(dst_entity_id);
CREATE INDEX IF NOT EXISTS idx_rel_weight ON relationships(weight DESC);
CREATE INDEX IF NOT EXISTS idx_rel_kind_src ON relationships(rel_kind, src_entity_id);
CREATE INDEX IF NOT EXISTS idx_rel_src_source ON relationships(src_entity_id, source_type);

CREATE TABLE IF NOT EXISTS analysis_configs (
    config_id           TEXT PRIMARY KEY,
    repo_id             TEXT NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    analyzer_type       TEXT NOT NULL DEFAULT 'git',
    preset_id           TEXT,
    config_json         TEXT NOT NULL DEFAULT '{}',
    include_patterns    TEXT NOT NULL DEFAULT '[]',
    exclude_patterns    TEXT NOT NULL DEFAULT '[]',
    is_active           BOOLEAN NOT NULL DEFAULT FALSE,
    is_preset           BOOLEAN DEFAULT FALSE,

    created_at          TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_configs_repo ON analysis_configs(repo_id);
CREATE INDEX IF NOT EXISTS idx_configs_type ON analysis_configs(analyzer_type);
CREATE INDEX IF NOT EXISTS idx_configs_preset ON analysis_configs(is_preset);
CREATE UNIQUE INDEX IF NOT EXISTS idx_configs_active_per_repo
  ON analysis_configs(repo_id)
  WHERE is_active = 1;

CREATE TABLE IF NOT EXISTS analysis_tasks (
    task_id             TEXT PRIMARY KEY,
    analyzer_type       TEXT NOT NULL,
    state               TEXT NOT NULL DEFAULT 'pending',
    config_json         TEXT,
    config_id           TEXT REFERENCES analysis_configs(config_id) ON DELETE SET NULL,
    progress            REAL DEFAULT 0.0,
    stage               TEXT,
    entity_count        INTEGER DEFAULT 0,
    relationship_count  INTEGER DEFAULT 0,
    metrics_json        TEXT,
    started_at          TEXT,
    finished_at         TEXT,
    error               TEXT,
    created_at          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_type ON analysis_tasks(analyzer_type);
CREATE INDEX IF NOT EXISTS idx_tasks_state ON analysis_tasks(state);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON analysis_tasks(created_at DESC);

CREATE TABLE IF NOT EXISTS project_scan (
    scan_id             TEXT PRIMARY KEY,
    repo_id             TEXT NOT NULL,
    repo_path           TEXT NOT NULL,
    scanned_at          TEXT DEFAULT CURRENT_TIMESTAMP,
    commit_oid          TEXT,
    branch_name         TEXT,
    total_files         INTEGER NOT NULL,
    total_dirs          INTEGER NOT NULL DEFAULT 0,
    commit_count        INTEGER,
    unique_authors      INTEGER,
    first_commit_ts     INTEGER,
    last_commit_ts      INTEGER,
    first_commit_date   TEXT,
    last_commit_date    TEXT,
    extensions_json     TEXT,
    languages_json      TEXT,
    frameworks_json     TEXT,
    metadata_json       TEXT
);

CREATE INDEX IF NOT EXISTS idx_scan_repo ON project_scan(repo_id);
CREATE INDEX IF NOT EXISTS idx_scan_time ON project_scan(scanned_at DESC);

CREATE TABLE IF NOT EXISTS project_tree (
    scan_id         TEXT NOT NULL REFERENCES project_scan(scan_id) ON DELETE CASCADE,
    repo_id         TEXT NOT NULL,
    path            TEXT NOT NULL,
    name            TEXT NOT NULL,
    node_type       TEXT NOT NULL,
    extension       TEXT,
    language        TEXT,
    size_bytes      INTEGER,
    depth           INTEGER NOT NULL,
    parent_path     TEXT,
    PRIMARY KEY (scan_id, path)
);

CREATE INDEX IF NOT EXISTS idx_tree_scan ON project_tree(scan_id);
CREATE INDEX IF NOT EXISTS idx_tree_repo ON project_tree(repo_id);
CREATE INDEX IF NOT EXISTS idx_tree_type ON project_tree(node_type);
CREATE INDEX IF NOT EXISTS idx_tree_parent ON project_tree(parent_path);
CREATE INDEX IF NOT EXISTS idx_tree_language ON project_tree(language);

CREATE TABLE IF NOT EXISTS git_file_lineage (
    entity_id           INTEGER NOT NULL REFERENCES entities(entity_id) ON DELETE CASCADE,
    path                TEXT NOT NULL,
    start_commit_oid    TEXT NOT NULL,
    end_commit_oid      TEXT,
    PRIMARY KEY (entity_id, path, start_commit_oid)
);

CREATE INDEX IF NOT EXISTS idx_git_lineage_entity ON git_file_lineage(entity_id);

CREATE TABLE IF NOT EXISTS git_edges (
    src_entity_id       INTEGER NOT NULL REFERENCES entities(entity_id) ON DELETE CASCADE,
    dst_entity_id       INTEGER NOT NULL REFERENCES entities(entity_id) ON DELETE CASCADE,
    pair_count          REAL NOT NULL,
    src_count           INTEGER NOT NULL,
    dst_count           INTEGER NOT NULL,
    src_weight          REAL NOT NULL,
    dst_weight          REAL NOT NULL,
    jaccard             REAL NOT NULL,
    jaccard_weighted    REAL NOT NULL,
    p_dst_given_src     REAL NOT NULL,
    p_src_given_dst     REAL NOT NULL,
    PRIMARY KEY (src_entity_id, dst_entity_id)
);

CREATE INDEX IF NOT EXISTS idx_git_edges_src ON git_edges(src_entity_id);
CREATE INDEX IF NOT EXISTS idx_git_edges_dst ON git_edges(dst_entity_id);
CREATE INDEX IF NOT EXISTS idx_git_edges_jaccard ON git_edges(jaccard DESC);

CREATE TABLE IF NOT EXISTS git_component_edges (
    src_component       TEXT NOT NULL,
    dst_component       TEXT NOT NULL,
    depth               INTEGER NOT NULL,
    pair_count          REAL NOT NULL,
    jaccard             REAL NOT NULL,
    file_pair_count     INTEGER NOT NULL,
    PRIMARY KEY (src_component, dst_component, depth)
);

CREATE TABLE IF NOT EXISTS git_clusters (
    cluster_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id          TEXT NOT NULL,
    label           TEXT,
    size            INTEGER NOT NULL,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS git_cluster_members (
    cluster_id      INTEGER NOT NULL REFERENCES git_clusters(cluster_id) ON DELETE CASCADE,
    entity_id       INTEGER NOT NULL REFERENCES entities(entity_id) ON DELETE CASCADE,
    PRIMARY KEY (cluster_id, entity_id)
);

CREATE TABLE IF NOT EXISTS git_cluster_runs (
    run_id          TEXT PRIMARY KEY,
    algorithm       TEXT NOT NULL,
    params_json     TEXT,
    cluster_count   INTEGER NOT NULL,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS git_clustering_snapshots (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    algorithm       TEXT,
    result_json     TEXT,
    tags_json       TEXT,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS validation_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id          TEXT NOT NULL,
    commit_oid      TEXT,
    issue_type      TEXT NOT NULL,
    severity        TEXT NOT NULL,
    token_value     TEXT,
    expected_value  TEXT,
    message         TEXT NOT NULL,
    author          TEXT,
    committed_at    INTEGER,
    subject         TEXT,
    cursor_position INTEGER,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_validation_run ON validation_log(run_id);
CREATE INDEX IF NOT EXISTS idx_validation_severity ON validation_log(severity);
"""


def init_database(db_path: Path) -> sqlite3.Connection:
    """Initialize database with the current schema."""
    db_path.parent.mkdir(parents=True, exist_ok=True)

    key = str(db_path.resolve())
    with _SCHEMA_INIT_LOCK:
        needs_schema_init = key not in _SCHEMA_READY

    if needs_schema_init:
        _ensure_schema_initialized(db_path)
        with _SCHEMA_INIT_LOCK:
            _SCHEMA_READY.add(key)

    conn = _open_connection(db_path)
    return conn


def _open_connection(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=30000")
    return conn


def _ensure_schema_initialized(db_path: Path) -> None:
    max_attempts = 8
    last_error: Exception | None = None

    for attempt in range(max_attempts):
        conn: sqlite3.Connection | None = None
        try:
            conn = _open_connection(db_path)
            conn.executescript(TABLES)
            row = conn.execute(
                "SELECT value FROM schema_info WHERE key = 'version'"
            ).fetchone()
            current_version = str(row[0]) if row and row[0] is not None else None
            if current_version != str(SCHEMA_VERSION):
                conn.execute(
                    "INSERT OR REPLACE INTO schema_info (key, value) VALUES ('version', ?)",
                    (str(SCHEMA_VERSION),),
                )
            conn.commit()
            return
        except sqlite3.OperationalError as exc:
            last_error = exc
            if "locked" not in str(exc).lower():
                raise
            if attempt >= max_attempts - 1:
                break
            time.sleep(min(1.0, 0.05 * (2 ** attempt)))
        finally:
            if conn is not None:
                conn.close()

    if last_error is not None:
        raise last_error


def reset_schema_cache() -> None:
    """Test helper to force re-initialization in long-lived processes."""
    with _SCHEMA_INIT_LOCK:
        _SCHEMA_READY.clear()
