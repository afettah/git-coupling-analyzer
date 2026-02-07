# Git-Functional Version — Issues & Tasks

> **Scope**: Get the git-analyzer + platform + frontend working end-to-end.
> **Out of scope**: dep-analyzer, semantic-analyzer, project-intelligence (stubs stay).

---

## 1. Backward-Compatibility Shims — REMOVE

The `code_intel.interfaces` directory is now a dead-weight shim layer.
All imports already migrated to `code_intel_interfaces`.

| File | Action |
|------|--------|
| `src/platform/code_intel/interfaces/__init__.py` | Delete re-export shim |
| `src/platform/code_intel/interfaces/analyzer.py` | Delete shim |
| `src/platform/code_intel/interfaces/types.py` | Delete shim |
| `src/platform/code_intel/interfaces/git_analyzer.py` | Delete shim |
| `src/platform/code_intel/interfaces/dep_analyzer.py` | Delete shim |
| `src/platform/code_intel/interfaces/semantic_analyzer.py` | Delete shim |
| `src/platform/code_intel/interfaces/intelligence.py` | Delete shim |

**Status**: ✅ Done

---

## 2. Platform `pyproject.toml` — Package Discovery Conflict

`[tool.setuptools.packages.find] include = ["code_intel*"]` also matches
`code_intel_interfaces` if both are installed editable from the same tree.

**Fix**: Narrow to `include = ["code_intel", "code_intel.*"]` so only the
`code_intel` namespace is claimed by the platform package.

**Status**: ✅ Done

---

## 3. Frontend ↔ Backend Endpoint Mismatches (Git)

The frontend `api/git.ts` calls endpoints on the **old lfca API paths**
(`/repos/{id}/coupling`, `/repos/{id}/files/tree`, `/repos/{id}/dashboard/summary`, etc.)
but the new platform router uses **`/repos/{id}/git/`** prefixed paths.

| Frontend call | Expected backend | Actual backend route |
|---|---|---|
| `GET /repos/{id}/files/tree` | ✅ exists on repos router? | ❌ only `GET /repos/{id}/git/tree` |
| `GET /repos/{id}/coupling?path=` | old lfca path | ❌ now `GET /repos/{id}/git/coupling` |
| `GET /repos/{id}/coupling/graph` | old lfca path | ❌ now `GET /repos/{id}/git/graph` |
| `GET /repos/{id}/hotspots` | old lfca path | ❌ now `GET /repos/{id}/git/hotspots` |
| `POST /repos/{id}/analysis/start` | old lfca path | ❌ now `POST /repos/{id}/analyzers/run` |
| `GET /repos/{id}/analysis/status` | old lfca path | ❌ not implemented |
| `GET /repos/{id}/files` (list) | old lfca path | ❌ not on platform router |
| `GET /repos/{id}/folders` | old lfca path | ❌ not on platform router |
| `GET /repos/{id}/files/{path}/details` | old lfca path | ❌ now `GET /repos/{id}/git/files/{path}/details` |
| `GET /repos/{id}/files/{path}/history` | old lfca path | ❌ now `GET /repos/{id}/git/files/{path}/history` |
| `GET /repos/{id}/files/{path}/activity` | old lfca | ❌ not implemented |
| `GET /repos/{id}/files/{path}/authors` | old lfca | ❌ not implemented |
| `GET /repos/{id}/files/{path}/commits` | old lfca | ❌ not implemented |
| `GET /repos/{id}/folders/{path}/details` | old lfca | ❌ not implemented |
| `GET /repos/{id}/coupling/components` | old lfca | ❌ not implemented |
| `GET /repos/{id}/coupling/edges` | old lfca | ❌ not implemented |
| `POST /repos/{id}/clustering/run` | old lfca | ❌ now `POST /repos/{id}/git/clustering` |
| `GET /repos/{id}/clustering/algorithms` | old lfca | ❌ not implemented |
| `GET /repos/{id}/clustering/snapshots` | old lfca | ❌ not implemented |
| `GET /repos/{id}/dashboard/summary` | old lfca | ❌ not implemented |
| `GET /repos/{id}/dashboard/trends` | old lfca | ❌ not implemented |
| `GET /repos/{id}/authors` | old lfca | ❌ not on git router |
| `GET /repos/{id}/timeline` | old lfca | ❌ not on git router |

