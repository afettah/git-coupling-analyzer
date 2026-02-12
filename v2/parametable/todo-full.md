# Parametrable Analysis — Full Implementation Todo

> **Goal**: Configurable platform where users specify project configuration at creation time and choose all options impacting analysis results. Config is global to the project intelligence (git-only for now).

## Design & Implementation References

- **Design**: `v2/parametable/DESIGN.md`
- **Issues/Fixes**: `v2/parametable/PARAMS_IMPLEMENTATION_REVIEW.md` (30 issues)
- **Task details**: `v2/parametable/tasks/01–10`
- **Progress**: `v2/parametable/progress.md`
- **POC**: `v2/parametable/todo-poc.md`

---

## Current POC State (what's done)

### ✅ Implemented in POC
- Project creation wizard flow: Repository → Scan → Preset → Configure → Review → Run
- Mock data layer: scan, tree, config, presets, progress (all mocked, no HTTP)
- Shared FileTree component (tri-state, virtualized, select/expand)
- GitAnalysisConfigurator redesigned with business-oriented collapsible groups
- Git commit date range selector (dual-thumb slider synced with since/until inputs)
- Branch/Tag selector component (`RefSelector`) with lazy-fetch from `GET /repos/{repo_id}/git/refs`
- "Start Analysis" quick-start button (auto-start with default config)
- Smart defaults from scan results
- Analysis progress simulation (mock SSE)
- Project-scoped config persistence (localStorage)
- Field-level validation with inline errors/warnings

### ✅ Backend endpoint added
- `GET /repos/{repo_id}/git/refs` — lists branches and tags with lazy search (q, kind, limit)

---

## What's Left to Complete the POC

### POC-A: Mock RefSelector (when no real backend)
**Status**: RefSelector currently calls real API. For full mock mode:
- Add `src/frontend/src/mocks/refsMock.ts` with mock branch/tag data
- Conditionally use mock when `repoId` starts with `mock_`
- **API**: `getGitRefs(repoId, { q, kind, limit })` → `GitRef[]`
- **Behavior**: Debounced search (250ms), dropdown with branches/tags sections, free text input accepted

### POC-B: Wizard should pass scan dates to all relevant steps
**Status**: Done. `ConfigureStep` receives `lastCommitDate`/`firstCommitDate` from scan.

### POC-C: SettingsView repoId passthrough
**Status**: `SettingsView` uses `GitAnalysisConfigurator` without `repoId` — RefSelector works but shows "Select a repository first". Need to pass `repoId` from the settings context.
- **File**: `src/frontend/src/features/settings/SettingsView.tsx`
- **Change**: Pass repo ID prop to `<GitAnalysisConfigurator repoId={repoId} />`

---

## Design & Architecture Fixes

These must be addressed before or during implementation — they represent gaps between the current design/code and the main objective.

### DFIX-1: Config must be project-scoped, not run-scoped ✅ (schema designed)
**Problem**: `analysis_configs` table has no `repo_id`. Config should be global to the project.
**Fix**: Add `repo_id TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE` and `is_active BOOLEAN DEFAULT FALSE` to `analysis_configs`. Each project has one active config at a time.
**Files**: `src/platform/code_intel/schema.py`, `src/platform/code_intel/storage.py`, `DESIGN.md` §3.1.1

### DFIX-2: Scanner missing from repos create flow
**Problem**: `repos.py` create endpoint doesn't trigger scan. Per design §4.2, `POST /repos` should auto-scan.
**Fix**: Integrate `ProjectScanner.scan()` call into repo creation. Return `state: "ready"|"scanning"` with embedded scan summary.
**Files**: `src/platform/code_intel/routers/repos.py`, `src/git-analyzer/git_analyzer/scanner.py`

### DFIX-3: project_scan/project_tree tables missing repo_id
**Problem**: `project_scan` has no link to repo. A platform supports multiple repos.
**Fix**: Add `repo_id TEXT NOT NULL` to `project_scan`. `project_tree.scan_id` provides the indirect link.
**Files**: `src/platform/code_intel/schema.py`

