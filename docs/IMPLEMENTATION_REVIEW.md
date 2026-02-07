# Implementation Review — Code Intelligence Platform

> **Date**: 2026-02-07
> **Scope**: Full review of `src/` against `docs/unified-platform/` design, focused on getting a functional git-analysis pipeline (front → back), identifying stale code, schema/API gaps, and prioritized TODOs.

---

## Executive Summary

The project has solid scaffolding: monorepo split is correct, interfaces are extracted into `code-intel-interfaces`, the registry/plugin/orchestrator pattern works, the frontend has all navigation tabs wired, and the git-analyzer pipeline (mirror → extract → edges) runs end-to-end. However, **the codebase is in a half-migrated state** — the git-analyzer writes to both legacy (`files`/`edges`) and unified (`entities`/`relationships`) tables, but queries in `GitAPI` and the `git.py` router still read from the old tables. Several API methods will crash at runtime due to missing columns. The non-git analyzers (deps, semantic, intelligence) are stubs, the frontend calls many endpoints that have no backend implementation, and there is dead legacy naming (`LFCA`) scattered in docstrings and comments.

**Verdict**: ~65% of Phase 1 is functional. The remaining 35% is schema/query consistency issues and incomplete API implementations that will produce runtime errors.

---

## 1. CRITICAL — Dual-Table Inconsistency (WILL CRASH)

**Priority: 🔴 P0 — Blocks all git features**

The git-analyzer `edges.py` (line ~110-130) writes to the **unified** `relationships` table (`source_type='git'`, `rel_kind='CO_CHANGED'`), and `extract.py` (line ~185-193) writes to the **unified** `entities` table. But `GitAPI` query methods in [git_analyzer/api.py](src/git-analyzer/git_analyzer/api.py) use **both** patterns inconsistently:

| GitAPI Method | Queries From | Issue |
|---|---|---|
| `get_file_coupling()` | `files` + `edges` (legacy) | ❌ Legacy — data is in `relationships` |
| `get_coupling_graph()` | `files` + `edges` (legacy) | ❌ Legacy — data is in `relationships` |
| `get_file_history()` | `files` (legacy) | ❌ Should use `entities` |
| `get_file_details()` | `files` (legacy) — references `first_commit_date`, `last_commit_date`, `total_lines_added`, `total_lines_deleted` columns | 🔥 **WILL CRASH** — these columns don't exist in `files` table |
| `get_hotspots()` | `files` (legacy) — references `total_lines_added`, `total_lines_deleted` | 🔥 **WILL CRASH** — columns don't exist |
| `get_dashboard_summary()` | `files` + `analysis_runs` (legacy) | ⚠️ Returns 0 — data is in `analysis_tasks` |
| `run_clustering()` | `edges` + `files` (legacy) | ❌ Legacy — data is in `relationships` |
| `get_component_coupling()` | Returns `[]` (stub) | ❌ Not implemented |

### TODO
- [ ] **[P0]** [src/git-analyzer/git_analyzer/api.py](src/git-analyzer/git_analyzer/api.py) — Rewrite ALL query methods to use `entities` + `relationships` tables instead of `files` + `edges`
- [ ] **[P0]** Remove or stop writing to `files`/`edges` tables entirely — pick ONE path (unified) and commit to it
- [ ] **[P0]** Fix `get_file_details()` — it queries columns (`first_commit_date`, `last_commit_date`, `total_lines_added`, `total_lines_deleted`) that don't exist in either `files` or `entities`. These stats should come from `metadata_json` in the `entities` table.
- [ ] **[P0]** Fix `get_hotspots()` — same column mismatch as above

---

## 2. CRITICAL — Router Inlines Legacy Queries

**Priority: 🔴 P0**

The git router [src/platform/code_intel/routers/git.py](src/platform/code_intel/routers/git.py) has several endpoints that bypass `GitAPI` and query the DB directly using legacy tables:

| Endpoint | Line | Issue |
|---|---|---|
| `GET /coupling/edges` | ~88-103 | Queries `edges` + `files` directly — should delegate to `GitAPI` |
| `GET /files` | ~112-143 | Queries `files` table directly — should use `entities` |
| `GET /folders` | ~146-163 | Queries `files` table directly |
| `GET /files/{path}/activity` | ~179-224 | Queries `files` table to find `file_id` |
| `GET /files/{path}/authors` | ~227-274 | Queries `files` table to find `file_id` |
| `GET /files/{path}/commits` | ~277-322 | Queries `files` table to find `file_id` |
| `GET /folders/{path}/details` | ~325-398 | Queries `files` table directly |

