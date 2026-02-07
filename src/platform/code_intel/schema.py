"""Database schema definitions for LFCA."""

import sqlite3
from pathlib import Path

SCHEMA_VERSION = 3

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
    kind            TEXT NOT NULL,           -- 'file','class','function','module','package'
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
-- GIT ANALYZER: Validation & Clustering
-- ─────────────────────────────────────────────────────────────────────

-- Validation log
CREATE TABLE IF NOT EXISTS validation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    commit_oid TEXT,
    issue_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    token_value TEXT,
    expected_value TEXT,
    message TEXT NOT NULL,
    author TEXT,
    committed_at INTEGER,
    subject TEXT,
    cursor_position INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Component-level coupling (Aggregated view)
CREATE TABLE IF NOT EXISTS component_edges (
    src_component TEXT NOT NULL,
    dst_component TEXT NOT NULL,
    depth INTEGER NOT NULL,
    pair_count REAL NOT NULL,
    jaccard REAL NOT NULL,
    file_pair_count INTEGER NOT NULL,
    PRIMARY KEY (src_component, dst_component, depth)
);

-- Clustering snapshots (saved results)
CREATE TABLE IF NOT EXISTS clustering_snapshots (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    algorithm   TEXT,
    result_json TEXT,
    tags_json   TEXT,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Legacy path mapping (lineage for renames)
CREATE TABLE IF NOT EXISTS file_lineage (
    file_id INTEGER NOT NULL REFERENCES entities(entity_id),
    path TEXT NOT NULL,
    start_commit_oid TEXT,
    end_commit_oid TEXT,
    PRIMARY KEY (file_id, path)
);
"""

def init_database(db_path: Path) -> sqlite3.Connection:
    """Initialize database with schema and handle migrations."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA foreign_keys=ON")
    
    # Simple migration: just check version
    try:
        row = conn.execute("SELECT value FROM schema_info WHERE key = 'version'").fetchone()
        current_version = int(row[0]) if row else 0
    except sqlite3.OperationalError:
        current_version = 0
        
    if current_version < SCHEMA_VERSION:
        # For now, we just re-run the script (idempotent CREATE TABLE IF NOT EXISTS)
        # In a real app, we'd have ALTER TABLE statements here.
        conn.executescript(TABLES)
        conn.execute(
            "INSERT OR REPLACE INTO schema_info (key, value) VALUES ('version', ?)",
            (str(SCHEMA_VERSION),)
        )
        conn.commit()
        
    return conn