**Fix approach**: Update `frontend/src/api/git.ts` to use the new `/git/` prefixed paths
that match the platform router. For missing endpoints, add them to the git router.

**Status**: ✅ Done

---

## 4. Analyzers Router — Endpoint Pattern Mismatch

Frontend `api/analyzers.ts` calls:
- `POST /repos/{id}/analyzers/{type}/run` — backend only has `POST /repos/{id}/analyzers/run` (type in body)
- `GET /repos/{id}/analyzers/{type}/status` — backend doesn't have this
- `GET /repos/{id}/analyzers/tasks` — backend doesn't have task listing

**Fix**: Add per-type run endpoint, status endpoint, and task listing to analyzers router.

**Status**: ✅ Done

---

## 5. Git Router — Missing Endpoints

These git-related endpoints need to be added to `routers/git.py`:

- `GET /repos/{id}/git/files` — list files (with search, filter, sort)
- `GET /repos/{id}/git/folders` — list folders
- `GET /repos/{id}/git/files/{path}/activity` — activity breakdown
- `GET /repos/{id}/git/files/{path}/authors` — per-file authors
- `GET /repos/{id}/git/files/{path}/commits` — per-file commit list
- `GET /repos/{id}/git/folders/{path}/details` — folder details
- `GET /repos/{id}/git/coupling/components` — component coupling
- `GET /repos/{id}/git/coupling/edges` — coupling edge list (for export)
- `GET /repos/{id}/git/clustering/algorithms` — list algorithms
- `GET /repos/{id}/git/clustering/snapshots` — CRUD for snapshots
- `GET /repos/{id}/git/dashboard/summary` — dashboard summary
- `GET /repos/{id}/git/dashboard/trends` — trends
- `GET /repos/{id}/git/authors` — repo-level author stats
- `GET /repos/{id}/git/timeline` — temporal evolution

**Fix**: Add these routes, delegate to `GitAPI` methods (some need adding to GitAPI too).

**Status**: ✅ Done

---

## 6. Database Schema — Missing Table

The `clustering_snapshots` table referenced by the new snapshot CRUD endpoints
was not defined in `schema.py`.

**Fix**: Added `CREATE TABLE IF NOT EXISTS clustering_snapshots` to `schema.py`.

**Status**: ✅ Done

---

## 7. Response Format Mapping (Frontend ↔ Backend)

Several frontend interfaces use camelCase keys (`totalFiles`, `avgCoupling`, etc.)
while the Python backend returns snake_case (`file_count`, `avg_coupling`).

Affected APIs: `getDashboardSummary`, `getDashboardTrends`, `getRepoTimeline`, `getHotspots`.

**Fix**: Added mapping layers in the frontend API functions to transform backend snake_case
to the camelCase expected by existing components.

**Status**: ✅ Done

---

## 8. Clustering Run — Body vs Query Param Mismatch

Frontend `runClustering` sends a JSON body (`ClusterConfig`) but the backend
`POST /git/clustering/run` used query parameters.

**Fix**: Changed backend to accept a `ClusterRequest` Pydantic model body.

**Status**: ✅ Done

---

## 9. Analysis Start — Wrong Endpoint Path

Frontend `startAnalysis` called `POST /repos/{id}/analyzers/git/run` but the backend
only has `POST /repos/{id}/analyzers/run` with `analyzer_type` in body.

**Fix**: Updated frontend to call `/repos/{id}/analyzers/run` with `{ analyzer_type: 'git', config }`.

**Status**: ✅ Done

---

## 10. Column Name Mismatch — analysis_tasks

The `analysis_tasks` table uses `state` column but the new analyzer router
queries were using `status`. This would cause SQL errors.

**Fix**: Changed all SQL queries in analyzer router to use `state`.