### DFIX-4: Frontend config in settings vs wizard
**Problem**: `GitAnalysisConfigurator.tsx` lives in `features/settings/`. It should be a shared component usable in both the wizard and a standalone settings/reconfigure page.
**Fix**: Move to `src/frontend/src/shared/AnalysisConfigurator/` or `features/analysis-configurator/`. Import from both wizard and settings.
**Files**: Frontend restructure

### DFIX-5: Existing AnalysisDashboard bypasses config
**Problem**: `AnalysisDashboard.tsx:141` and `AnalyzerStatusPanel.tsx:34` use saved config from localStorage but don't use the project-scoped active config from backend.
**Fix**: After backend config CRUD exists, dashboard should fetch active config from API, not localStorage.
**Files**: `src/frontend/src/features/dashboard/AnalysisDashboard.tsx`, `AnalyzerStatusPanel.tsx`

### DFIX-6: plugin.py schema doesn't match analysis_config.py
**Problem**: `plugin.py` has its own parameter schema (grouped important/advanced fields) that may drift from `analysis_config.py` and `analysis_configs` DB table.
**Fix**: Single source of truth — `analysis_config.py` defines all fields; `plugin.py` references it for schema generation.
**Files**: `src/git-analyzer/git_analyzer/plugin.py`, `analysis_config.py`

---

## Implementation Tasks

### Phase 1: Backend Foundation