### TODO
- [ ] **[P0]** [src/platform/code_intel/routers/git.py](src/platform/code_intel/routers/git.py) — Migrate all inline SQL queries from `files`/`edges` to `entities`/`relationships`, or better yet delegate to `GitAPI` methods
- [ ] **[P0]** The router should not contain raw SQL — move all queries into `GitAPI` or `Storage` methods

---

## 3. CRITICAL — Missing `json` Import in Repos Router

**Priority: 🔴 P0 — Runtime crash**

[src/platform/code_intel/routers/repos.py](src/platform/code_intel/routers/repos.py) calls `json.loads(row[3])` at line ~82 but **never imports `json`**. The `list_repositories()` endpoint will crash on any repo that has analysis metrics.

### TODO
- [ ] **[P0]** [src/platform/code_intel/routers/repos.py](src/platform/code_intel/routers/repos.py) — Add `import json` at top of file

---

## 4. HIGH — Schema Has Both Legacy and Unified Tables

**Priority: 🟠 P1**

[src/platform/code_intel/schema.py](src/platform/code_intel/schema.py) defines BOTH sets of tables:

**Unified (correct)**:
- `entities` (with `entity_id`, `qualified_name`, `kind`, `metadata_json`)
- `relationships` (with `source_type`, `rel_kind`, `weight`, `properties_json`)
- `analysis_tasks`

**Legacy (should be removed)**:
- `files` (line ~105) — comment says "Keep for now until git-analyzer is updated"
- `edges` (line ~117)
- `analysis_runs` (line ~131)
- `file_lineage` (line ~140) — referenced by `GitAPI.get_file_history()` but unclear if populated
- `component_edges` — referenced nowhere in current code

### TODO
- [ ] **[P1]** [src/platform/code_intel/schema.py](src/platform/code_intel/schema.py) — Once GitAPI is migrated to unified tables, remove legacy `files`, `edges`, `analysis_runs`, `component_edges` tables
- [ ] **[P1]** Rename `file_lineage` to `git_file_lineage` (prefix convention) or integrate rename tracking into `entities.metadata_json`
- [ ] **[P1]** [src/platform/code_intel/storage.py](src/platform/code_intel/storage.py) — Remove legacy methods: `get_or_create_file()`, `get_file_by_path()`, `get_current_files()`, `get_current_files_with_stats()`, `upsert_edges()`, `get_edges_for_file()`, `update_head_status()` — these all operate on the old `files`/`edges` tables

---

## 5. HIGH — Frontend ↔ Backend API Mismatches (Non-Git)

**Priority: 🟠 P1**

The frontend has rich API clients for deps, semantic, graph, risk, and intelligence — but the backend either has stub routers or missing endpoints entirely.

### Frontend → Backend Endpoint Gaps

#### Risk API ([src/frontend/src/api/risk.ts](src/frontend/src/api/risk.ts))
| Frontend Call | Backend Route | Status |
|---|---|---|
| `GET /repos/{id}/risk/overview` | `GET /repos/{id}/intel/risk/overview` | ❌ Path mismatch (`risk/` vs `intel/risk/`) |
| `GET /repos/{id}/risk/files` | None | ❌ No backend route |
| `GET /repos/{id}/risk/folders` | None | ❌ No backend route |

#### Intelligence API ([src/frontend/src/api/intelligence.ts](src/frontend/src/api/intelligence.ts))
| Frontend Call | Backend Route | Status |
|---|---|---|
| `GET /repos/{id}/intelligence/dashboard` | None | ❌ No backend route (router uses `/intel/` prefix) |
| `GET /repos/{id}/intelligence/architecture` | None | ❌ No backend route |
| `GET /repos/{id}/intelligence/correlations` | None | ❌ No backend route |

#### Graph API ([src/frontend/src/api/graph.ts](src/frontend/src/api/graph.ts))
| Frontend Call | Backend Route | Status |
|---|---|---|
| `GET /repos/{id}/graph/entities` | None | ❌ No backend route (`graph/__init__.py` is empty) |
| `GET /repos/{id}/graph/entities/{id}` | None | ❌ |
| `GET /repos/{id}/graph/relationships` | None | ❌ |
| `GET /repos/{id}/graph/neighbors/{id}` | None | ❌ |
| `GET /repos/{id}/graph/path` | None | ❌ |
| `GET /repos/{id}/graph/stats` | None | ❌ |

#### Deps API
| Frontend Call | Backend Route | Status |
|---|---|---|
| All deps endpoints | Router exists, delegates to stub `DepAPI` | ⚠️ Returns empty data |

