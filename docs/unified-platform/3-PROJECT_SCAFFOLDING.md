# Project Scaffolding & Migration

> **Status**: Phase 1 ~80% complete

---

## Implementation Status

### ✅ Implemented
- Monorepo layout created: `src/platform/`, `src/git-analyzer/`, `src/dep-analyzer/`, `src/semantic-analyzer/`, `src/project-intelligence/`, `src/frontend/`
- `pyproject.toml` for each project with correct names and deps
- `BaseAnalyzer` + analyzer-specific APIs defined in `src/platform/code_intel/interfaces/`
- `schema.py` with unified DDL (files, edges, clusters, analysis_runs, etc.) in `src/platform/code_intel/schema.py`
- `storage.py` with full file/edge/parquet operations in `src/platform/code_intel/storage.py`
- `registry.py` + `orchestrator.py` implemented in `src/platform/code_intel/`
- Git extraction, edges, clustering fully moved to `src/git-analyzer/git_analyzer/`
- `GitPlugin` + `GitAPI` implemented and registered in `src/git-analyzer/git_analyzer/plugin.py`
- Platform routers: `repos.py`, `git.py`, `analyzers.py` in `src/platform/code_intel/routers/`
- Frontend with full routing, API clients, and feature shells

### 🔧 TODO
- [ ] Implement `DepPlugin` + `DepAPI` in `src/dep-analyzer/`
- [ ] Implement `SemanticPlugin` + `SemanticAPI` in `src/semantic-analyzer/`
- [ ] Implement `IntelPlugin` + `IntelAPI` in `src/project-intelligence/`
- [ ] Add routers for deps, semantic, graph, risk, intelligence in `src/platform/code_intel/routers/`
- [ ] Add real unit tests per project (test dirs exist but only have `__init__.py`)
- [ ] End-to-end test: create repo → run all analyzers → verify DB + API

### ⚠️ Issues
- Schema uses `files` + `edges` table names (git-specific) rather than generic `entities` + `relationships` as the design describes — needs alignment or clarification
- `analysis_runs` table is git-specific; multi-analyzer task tracking not yet in schema

### 💡 Improvements
- Add a `Makefile` or script for `pip install -e .` of all packages in dev order

---

## Phase 1: Project Scaffolding & Split (summary)

Objectives:
- Create the monorepo layout with `platform/`, `git-analyzer/`, `dep-analyzer/`, `semantic-analyzer/`, `project-intelligence/`, and `frontend/`.
- Define stable interfaces in `platform/code_intel/interfaces/` that analyzers implement.
- Implement unified DB schema and a `registry` + `orchestrator` to manage tasks and dispatch.

Key tasks (short):
- Create pyproject.toml for each project and initial package scaffolding.
- Implement `schema.py` (unified DB DDL) and `storage.py` in `platform/`.
- Define `BaseAnalyzer` and analyzer-specific APIs.
- Move git extraction, edges, clustering into `git-analyzer/` and wrap with `GitPlugin`.
- Implement platform routers that proxy to analyzer APIs.

## Migration map (what moves where)

- `lfca/api.py` → split into `platform/code_intel/routers/*`.
- `lfca/storage.py` → `platform/code_intel/storage.py` + `git_analyzer/api.py` for query helpers.
- `lfca/schema.py` → `platform/code_intel/schema.py`.
- `lfca/extract.py`, `lfca/edges.py`, etc. → `git-analyzer/` equivalents.
- `lfca/clustering/` → `git-analyzer/clustering/`.

## Verification & testing

- Add unit tests per project (e.g., `test_git_analyzer`, `test_dep_analyzer`).
- End-to-end test scenario: create repo, run `git` analyzer, run `deps`, run `semantic`, run `intel`, verify DB tables and API surfaces.

## Phase 1 timeline (short)

1. Scaffold packages and interfaces — 1–2 days
2. Unified schema + registry + orchestrator — 2 days
3. Move git code + implement GitPlugin + GitAPI — 3–4 days
4. Platform routers + basic frontend hooks — 2 days
5. Tests and verification — 1–2 days

---

*See `1-UNIFIED_PLATFORM_OVERVIEW.md` for the high-level goals and architecture.*