#### TASK-1: Schema & Storage Updates
Complete schema with project-scoped configs and scan tables.
- Add `repo_id` to `project_scan` and `analysis_configs` (DFIX-1, DFIX-3)
- Add `is_active` to `analysis_configs`
- Migration guards for existing DBs (column-exists checks)
- Fix `entities` unique index to include `kind` (Issue #19)
- Add `ON DELETE CASCADE` to foreign keys (Issue #29)
- Storage methods: `get_active_config(repo_id)`, `set_active_config(repo_id, config_id)`
- **Files**: `src/platform/code_intel/schema.py`, `src/platform/code_intel/storage.py`

**Expected API behavior**:
```
storage.get_active_config(repo_id) → AnalysisConfig | None
storage.set_active_config(repo_id, config_id) → void
storage.list_configs(repo_id) → List[AnalysisConfig]
```

#### TASK-2: Scanner Service
Complete the `ProjectScanner` — scan on repo creation, persist results.
- `git ls-tree`, `git rev-list --count`, language/framework detection
- `git log --format=%aI --reverse -1` → first commit date
- `git log --format=%aI -1` → last commit date
- Store to `project_scan` + `project_tree` tables
- Smart defaults computation from scan results (DESIGN.md §6.2)
- **Files**: `src/git-analyzer/git_analyzer/scanner.py`

**Expected scan result**:
```json
{
  "scan_id": "uuid",
  "repo_id": "string",
  "total_files": 1245,
  "total_dirs": 98,
  "commit_count": 4520,
  "languages": {"typescript": 342, "python": 128},
  "frameworks": ["react", "fastapi"],
  "first_commit_date": "2021-03-15",
  "last_commit_date": "2026-02-10"
}
```

#### TASK-3: Repos API Redesign
Enhance `POST /repos` to auto-trigger scan and return scan summary.

**Expected APIs**:
```
POST   /repos                     → RepoInfo (auto-scan triggered)
POST   /repos/{repo_id}/scan      → ScanResult (manual re-scan)
GET    /repos/{repo_id}/scan      → ScanResult (latest scan)
GET    /repos/{repo_id}/git/refs  → GitRef[] (branches/tags, lazy search) ✅ DONE
```

**`GET /repos/{repo_id}/git/refs` (implemented)**:
```
Query params: q (search filter), kind (branch|tag|all), limit (1-500)
Response: [{ name, kind, short_sha, date }]
```

### Phase 2: Config & Tree APIs

#### TASK-4: Tree Browse & Preview API

**Expected APIs**:
```
GET    /repos/{repo_id}/tree                → TreeNode[] (full stored tree)
POST   /repos/{repo_id}/tree/preview        → TreeNode[] (filtered preview)
```

**Preview request body**:
```json
{
  "include_patterns": ["src/*", "tests/*"],
  "exclude_patterns": ["node_modules/*", "dist/*"],
  "extensions_include": [".ts", ".tsx", ".py"],
  "max_depth": 5
}
```

**Preview response**: Tree with tri-state status (included/excluded/partial) per node.

#### TASK-5: Analysis Config CRUD API

**Expected APIs**:
```
POST   /repos/{repo_id}/analysis/configs                → ConfigRecord (create)
GET    /repos/{repo_id}/analysis/configs                 → ConfigRecord[] (list)
GET    /repos/{repo_id}/analysis/configs/{id}            → ConfigRecord (get)
PUT    /repos/{repo_id}/analysis/configs/{id}            → ConfigRecord (update)
DELETE /repos/{repo_id}/analysis/configs/{id}            → void
POST   /repos/{repo_id}/analysis/configs/{id}/activate   → void (set as active)
GET    /repos/{repo_id}/presets                          → PresetOption[] (with scan-driven suggestions)
POST   /repos/{repo_id}/analysis/configs/validate        → ValidationResult
```

**ConfigRecord**:
```json
{
  "id": "uuid",
  "repo_id": "string",
  "is_active": true,
  "preset_id": "balanced",
  "config": { "...all GitAnalysisConfig fields..." },
  "include_patterns": ["src/*"],
  "exclude_patterns": ["node_modules/*"],
  "created_at": "2026-02-10T12:00:00Z",
  "updated_at": "2026-02-10T12:00:00Z"
}
```

**ValidationResult**:
```json
{
  "errors": ["Ticket ID pattern required"],
  "warnings": ["Decay half-life below 7 days"],
  "field_errors": { "ticket_id_pattern": ["Required when mode is by_ticket_id"] },
  "field_warnings": { "decay_half_life_days": ["May over-weight recency"] }
}
```

#### TASK-6: Run API (config-driven)

**Expected APIs**:
```
POST   /repos/{repo_id}/analysis/run                    → { run_id, state }
GET    /repos/{repo_id}/analysis/runs                   → RunRecord[]
GET    /repos/{repo_id}/analysis/runs/{run_id}          → RunRecord
GET    /repos/{repo_id}/analysis/runs/{run_id}/stream   → SSE stream
```

**Run request body**:
```json
{
  "config_id": "uuid (optional, uses active if omitted)"
}
```

**RunRecord**:
```json
{
  "run_id": "uuid",
  "config_id": "uuid",
  "state": "queued|running|completed|failed",
  "stage": "extracting|building_edges|computing_metrics|completed",
  "progress": 0.45,
  "processed_commits": 2034,
  "total_commits": 4520,
  "started_at": "...",
  "finished_at": "..."
}
```

### Phase 3: Engine Fixes

#### TASK-7: Runtime Config Integration
Make the engine use `AnalysisConfig` from DB instead of hardcoded defaults.
- `plugin.py` reads active config from storage
- `config.py` `CouplingConfig` populated from `AnalysisConfig`
- Single source of truth (DFIX-6)

#### TASK-8: Git Command Builder Fixes
Config-driven git log command construction.
- Parametrize `--find-renames` threshold (currently hardcoded 60%) — Issue #20
- Add `--no-merges` / `--first-parent` support — Issue #5 (critical)
- Support `ref` and `all_refs` — expose branch selection
- Support `--diff-filter`, `--numstat` flags
- `since`/`until` from config
- Include/exclude paths passed as git pathspec

**Expected git command builder**:
```python
def build_git_log_cmd(config: AnalysisConfig, repo_path: Path) -> list[str]:
    cmd = ["git", "-C", str(repo_path), "log", "--format=..."]
    if config.skip_merge_commits:
        cmd.append("--no-merges")
    if config.first_parent_only:
        cmd.append("--first-parent")
    if config.since:
        cmd.extend(["--since", config.since])
    if config.until:
        cmd.extend(["--until", config.until])
    cmd.extend([f"-M{config.find_renames_threshold}%"])
    if config.all_refs:
        cmd.append("--all")
    else:
        cmd.append(config.ref)
    return cmd
```

#### TASK-9: Extract & Changeset Fixes
- Issue #1: Implement `min_revisions` filtering (currently dead param)
- Issue #6: Parse `--numstat` output, populate line stats (currently always 0)
- Issue #8: Remove double changeset size filtering (extract.py + changesets.py)
- Issue #9: Remove dead changeset size penalty code in edges.py
- Issue #16: Add entity cache (`dict[str, int]`) to avoid per-file-per-commit SQL
- Issue #21: Batch transactions (per 500-1000 commits, not per change)
- Issue #22: Populate `end_commit_oid` on rename
- Issue #24: Add file extension/binary filtering (configurable exclude patterns)

#### TASK-10: Edge Computation Fixes
- Issue #2: Implement `min_component_cooccurrence` (currently dead param)
- Issue #3: Implement `window_days` (convert to `--since` or filter in extract)
- Issue #4: Implement `decay_half_life_days` (exponential decay weighting)
- Issue #7: Fix Jaccard denominator bug (separate weighted/unweighted counters)
- Issue #10: Fix `get_file_coupling` to be symmetric (UNION query) — critical
- `topk_edges_per_file` enforcement

#### TASK-11: Hotspot & Risk Score Fixes
- Issue #20: Unify risk score formula (two different formulas exist)
- Parametrize `hotspot_threshold` (currently hardcoded 50)
- Issue #28: `folder_details` returns hardcoded zeros — return computed values

### Phase 4: SSE Streaming

#### TASK-12: SSE Progress Streaming

**Expected API**:
```
GET /repos/{repo_id}/analysis/runs/{run_id}/stream
Content-Type: text/event-stream

data: {"state":"running","stage":"extracting","progress":0.12,"processed_commits":540,"total_commits":4520,"entity_count":1134,"relationship_count":2916,"elapsed_seconds":8}

data: {"state":"completed","stage":"completed","progress":1.0,...}
```

**Frontend hook** (`useSSE.ts`):
- Reconnect on disconnect with exponential backoff
- Parse SSE `data:` lines into typed events
- Replace mock `setInterval` implementation with real `EventSource`

### Phase 5: Frontend Integration (replace mocks with real APIs)

#### TASK-13: Shared FileTree Component
- Replace `previewMockTree()` calls with `POST /repos/{repo_id}/tree/preview`
- Keep virtualized rendering, tri-state status, language badges
- Debounced preview updates on filter change (300ms)
- FilesPage at `/repos/:id/git/files` stays unchanged (uses `FilesTree`)

#### TASK-14: Analysis Configurator (Shared)
- Replace mock presets with `GET /repos/{repo_id}/presets`
- Replace localStorage persistence with config CRUD API
- RefSelector already uses real API ✅
- Accept scan data as prop for smart defaults
- Move to shared location (DFIX-4)

#### TASK-15: Project Creation Wizard
Replace mock calls with real API calls:
- Step 1: `POST /repos` (auto-scan)
- Step 2: `GET /repos/{repo_id}/scan` (scan results with dates)
- Step 3: `GET /repos/{repo_id}/presets` (scan-driven suggestion)
- Step 4: Configurator + `POST /repos/{repo_id}/tree/preview`
- Step 5: `POST /repos/{repo_id}/analysis/configs` + `POST /repos/{repo_id}/analysis/run`

#### TASK-16: Dashboard Integration
- "New Analysis" / "Reconfigure" opens configurator with active config from API
- Analysis run status shows config used
- Progress panel uses real SSE hook (TASK-12)

### Phase 6: Performance Fixes

#### TASK-17: Scalability Fixes for Large Repos
- Issue #11: Streaming/chunked pair computation (avoid O(n²) in memory)
- Issue #12: Chunk-based Parquet processing
- Issue #13: Push hotspot sort/limit into SQL
- Issue #14: Sparse distance matrix for clustering
- Issue #15: Bulk `update_head_status_bulk` with temp table
- Issue #17: Pre-compute author count during extraction
- Issue #18: Arrow predicate pushdown for file-level queries

### Phase 7: Cleanup & Migration

#### TASK-18: Route Cutover & Legacy Removal
- Wire wizard as primary creation flow (replace `CreateRepoModal`)
- Remove old `SettingsView.tsx` analysis config section (replaced by shared configurator)
- Deprecate legacy `FolderTree.tsx` (replaced by shared FileTree)
- Remove compatibility bridge in `analyzers.py` once all clients use config API
- Issue #26: Align CLI defaults with config defaults
- Issue #30: Capture and log git stderr
- Clean build verification

---

## Dependency Graph

```
Phase 1: TASK-1 → TASK-2 → TASK-3
                ↘
Phase 2:   TASK-4, TASK-5 → TASK-6
                         ↘
Phase 3:            TASK-7 → TASK-8 → TASK-9 → TASK-10 → TASK-11
                              ↘
Phase 4:                  TASK-12
                              ↘
Phase 5:        TASK-13, TASK-14 → TASK-15 → TASK-16
                                              ↘
Phase 6:                                  TASK-17
                                              ↘
Phase 7:                                  TASK-18
```

---

## Issue Tracker Cross-Reference

All issues from `PARAMS_IMPLEMENTATION_REVIEW.md` mapped to tasks:

| Issue | Severity | Task | Description |
|-------|----------|------|-------------|
| #1 | 🔴 | TASK-9 | `min_revisions` dead param |
| #2 | 🔴 | TASK-10 | `min_component_cooccurrence` dead param |
| #3 | 🔴 | TASK-10 | `window_days` not implemented |
| #4 | 🔴 | TASK-10 | `decay_half_life_days` not implemented |
| #5 | 🔴 | TASK-8 | Merge commits not handled |
| #6 | 🔴 | TASK-9 | `--numstat` not used, line stats always 0 |
| #7 | 🔴 | TASK-10 | Jaccard denominator bug |
| #8 | 🔴 | TASK-9 | Double changeset size filtering |
| #9 | 🔴 | TASK-9 | Dead changeset penalty code |
| #10 | 🔴 | TASK-10 | Coupling query one-directional |
| #11 | 🟠 | TASK-17 | O(n²) pair computation |
| #12 | 🟠 | TASK-17 | Full Parquet in memory |
| #13 | 🟠 | TASK-17 | Hotspot full table scan |
| #14 | 🟠 | TASK-17 | NxN clustering matrix |
| #15 | 🟠 | TASK-17 | Bulk update O(n) queries |
| #16 | 🟠 | TASK-9 | Entity lookup no caching |
| #17 | 🟠 | TASK-17 | Author count full load |
| #18 | 🟠 | TASK-17 | File queries full Parquet load |
| #19 | 🟡 | TASK-1 | Entity index missing kind |
| #20 | 🟡 | TASK-11 | Risk score formula inconsistency |
| #21 | 🟡 | TASK-9 | Transaction per change |
| #22 | 🟡 | TASK-9 | Rename end_commit_oid never set |
| #23 | 🟡 | — | Author time window (documented, acceptable) |
| #24 | 🟡 | TASK-9 | No binary/extension filtering |
| #25 | 🟡 | TASK-10 | LIKE path filtering bug |
| #26 | 🟢 | TASK-18 | CLI vs config default mismatch |
| #27 | 🟢 | TASK-17 | No connection pooling |
| #28 | 🟢 | TASK-11 | folder_details hardcoded zeros |
| #29 | 🟢 | TASK-1 | Missing ON DELETE CASCADE |
| #30 | 🟢 | TASK-18 | Git stderr not captured |