#### Semantic API  
| Frontend Call | Backend Route | Status |
|---|---|---|
| All semantic endpoints | Router exists, delegates to stub `SemanticAPI` | ⚠️ Returns empty data |

### TODO
- [ ] **[P1]** [src/platform/code_intel/routers/intelligence.py](src/platform/code_intel/routers/intelligence.py) — Fix prefix: change `/intel/` to `/intelligence/` to match frontend, OR update frontend
- [ ] **[P1]** Add a dedicated `/repos/{id}/risk/` router (separate from intelligence) or update frontend to use `/intel/risk/`
- [ ] **[P2]** [src/platform/code_intel/graph/__init__.py](src/platform/code_intel/graph/__init__.py) — Implement graph query module (NetworkX-based entity/relationship queries)
- [ ] **[P2]** Add graph router: `/repos/{id}/graph/*` endpoints for entity search, neighbors, path finding, stats
- [ ] **[P3]** Implement real dep-analyzer extraction logic
- [ ] **[P3]** Implement real semantic-analyzer extraction logic

---

## 6. HIGH — Legacy Naming (`LFCA`) Still Present

**Priority: 🟠 P1**

The old project name `LFCA` appears in several files:

| File | Location | Content |
|---|---|---|
| [src/platform/code_intel/schema.py](src/platform/code_intel/schema.py) | Line 1 | `"""Database schema definitions for LFCA."""` |
| [src/platform/code_intel/storage.py](src/platform/code_intel/storage.py) | Line 1 | `"""Unified storage layer for LFCA."""` |
| [src/git-analyzer/git_analyzer/plugin.py](src/git-analyzer/git_analyzer/plugin.py) | Line 45 | `# db_path usually: .../data/repos/{repo_id}/lfca.sqlite` |
| [src/git-analyzer/git_analyzer/git.py](src/git-analyzer/git_analyzer/git.py) | Lines 11, 104 | `_COMMIT_MARKER = "__LFCA_COMMIT__"` and `if path.startswith('__LFCA_')` |
| [src/git-analyzer/git_analyzer/cli.py](src/git-analyzer/git_analyzer/cli.py) | Lines 107, 146 | `"--data-dir"` help text and `lfca.log` filename |

### TODO
- [ ] **[P1]** Replace all `LFCA` / `lfca` references with `code-intel` or remove
- [ ] **[P1]** [src/git-analyzer/git_analyzer/git.py](src/git-analyzer/git_analyzer/git.py) — Rename `__LFCA_COMMIT__` marker to `__CODE_INTEL_COMMIT__`
- [ ] **[P1]** [src/git-analyzer/git_analyzer/cli.py](src/git-analyzer/git_analyzer/cli.py) — Change log file from `lfca.log` to `code-intel.log`

---

## 7. MEDIUM — Git API Incomplete Implementations

**Priority: 🟡 P2**

Several `GitAPI` methods return empty or minimal data:

| Method | File | Issue |
|---|---|---|
| `get_component_coupling()` | [api.py](src/git-analyzer/git_analyzer/api.py) | Returns `[]` — not implemented |
| `get_dashboard_summary()` | [api.py](src/git-analyzer/git_analyzer/api.py) | Only returns `file_count` and `commit_count` — frontend expects `author_count`, `avg_coupling`, `hotspot_count`, `risk_score`, `last_analyzed`, `codebase_age`, `lines_added`, `lines_deleted` |
| `get_hotspots()` | [api.py](src/git-analyzer/git_analyzer/api.py) | Only sorts by `total_commits` — no risk scoring, no coupling/churn integration |
| `get_file_details()` | [api.py](src/git-analyzer/git_analyzer/api.py) | Queries non-existent columns, incomplete response |
| `get_authors()` | [api.py](src/git-analyzer/git_analyzer/api.py) | Returns only name+count — missing `files`, `percentage` fields |
| `get_timeline()` | [api.py](src/git-analyzer/git_analyzer/api.py) | Pandas `resample` uses deprecated `freq='M'` — should use `'ME'` |

### TODO
- [ ] **[P2]** Implement `get_component_coupling()` — query `component_edges` table or compute from `relationships`
- [ ] **[P2]** Enrich `get_dashboard_summary()` to return all fields the frontend expects
- [ ] **[P2]** Implement proper `get_hotspots()` with risk scoring (coupling × churn × author count)
- [ ] **[P2]** Fix `get_file_details()` to read from `entities.metadata_json` for churn/date stats
- [ ] **[P2]** Enrich `get_authors()` with file count and percentage
- [ ] **[P2]** Fix deprecated pandas `freq='M'` → `'ME'` in `get_timeline()`

---

## 8. MEDIUM — Orchestrator Runs Synchronously in Background Task

