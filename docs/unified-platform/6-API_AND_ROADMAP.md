# API Design, Sync/Async Patterns, and Roadmap

> **Status**: Phase 1 routers done, Phase 2–5 pending

---

## Implementation Status

### ✅ Implemented Routers
- `/repos` — CRUD (list, create, delete, git remote info) — `src/platform/code_intel/routers/repos.py`
- `/repos/{id}/analyzers` — list analyzers, run analyzer — `src/platform/code_intel/routers/analyzers.py`
- `/repos/{id}/git/*` — coupling, graph, file history, details, hotspots, clustering, tree — `src/platform/code_intel/routers/git.py`
- `/health` — health check with analyzer list — `src/platform/code_intel/app.py`
- Error handling: HTTP + validation exception handlers with structured error responses

### ✅ Implemented Patterns
- Router → registry → API delegation pattern working for git
- `RepoPaths` config for consistent path resolution — `src/platform/code_intel/config.py`
- BackgroundTasks used in `analyzers.py` for async analyzer dispatch

### 🔧 TODO
- [ ] Add `/repos/{id}/deps/*` router (proxy to `DepAPI`)
- [ ] Add `/repos/{id}/semantic/*` router (proxy to `SemanticAPI`)
- [ ] Add `/repos/{id}/graph/*` router (orchestrator-owned NetworkX queries)
- [ ] Add `/repos/{id}/risk/*` router (proxy to `IntelAPI`)
- [ ] Add `/repos/{id}/intelligence/*` router
- [ ] Implement task status polling: `GET /repos/{id}/analyzers/{type}/status`
- [ ] Add `analysis_tasks` DB rows for progress tracking

### Roadmap Progress
| Phase | Description | Status |
|-------|-------------|--------|
| **1** | Scaffolding, interfaces, schema, registry, git pipeline | ✅ ~80% done |
| **2** | Dependency analyzer + frontend views | ❌ Not started |
| **3** | Semantic analyzer + frontend views | ❌ Not started |
| **4** | Project intelligence + dashboard | ❌ Not started |
| **5** | Polish, additional languages, exports | ❌ Not started |

### ⚠️ Issues
- Analyzer run endpoint (`POST /repos/{id}/analyzers/run`) uses a generic body; design suggests per-type endpoints (`POST /repos/{id}/analyzers/git/run`)
- No task status endpoint implemented yet — frontend `getAnalyzerStatus()` has no backend match

---

## API router structure

The orchestrator exposes a FastAPI app with routers that proxy to analyzer APIs:

- `/repos` — repository CRUD
- `/repos/{id}/analyzers` — list & run analyzers, task status
- `/repos/{id}/git/*` — proxy to `GitAPI`
- `/repos/{id}/deps/*` — proxy to `DepAPI`
- `/repos/{id}/semantic/*` — proxy to `SemanticAPI`
- `/repos/{id}/graph/*` — orchestrator-owned NetworkX queries
- `/repos/{id}/risk/*` and `/repos/{id}/intelligence/*` — proxy to `IntelAPI`

## Endpoint catalog (examples)

- GET `/repos/{repo_id}/git/coupling` — get coupled files for a path
- GET `/repos/{repo_id}/deps/graph` — import graph
- GET `/repos/{repo_id}/semantic/domains` — discovered domains
- GET `/repos/{repo_id}/graph/neighbors/{entity_id}` — neighborhood subgraph
- GET `/repos/{repo_id}/risk/overview` — overall risk scorecard

(See routers for a full 1-1 mapping — `platform/code_intel/routers/`.)

## Sync vs Async patterns

- Long-running tasks (full analyzers, clustering) are ASYNC:
  - POST `/repos/{id}/analyzers/{type}/run` returns `{task_id, status: pending}` and starts a BackgroundTask.
  - Analyzer updates `analysis_tasks` rows with progress/stage/state in the DB.
  - Frontend polls GET `/repos/{id}/analyzers/{type}/status`.

- Fast queries are SYNC and return immediate responses (all GET endpoints).

## Router pattern (example)

Routers minimalize logic — they fetch `paths = get_repo_paths(repo_id)`, obtain the appropriate API from the `registry`, and call the API method returning JSON to the client.

## Implementation roadmap (high level)

Phases:
- Phase 1: Project scaffolding, interfaces, unified schema, registry/orchestrator, move git pipeline to `git-analyzer/`.
- Phase 2: Dependency analyzer and frontend features for dependency views.
- Phase 3: Semantic analyzer (token extraction, TF-IDF, clustering) and semantic frontend.
- Phase 4: Project intelligence (risk model, knowledge graph) and dashboard.
- Phase 5: Polish and extend (additional languages, ownership, complexity, exports).

## What moves where

Examples:
- `lfca/api.py` → split into `platform/code_intel/routers/*`.
- `lfca/extract.py` → `git-analyzer/extract.py`.
- `lfca/edges.py` → `git-analyzer/edges.py`.

## Technology decisions (short)

- SQLite per repo for storage, NetworkX for in-memory graph queries, TF-IDF for semantic embedding, React+Vite+Tailwind for frontend, D3 for visualizations.

## Extensibility guide (short)

- To add an analyzer: create a project, define an API interface in `platform/code_intel/interfaces/`, implement `BaseAnalyzer`, register in `app.register_analyzers()`, add router, and add frontend feature.

---

*Use this file as the canonical quick reference for API and roadmap items.*