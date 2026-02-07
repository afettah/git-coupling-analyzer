# Database Schema & Entity Lifecycle

> **Status**: Partially Implemented — git tables done, multi-analyzer tables pending

---

## Implementation Status

### ✅ Implemented (in `src/platform/code_intel/schema.py`)
- `files` table (file_id, path_current, path_latest, exists_at_head, commit tracking)
- `file_lineage` table (rename/move history)
- `edges` table (coupling metrics: jaccard, pair_count, conditional probabilities)
- `component_edges` table (folder-level coupling)
- `clusters` + `cluster_runs` tables
- `analysis_runs` table (state, config, counts, timing)
- `validation_log` table (parsing issues tracking)
- `repo_meta` + `schema_info` tables
- `init_database()` function with proper indexes and pragmas
- `Storage` class with file operations, edge queries, parquet I/O — `src/platform/code_intel/storage.py`

### 🔧 TODO
- [ ] Add `entities` table (generic entity model for all analyzers — currently only `files` exists)
- [ ] Add `relationships` table (generic multi-source relationships — currently only `edges` for git)
- [ ] Add `analysis_tasks` table for multi-analyzer task tracking (current `analysis_runs` is git-specific)
- [ ] Add `dep_imports`, `dep_cycles` tables for dependency analyzer
- [ ] Add `sem_tokens`, `sem_domains`, `sem_domain_members` tables for semantic analyzer
- [ ] Add `intel_risk_scores` table for intelligence analyzer
- [ ] Implement `get_or_create_entity(qualified_name, kind)` helper for cross-analyzer entity reuse

### ⚠️ Issues
- Design says `entities` + `relationships` as core tables; implementation has `files` + `edges` — these are git-specific, not generic. Need to decide: add generic tables alongside, or rename existing?
- DB filename: code uses `lfca.sqlite` (`src/platform/code_intel/config.py`), design says `code-intel.sqlite`
- No migration system — schema changes require manual DB re-creation

### 💡 Improvements
- Add schema migration support (e.g., alembic-lite or versioned SQL scripts)
- Add `SCHEMA_VERSION` check on DB open to detect stale schemas

---

## Design principles

- Single SQLite file per repository at `data/repos/{repo_id}/code-intel.sqlite`.
- All analyzers write to the same DB (schema owned by platform).
- Analyzer-specific tables are allowed (prefixed `git_`, `dep_`, `sem_`).
- Parquet is used for bulk data (commits, changesets) in `data/repos/{repo_id}/parquet/`.

## Complete schema (essential parts)

The platform schema includes core tables for `entities`, `relationships`, `analysis_tasks`, and analyzer-specific tables (`git_edges`, `dep_imports`, `sem_tokens`, `sem_domains`, `intel_risk_scores`, etc.). The platform uses indexes and pragmas (WAL, foreign_keys) for performance and integrity.

(Full SQL DDL is long; keep canonical schema in the codebase under `platform/code_intel/schema.py`.)

### Git-specific tables
- `git_file_lineage` — file rename/move history
- `git_edges` — coupling metrics (jaccard, pair_count, p_dst_given_src)
- `git_clusters`, `git_cluster_runs` — clustering run metadata and memberships

### Dep-specific tables
- `dep_imports` — import details including symbols and import_type
- `dep_cycles` — detected circular dependency chains

### Semantic-specific tables
- `sem_tokens` — extracted tokens with tf-idf
- `sem_domains` — discovered domains
- `sem_domain_members` — domain membership affinities

### Intelligence tables
- `intel_risk_scores` — per-entity computed risk signals and overall score

## Entity lifecycle

1. Git analyzer runs first and creates `entities` for every file (`qualified_name = path`) and writes `git_edges` / `CO_CHANGED` relationships.
2. Dep analyzer runs second, re-using files by `qualified_name`, creates external entities for packages, writes `dep_imports` and `IMPORTS` relationships.
3. Semantic analyzer runs third, writes `sem_tokens`, `SIMILAR_TO` relationships, and `sem_domains` + `sem_domain_members`.
4. Intelligence runs last and computes `intel_risk_scores` reading across sources.

Key rule: `get_or_create_entity(qualified_name, kind)` — prevents duplicate file entities across analyzers.

---

*For the canonical SQL DDL, see `platform/code_intel/schema.py`.*