**Priority: 🟡 P2**

The design calls for async tasks with DB-tracked progress. Current implementation:
- `analyzers.py` router dispatches via `BackgroundTasks` (✅ non-blocking)
- But `Orchestrator.run_analysis()` in [orchestrator.py](src/platform/code_intel/orchestrator.py) runs synchronously inside the background task
- No progress updates during extraction/edge-building stages
- No way for frontend to get progress percentage (only start/end states)

### TODO
- [ ] **[P2]** [src/git-analyzer/git_analyzer/runner.py](src/git-analyzer/git_analyzer/runner.py) — Add progress callback updates at each pipeline stage (mirror → extract → edges)
- [ ] **[P2]** [src/platform/code_intel/orchestrator.py](src/platform/code_intel/orchestrator.py) — Update task progress/stage in DB during execution

---

## 9. MEDIUM — Frontend Feature Views Call Non-Existent Endpoints

**Priority: 🟡 P2**

Frontend feature views exist but will show errors or empty states because their backend endpoints don't exist:

| Frontend View | Calls | Backend Status |
|---|---|---|
| [features/deps/ImportGraph.tsx](src/frontend/src/features/deps/ImportGraph.tsx) | `/repos/{id}/deps/graph` | Stub returns `{nodes: [], edges: []}` |
| [features/deps/CircularDeps.tsx](src/frontend/src/features/deps/CircularDeps.tsx) | `/repos/{id}/deps/circular` | Stub returns `[]` |
| [features/deps/ExternalPackages.tsx](src/frontend/src/features/deps/ExternalPackages.tsx) | `/repos/{id}/deps/external` | Stub returns `[]` |
| [features/semantic/DomainMap.tsx](src/frontend/src/features/semantic/DomainMap.tsx) | `/repos/{id}/semantic/domains` | Stub returns `[]` |
| [features/semantic/BridgeEntities.tsx](src/frontend/src/features/semantic/BridgeEntities.tsx) | `/repos/{id}/semantic/bridges` | Stub (but no backend route for bridges) |
| [features/risk/RiskOverview.tsx](src/frontend/src/features/risk/RiskOverview.tsx) | `/repos/{id}/risk/overview` | ❌ Path mismatch |
| [features/graph/KnowledgeGraph.tsx](src/frontend/src/features/graph/KnowledgeGraph.tsx) | `/repos/{id}/graph/*` | ❌ No backend |
| [features/dashboard/DomainOverviewWidget.tsx](src/frontend/src/features/dashboard/DomainOverviewWidget.tsx) | Semantic data | ❌ No data |
| [features/dashboard/RiskSignalsWidget.tsx](src/frontend/src/features/dashboard/RiskSignalsWidget.tsx) | Risk data | ❌ No data |

### TODO
- [ ] **[P2]** These views should show a clear "Analyzer not yet run" or "Feature coming soon" message instead of crashing
- [ ] **[P3]** Implement backend for each as analyzers get built

---

## 10. LOW — `sync.py` Still Uses Legacy `files` Table

**Priority: 🟢 P3**

[src/git-analyzer/git_analyzer/sync.py](src/git-analyzer/git_analyzer/sync.py) — `sync_head_files()` calls `storage.update_head_status()` which updates the `files` table. The `build_file_tree()` function calls `storage.get_current_files_with_stats()` which queries `files` and `edges`.

### TODO
- [ ] **[P3]** Migrate `sync.py` to use `entities` table
- [ ] **[P3]** Migrate `storage.get_current_files_with_stats()` to query `entities` + `relationships`

---

## 11. LOW — Code Comments / TODOs in Source

**Priority: 🟢 P3**

Several files contain inline TODO comments or uncertain code:

| File | Issue |
|---|---|
| [git_analyzer/api.py](src/git-analyzer/git_analyzer/api.py) lines 67-70 | `# This logic is quite complex...I'll implement a simplified version` |
| [git_analyzer/api.py](src/git-analyzer/git_analyzer/api.py) line 156 | `# Add more stats...` |
| [routers/repos.py](src/platform/code_intel/routers/repos.py) lines 128-134 | Long comment about git remote detection — unresolved design question |
| [git_analyzer/plugin.py](src/git-analyzer/git_analyzer/plugin.py) line 44-47 | Comment about `db_path` path pattern — stale reference |

### TODO
- [ ] **[P3]** Clean up all in-source TODOs and incomplete comments
- [ ] **[P3]** Complete `get_coupling_graph()` implementation (currently simplified)

---

## 12. LOW — Parquet Column Name Assumptions

**Priority: 🟢 P3**