**Status**: ✅ Done

---

## 11. Unified Entity-Relationship Model (Global Schema)

The legacy `files`, `edges`, and `analysis_runs` tables were analyzer-specific and rigid. These have been replaced by a unified system.

- **`entities` table**: Stores files, classes, functions, and modules in a single place.
- **`relationships` table**: Stores all edges (Git co-changes, Dependency imports, Semantic calls) with a unified `weight` and `properties_json`.
- **`analysis_tasks` table**: Replaced `analysis_runs` as the central source of truth for all analyzer activities.

**Status**: ✅ Done

---

## 12. Storage Layer & Git Analyzer Refactoring

To support the unified model, the platform and git-analyzer were heavily refactored:

- **Storage API**: Added `get_or_create_entity`, `upsert_relationships`, and `get_latest_task`.
- **HistoryExtractor**: Now populates the `entities` table with kind='file' and stores stats in `metadata_json`.
- **EdgeBuilder**: Now populates the `relationships` table with source_type='git' and kind='CO_CHANGED'.
- **Runner**: Rewritten to use `update_task` and populate the unified tasks table.

**Status**: ✅ Done

---

## 13. Query Logic & Parquet Consistency

Unified the way data is queried and stored across SQLite and Parquet.

- **Bidirectional Coupling**: Fixed `GitAPI` to query relationships in both directions (`src` or `dst`) for correct graph and list views.
- **Parquet Column Names**: Standardized on `committer_ts` in Parquet to match the history extractor's output.
- **Metadata Mapping**: Updated `GitAPI` and `Routers` to extract stats from the new `metadata_json` column.

**Status**: ✅ Done

---

## 14. Project Intelligence Hub (Infrastructure)

The infrastructure for multi-analyzer integration is now code-ready.

- **Registry Wiring**: Analyzers register their `BaseAnalyzer` and `API` implementations.
- **Interface Consistency**: All routers now use the `registry.get_api()` pattern.
- **Unified ID system**: Using `entity_id` across the platform for consistent frontend referencing.

**Status**: ✅ Done

---

## 🎯 Coming Soon: Next Implementations

The plumbing is done; now we need the water.

1.  **Dependency Analyzer Implementation**: Implement the actual extraction for Python/TS using the unified `relationships` table.
2.  **Semantic Analyzer Implementation**: Integrate tree-sitter or similar to populate the `entities` table with class/function definitions.
3.  **Background Worker**: Move the orchestrator to a dedicated worker process for better reliability during large repo analysis.
4.  **Real-time Task Progress**: Implement WebSockets or better polling for live "Scanning..." updates in the UI.

---

## 🛠️ Areas for Improvement

- **Bulk Loading**: Use SQLite `COPY` or optimized batch inserts for repositories with 100k+ file versions.
- **Metadata Granularity**: Add more metrics like LOC, Cyclomatic Complexity, and Churn to the entity metadata.
- **Validation Dashboard**: Create a UI view for the `validation_log` so users can see why some commits/files were skipped.
- **Search & Filtering**: Implement server-side pagination and advanced filtering for the repository file views.

---

## Summary

| Category | Issues/Tasks | Status |
|---|---|---|
| Shim removal | 7 files | ✅ |
| pyproject.toml | 1 | ✅ |
| Frontend API paths | ~25 endpoint mismatches | ✅ |
| Backend missing routes | ~15 routes | ✅ |
| Analyzer router patterns | 3 | ✅ |
| Schema (Unified model) | All tables migrated | ✅ |
| Storage Layer | Unified entity/rel API | ✅ |
| Git Analyzer | Extract/Edge refactored | ✅ |
| Bidirectional Queries | Fixed in GitAPI | ✅ |
| Response format mapping | 4 endpoints | ✅ |
| Clustering request body | 1 | ✅ |
| Analysis start path | 1 | ✅ |
| Column name mismatch | 1 | ✅ |
| **Dep/Semantic Analyzers** | Extraction logic | ⏳ Next |
| **Background Worker** | Orchestration scaling | 📅 Planned |
