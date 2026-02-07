"""Database schema definitions for Code Intelligence Platform."""

import sqlite3
from pathlib import Path

SCHEMA_VERSION = 1  # Clean slate - no legacy migrations

TABLES = """
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

-- ─────────────────────────────────────────────────────────────────────
-- CORE: Repository & Project Management
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS repo_meta (
    key   TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS schema_info (
    key   TEXT PRIMARY KEY,
    value TEXT
);

-- ─────────────────────────────────────────────────────────────────────
-- CORE: Code Entities (files, classes, functions, packages)
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS entities (
    entity_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    kind            TEXT NOT NULL,           -- 'file','class','function','module','package','external_package'
    name            TEXT NOT NULL,           -- short name
    qualified_name  TEXT,                    -- full path or qualified name (unique for files)
    language        TEXT,                    -- 'python','typescript','csharp','java'
    parent_id       INTEGER REFERENCES entities(entity_id),  -- file for class, class for method
    line_start      INTEGER,
    line_end        INTEGER,
    exists_at_head  BOOLEAN DEFAULT TRUE,
    metadata_json   TEXT,                    -- extensible (LOC, complexity, etc.)
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_entities_qualified
    ON entities(qualified_name) WHERE qualified_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entities_kind ON entities(kind);
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
CREATE INDEX IF NOT EXISTS idx_entities_parent ON entities(parent_id);
CREATE INDEX IF NOT EXISTS idx_entities_language ON entities(language);

-- ─────────────────────────────────────────────────────────────────────
-- CORE: Relationships (unified edges — ALL source types)
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS relationships (
    rel_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type     TEXT NOT NULL,           -- 'git','deps','semantic','intelligence'
    rel_kind        TEXT NOT NULL,           -- 'CO_CHANGED','IMPORTS','SIMILAR_TO', etc.
    src_entity_id   INTEGER NOT NULL REFERENCES entities(entity_id),
    dst_entity_id   INTEGER NOT NULL REFERENCES entities(entity_id),
    weight          REAL DEFAULT 1.0,
    properties_json TEXT,                    -- source-specific extra data
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

-- ─────────────────────────────────────────────────────────────────────
-- CORE: Analysis Task Tracking
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS analysis_tasks (
    task_id         TEXT PRIMARY KEY,
    analyzer_type   TEXT NOT NULL,
    state           TEXT NOT NULL DEFAULT 'pending',  -- pending/running/completed/failed
    config_json     TEXT,
    progress        REAL DEFAULT 0.0,        -- 0.0 to 1.0
    stage           TEXT,                    -- human-readable stage description
    entity_count    INTEGER DEFAULT 0,
    relationship_count INTEGER DEFAULT 0,
    metrics_json    TEXT,                     -- analyzer-specific result metrics
    started_at      TEXT,
    finished_at     TEXT,
    error           TEXT,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_type ON analysis_tasks(analyzer_type);
CREATE INDEX IF NOT EXISTS idx_tasks_state ON analysis_tasks(state);

-- ─────────────────────────────────────────────────────────────────────
-- GIT ANALYZER: Git-specific tables
-- ─────────────────────────────────────────────────────────────────────

-- File rename/move history
CREATE TABLE IF NOT EXISTS git_file_lineage (
    entity_id           INTEGER NOT NULL REFERENCES entities(entity_id),
    path                TEXT NOT NULL,
    start_commit_oid    TEXT NOT NULL,
    end_commit_oid      TEXT,
    PRIMARY KEY (entity_id, path, start_commit_oid)
);

CREATE INDEX IF NOT EXISTS idx_git_lineage_entity ON git_file_lineage(entity_id);

-- Git coupling edges (co-change relationships)
CREATE TABLE IF NOT EXISTS git_edges (
    src_entity_id       INTEGER NOT NULL REFERENCES entities(entity_id),
    dst_entity_id       INTEGER NOT NULL REFERENCES entities(entity_id),
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

-- Component-level coupling (folder-level aggregates)
CREATE TABLE IF NOT EXISTS git_component_edges (
    src_component       TEXT NOT NULL,
    dst_component       TEXT NOT NULL,
    depth               INTEGER NOT NULL,
    pair_count          REAL NOT NULL,
    jaccard             REAL NOT NULL,
    file_pair_count     INTEGER NOT NULL,
    PRIMARY KEY (src_component, dst_component, depth)
);

-- Git clustering results
CREATE TABLE IF NOT EXISTS git_clusters (
    cluster_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id          TEXT NOT NULL,
    label           TEXT,
    size            INTEGER NOT NULL,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS git_cluster_members (
    cluster_id      INTEGER NOT NULL REFERENCES git_clusters(cluster_id),
    entity_id       INTEGER NOT NULL REFERENCES entities(entity_id),
    PRIMARY KEY (cluster_id, entity_id)
);

-- Git clustering run metadata
CREATE TABLE IF NOT EXISTS git_cluster_runs (
    run_id          TEXT PRIMARY KEY,
    algorithm       TEXT NOT NULL,
    params_json     TEXT,
    cluster_count   INTEGER NOT NULL,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Clustering snapshots (saved/named clustering results)
CREATE TABLE IF NOT EXISTS git_clustering_snapshots (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    algorithm       TEXT,
    result_json     TEXT,
    tags_json       TEXT,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────────
-- VALIDATION & DIAGNOSTICS
-- ─────────────────────────────────────────────────────────────────────

-- Validation issues during analysis
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
    """Initialize database with schema."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row  # Enable dict-like row access
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA foreign_keys=ON")
    
    # Create all tables
    conn.executescript(TABLES)
    
    # Set schema version
    conn.execute(
        "INSERT OR REPLACE INTO schema_info (key, value) VALUES ('version', ?)",
        (str(SCHEMA_VERSION),)
    )
    conn.commit()
    return conn