`GitAPI.get_timeline()` assumes Parquet has a `committed_at` column (integer timestamp). `GitAPI.get_authors()` assumes `author_name` column. If the extractor uses different column names (e.g., `committer_ts`), these will silently fail and return empty arrays.

### TODO
- [ ] **[P3]** Verify Parquet schema matches query expectations — standardize column naming in extractor and all consumers

---

## 13. Architecture — Items for Cleanup / Removal

### Files/Code to DELETE (legacy/retrocompatibility):

| What | Why |
|---|---|
| `files` table in schema.py | Legacy — replaced by `entities` |
| `edges` table in schema.py | Legacy — replaced by `relationships` |
| `analysis_runs` table in schema.py | Legacy — replaced by `analysis_tasks` |
| `component_edges` table in schema.py | Never populated in current code |
| `Storage.get_or_create_file()` | Legacy — use `get_or_create_entity()` |
| `Storage.get_file_by_path()` | Legacy |
| `Storage.get_current_files()` | Legacy — use entity queries |
| `Storage.get_current_files_with_stats()` | Legacy — uses `files`+`edges` |
| `Storage.upsert_edges()` | Legacy — use `upsert_relationships()` |
| `Storage.get_edges_for_file()` | Legacy — use relationship queries |
| `Storage.update_head_status()` | Legacy — update `entities.exists_at_head` |
| LFCA naming in docstrings/comments | Stale branding |

### Files to KEEP (working correctly):
| What | Status |
|---|---|
| `code-intel-interfaces/` package | ✅ Clean, standalone |
| `platform/code_intel/app.py` | ✅ Well-structured |
| `platform/code_intel/config.py` | ✅ Clean (`code-intel.sqlite` naming fixed) |
| `platform/code_intel/registry.py` | ✅ Works correctly |
| `platform/code_intel/orchestrator.py` | ✅ Works (sync in background) |
| `platform/code_intel/routers/analyzers.py` | ✅ Full implementation |
| `git-analyzer/plugin.py` | ✅ Works |
| `git-analyzer/runner.py` | ✅ Works |
| `git-analyzer/extract.py` | ✅ Works (writes to unified tables) |
| `git-analyzer/edges.py` | ✅ Works (writes to unified tables) |
| `git-analyzer/mirror.py` | ✅ Works |
| `git-analyzer/changesets.py` | ✅ Works |
| `git-analyzer/clustering/` | ✅ Full implementation |
| Frontend shell + routing | ✅ All tabs present |
| Frontend `api/git.ts` | ✅ Paths match backend routes |
| Frontend `api/analyzers.ts` | ✅ Paths match backend |
| Frontend `api/repos.ts` | ✅ Works |

---

## Priority Summary

| Priority | Count | Category |
|---|---|---|
| 🔴 **P0** | 6 | Runtime crashes — dual-table inconsistency, missing import, column mismatches |
| 🟠 **P1** | 8 | Broken features — API path mismatches, legacy naming, stale schema |
| 🟡 **P2** | 10 | Incomplete features — stub APIs, missing dashboard data, no progress tracking |
| 🟢 **P3** | 7 | Polish — code cleanup, parquet validation, TODO comments |

---

## Recommended Action Plan

### Phase A — Make Git Pipeline Functional (P0, ~2 days)
1. Add `import json` to `repos.py`
2. Rewrite `GitAPI` to query ONLY from `entities`/`relationships` tables
3. Migrate all inline SQL in `git.py` router to use `entities`/`relationships`
4. Remove legacy `files`/`edges`/`analysis_runs` tables from schema
5. Remove legacy Storage methods
6. Verify full frontend → backend flow: create repo → run analysis → view coupling/files/hotspots/clustering

### Phase B — Fix API Consistency (P1, ~1 day)
1. Fix intelligence router prefix (`/intel/` → `/intelligence/`)
2. Decide on risk router structure (separate or under intelligence)
3. Rename all LFCA references
4. Clean up stale comments

### Phase C — Complete Git Features (P2, ~2 days)
1. Implement full `get_dashboard_summary()` with all frontend-expected fields
2. Implement risk-scored `get_hotspots()`
3. Implement `get_component_coupling()`
4. Complete `get_file_details()` response
5. Add progress tracking to analysis pipeline

### Phase D — Graph & Cross-Source (P2-P3, ~3 days)
1. Implement graph query module in `platform/code_intel/graph/`
2. Add graph router with entity/relationship/neighbor endpoints
3. Add graceful "not available" states for stub analyzer views

---

*This review is based on the code as of 2026-02-07. Refer to the existing [git-functional-issues.md](git-functional-issues.md) for the history of previously resolved issues.*
