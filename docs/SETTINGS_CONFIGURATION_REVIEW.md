# Settings Configuration Review — Project Creation & Parameter Usage

## Overview

Fix the issues related to the implementation of settings in project creation.

Code is proof-of-concept, so no retrocompatibility should be kept. Should clean/remove old code and recreate the expected behavior.

## Verification Status (Current)

✅ **Verified as still relevant:**
- ISSUE 001: Extension filters not exposed (GitAnalysisConfig interface missing fields)
- ISSUE 010: `data_dir` hardcoded throughout (all routers use `data_dir: str = "data"` instead of DEFAULT_DATA_DIR)
- ISSUE 015: `repo_id` collision risk (still using simple character replacement at line 237)
- ISSUE 016: Frontend `RepoInfo` missing `validation_issues` and `has_errors` fields

⚠️ **Likely still relevant (based on file structure):**
- ISSUE 002-009, 011-014, 017-020

🔄 **Requires deeper verification:**
- Issues related to runtime behavior and SSE streams

---

Some changed files (not all):

src/frontend/src/App.tsx +153 -60
src/frontend/src/api/analyzers.ts +1 -1
src/frontend/src/api/git.ts +63 -5
src/frontend/src/api/repos.ts +25 -0
src/frontend/src/features/dashboard/AnalysisDashboard.tsx +57 -21
src/frontend/src/features/dashboard/AnalyzerStatusPanel.tsx +72 -56
src/frontend/src/features/git/clustering/constants/index.ts +2 -8
src/frontend/src/features/settings/SettingsView.tsx +79 -147
src/frontend/src/hooks/index.ts +1 -0
src/frontend/src/shared/index.ts +1 -0
src/git-analyzer/git_analyzer/api.py +36 -21
src/git-analyzer/git_analyzer/changesets.py +19 -4
src/git-analyzer/git_analyzer/cli.py +2 -2
src/git-analyzer/git_analyzer/config.py +57 -8
src/git-analyzer/git_analyzer/edges.py +47 -24
src/git-analyzer/git_analyzer/extract.py +162 -77
src/git-analyzer/git_analyzer/git.py +116 -9
src/git-analyzer/git_analyzer/plugin.py +67 -23
src/git-analyzer/git_analyzer/runner.py +48 -4
src/platform/code_intel/app.py +16 -1
src/platform/code_intel/orchestrator.py +3 -2
src/platform/code_intel/routers/analyzers.py +11 -0
src/platform/code_intel/routers/git.py +82 -115
src/platform/code_intel/routers/repos.py +216 -114
src/platform/code_intel/schema.py +168 -74
src/platform/code_intel/storage.py +632 -50
src/platform/code_intel/storage.py.legacy +0 -732

## ISSUE 001 — `include_extensions` / `exclude_extensions` Not Exposed in Frontend

**Severity**: Feature gap  
**Value**: Extension-based filtering is critical for large polyglot repos (filter `.test.ts`, `.md`, etc.)  
**Concerned files**:
- `src/frontend/src/features/settings/gitAnalysisConfig.ts` — `GitAnalysisConfig` interface lacks `include_extensions` and `exclude_extensions`
- `src/frontend/src/features/project-wizard/steps/ConfigureStep.tsx` — No UI for extension filters
- `src/frontend/src/features/settings/GitAnalysisConfigurator.tsx` — No field renderer for extensions
- `src/git-analyzer/git_analyzer/analysis_config.py` — Backend defines these fields with schemas
- `src/git-analyzer/git_analyzer/extract.py:110-113` — Backend uses them for filtering

**Expected behavior**: The frontend `GitAnalysisConfig` should include `include_extensions` and `exclude_extensions` arrays. The ConfigureStep should expose chip-input or textarea fields for these. The `buildGitAnalyzerRunConfig()` should serialize them in the payload. The backend already supports them in `CouplingConfig`, `GitAnalysisConfig`, and the extractor.

---

## ISSUE 002 — `since` / `until` Not Sent When Set via Slider

**Severity**: Bug (correctness)  
**Value**: Users set date ranges via the slider but analysis may ignore them  
**Concerned files**:
- `src/frontend/src/features/settings/gitAnalysisConfig.ts` — `buildGitAnalyzerRunConfig()` only sends `since`/`until` when truthy, but `normalizeGitAnalysisConfig()` can set them to `null` even after slider interaction if the value equals the slider min/max
- `src/frontend/src/features/settings/GitAnalysisConfigurator.tsx` — `CommitRangeSection` slider sets values to boundary dates rather than leaving them `null`
- `src/git-analyzer/git_analyzer/runner.py:52-58` — `effective_since` logic falls through to `window_days` when `since` is `None`

**Expected behavior**: When the user explicitly moves the "since" slider to the left boundary (first commit date), the intent is "analyze all" — the slider should set `since = null` (not the boundary date). Currently, dragging the since slider always produces a date string, which unnecessarily constrains the query even when the user wants "all history." Add a "clear" button next to each date input. Also, when `since` equals `firstCommitDate`, treat it as `null` before sending.

---

## ISSUE 003 — Preset Duplication Between Frontend and Backend

**Severity**: Maintainability / correctness risk  
**Value**: Single source of truth prevents drift between FE/BE preset definitions  
**Concerned files**:
- `src/frontend/src/features/settings/gitAnalysisConfig.ts` — `BEHAVIOR_PRESETS` array (frontend copy)
- `src/git-analyzer/git_analyzer/presets.py` — `PRESETS` list (backend canonical)
- `src/platform/code_intel/routers/analysis.py` — `/presets` endpoint serves backend presets
- `src/frontend/src/features/project-wizard/ProjectWizard.tsx` — `toPresetOptions()` consumes backend presets

**Expected behavior**: The frontend `BEHAVIOR_PRESETS` and the backend `PRESETS` define overlapping but slightly different data (FE has `group`, `use_when`, `overrides`; BE has flat `config`). The wizard correctly fetches presets from backend, but the `GitAnalysisConfigurator` uses the hardcoded FE presets for `applyBehaviorPreset()`. This means applying a preset in the configurator may produce different config values than what the backend returns. The FE should either:
1. Fetch and cache presets from backend, or
2. At minimum, validate on startup that FE and BE preset configs match

---

## ISSUE 004 — `suggest_preset` Backend vs `computeSmartDefaultsFromScan` Frontend Divergence

**Severity**: Correctness  
**Value**: Inconsistent recommendations confuse users  
**Concerned files**:
- `src/git-analyzer/git_analyzer/presets.py` — `suggest_preset()`: recommends "quality" for angular/react/nextjs
- `src/frontend/src/features/settings/gitAnalysisConfig.ts` — `suggestPresetFromSignals()`: recommends "quality" for fastapi/django, "balanced" for react/nextjs

**Expected behavior**: Both recommendation engines should agree. Currently the backend recommends "quality" for React apps while the frontend recommends "balanced" for the same. The frontend's `computeSmartDefaultsFromScan` runs when no existing config is found and the wizard is initializing — this is the primary path for new projects. **Fix**: Remove frontend duplicate logic; always use the backend `/presets` endpoint which returns `recommendation_reason`.

---

## ISSUE 005 — `buildGitAnalyzerRunConfig` Missing `include_paths` / `exclude_paths`

**Severity**: Bug (correctness)  
**Value**: Scope patterns configured in the wizard may not reach the analyzer  
**Concerned files**:
- `src/frontend/src/features/settings/gitAnalysisConfig.ts` — `buildGitAnalyzerRunConfig()` does NOT include `include_paths` or `exclude_paths` in the returned payload
- `src/frontend/src/features/project-wizard/ProjectWizard.tsx:237-243` — Correctly passes `include_patterns` / `exclude_patterns` to `createAnalysisConfig`, which stores them in DB
- `src/platform/code_intel/routers/analysis.py:321-323` — `run_analysis` correctly injects them from config record into `config_payload`

**Expected behavior**: The flow actually works correctly end-to-end because patterns are stored at the config-record level (not inside `config_json`) and the `run_analysis` endpoint appends them. **However**, `buildGitAnalyzerRunConfig()` is misleading — it appears to be the complete config but omits patterns. If any caller uses it directly (e.g. the SettingsView), patterns will be lost. Add `include_paths` and `exclude_paths` to the payload, or document clearly that patterns are stored separately.

---

## ISSUE 006 — SettingsView Cannot Run Analysis with Updated Config

**Severity**: Feature gap  
**Value**: Users who tweak settings from the dashboard have no way to re-run analysis  
**Concerned files**:
- `src/frontend/src/features/settings/SettingsView.tsx` — Has a "Save" button that creates/updates config, but no "Run Analysis" action
- `src/frontend/src/features/dashboard/AnalysisDashboard.tsx:304` — Mounts SettingsView
- `src/frontend/src/api/analysis.ts` — `runAnalysis()` exists but isn't called from SettingsView

**Expected behavior**: After saving settings, the user should be able to trigger a re-analysis from the settings tab (or be redirected to the wizard's review step). Currently the only way to run analysis is through the wizard flow.

---

## ISSUE 007 — `config_schema` from Backend Not Used in Frontend

**Severity**: Feature gap / Extensibility  
**Value**: Dynamic schema enables adding new analyzers without frontend changes  
**Concerned files**:
- `src/platform/code_intel/registry.py` — `list_all()` returns `config_schema` per analyzer
- `src/platform/code_intel/routers/analyzers.py` — Returns `config_schema` in `AnalyzerInfo`
- `src/frontend/src/api/analyzers.ts` — `AnalyzerInfo` type has no `config_schema` field
- `src/frontend/src/features/settings/GitAnalysisConfigurator.tsx` — All fields are hardcoded
- `src/git-analyzer/git_analyzer/analysis_config.py` — Rich `FIELD_SCHEMAS` with metadata (`x_group`, `description`, `minimum`, etc.)

**Expected behavior**: The backend provides a detailed JSON Schema per analyzer with field metadata (`x_group: "important" | "advanced"`, descriptions, constraints). The frontend should:
1. Add `config_schema: Record<string, any>` to the `AnalyzerInfo` type
2. Use the schema to auto-generate form fields, or at least validate that FE fields match BE schema
3. For non-git analyzers (deps, semantic), the schema is the only way to render config forms

---

## ISSUE 008 — Duplicate `CouplingConfig` and `GitAnalysisConfig` Dataclasses

**Severity**: Maintainability  
**Value**: Single config model prevents field drift and serialization bugs  
**Concerned files**:
- `src/git-analyzer/git_analyzer/config.py` — `CouplingConfig` dataclass
- `src/git-analyzer/git_analyzer/analysis_config.py` — `GitAnalysisConfig` dataclass

**Expected behavior**: Both classes define the same fields. `CouplingConfig` is used by the extractor/runner. `GitAnalysisConfig` is used by the API layer. The plugin converts between them (`normalize_config_dict` → `CouplingConfig.from_dict`). Having two classes with identical fields risks drift. **Fix**: Keep `GitAnalysisConfig` (the API-facing one) as the single source of truth and make `CouplingConfig` a thin alias or subclass, or merge them entirely.

---

## ISSUE 009 — No Backend Validation of `since`/`until` Against Scan Boundaries

**Severity**: UX / Correctness  
**Value**: Prevents empty-result runs when date range falls outside repo history  
**Concerned files**:
- `src/platform/code_intel/routers/analysis.py:291-340` — `run_analysis` does not check if `since`/`until` overlap with scan's `first_commit_date`/`last_commit_date`
- `src/git-analyzer/git_analyzer/plugin.py` — `validate_config()` validates format but not semantic range

**Expected behavior**: If a user sets `since=2025-01-01` but the repo's last commit is `2024-06-01`, the analysis will process zero commits and produce an empty result with no warning. The validation endpoint should cross-reference dates against the scan and add a warning (not error) when the range may yield no data.

---

## ISSUE 010 — `data_dir` Query Parameter Hardcoded Throughout

**Severity**: Scalability / Extensibility  
**Value**: Multi-tenant or dockerized deployments need configurable data dirs  
**Concerned files**:
- `src/platform/code_intel/routers/repos.py` — `data_dir: str = "data"` on every endpoint
- `src/platform/code_intel/routers/git.py` — Same pattern
- `src/platform/code_intel/routers/analysis.py` — Same pattern
- `src/platform/code_intel/config.py` — `DEFAULT_DATA_DIR` exists but isn't consistently used

**Expected behavior**: `DEFAULT_DATA_DIR` from `config.py` (env-configurable) should be the single default. Currently every router function has `data_dir: str = "data"` as a parameter default, ignoring the centralized config. This means the env var `CODE_INTEL_DATA_DIR` has no effect on most endpoints. **Fix**: Use `data_dir: str = Query(default=None)` and resolve to `DEFAULT_DATA_DIR` when None.

---

## ISSUE 011 — Storage Connections Not Pooled — Performance Risk for Large Projects

**Severity**: Performance  
**Value**: Connection pooling prevents SQLite contention under concurrent requests  
**Concerned files**:
- `src/platform/code_intel/storage.py` — Every endpoint call creates a new `Storage` → new `sqlite3.Connection`
- `src/platform/code_intel/routers/git.py` — `_storage()` creates new connection per request
- `src/platform/code_intel/routers/repos.py` — `get_storage()` creates new connection per request
- `src/platform/code_intel/routers/analysis.py` — Same pattern

**Expected behavior**: For large projects with many concurrent dashboard queries, opening/closing connections on every request adds overhead and risks WAL checkpoint contention. Use a per-repo connection cache or FastAPI dependency injection with a connection pool. At minimum, use `check_same_thread=False` and share connections within a request lifecycle.

---

## ISSUE 012 — Wizard `quickStart` Bypasses Pattern Preview

**Severity**: UX  
**Value**: Quick-start users should know what scope was analyzed  
**Concerned files**:
- `src/frontend/src/features/project-wizard/ProjectWizard.tsx:261-295` — `handleQuickStart` skips scan/preset/configure steps, uses default include/exclude patterns (`src/*\ntests/*` and `node_modules/*\ndist/*\ncoverage/*`)

**Expected behavior**: The hardcoded default patterns in the state initializers (`useState<string>('src/*\ntests/*')`) are sent during quick-start but never shown to the user. After quick-start completes, the user should see a summary of what scope was used, or the defaults should be computed from the scan (e.g., detect if `src/` exists).

---

## ISSUE 013 — Backend `/presets` Returns Different Shape Than Frontend Expects

**Severity**: Correctness  
**Value**: Ensures preset application works identically in wizard and configurator  
**Concerned files**:
- `src/platform/code_intel/routers/analysis.py:247-268` — Returns `PresetOption` with `config: dict` (flat overrides)
- `src/frontend/src/features/project-wizard/ProjectWizard.tsx:94-110` — `toPresetOptions` strips `config` and only keeps `changed_fields: Object.keys(preset.config)`
- `src/frontend/src/features/settings/gitAnalysisConfig.ts` — `BEHAVIOR_PRESETS` has `overrides` with actual values

**Expected behavior**: The wizard fetches presets from backend but discards the actual config values — it only uses `changed_fields` for display. The actual preset application in `handlePresetNext()` uses the FE-hardcoded `applyBehaviorPreset()`. This means the backend preset configs are effectively unused. **Fix**: Use the backend preset `config` values when applying a preset in the wizard.

---

## ISSUE 014 — SSE Stream Polls DB Every Iteration — Inefficient for Large Projects

**Severity**: Performance  
**Value**: Reduces DB load during long-running analyses  
**Concerned files**:
- `src/platform/code_intel/routers/analysis_stream.py` — SSE endpoint polls `analysis_tasks` table in a loop
- `src/platform/code_intel/storage.py` — `get_task()` opens/closes or queries DB per poll

**Expected behavior**: The SSE endpoint is implemented and emits correctly shaped `progress` events. However, it polls the DB on every iteration (likely every 1-2 seconds). For long-running analyses on large repos, this creates sustained DB read pressure. Consider: (1) increasing poll interval progressively (e.g., 1s → 2s → 5s as progress plateaus), (2) using an in-memory event bus between the runner and the stream endpoint.

---

## ISSUE 015 — `repo_id` Generation Can Collide

**Severity**: Correctness  
**Value**: Prevents data corruption when repos have similar names  
**Concerned files**:
- `src/platform/code_intel/routers/repos.py:149-150` — `repo_id = "".join(c if c.isalnum() else "_" for c in repo_name.lower()).strip("_") or "repo"`

**Expected behavior**: Two repos named "My-App" and "my_app" produce the same `repo_id = "my_app"`, overwriting each other's data. Add a short hash suffix or check for collision before creating.

---

## ISSUE 016 — Frontend `RepoInfo` Missing `validation_issues` and `has_errors`

**Severity**: Feature gap  
**Value**: Dashboard should display validation quality signals  
**Concerned files**:
- `src/frontend/src/api/repos.ts` — `RepoInfo` interface lacks `validation_issues` and `has_errors`
- `src/platform/code_intel/routers/repos.py:40-42` — Backend `RepoInfo` model includes both fields
- `src/frontend/src/features/repos/RepoList.tsx` — No display of validation status

**Expected behavior**: Add `validation_issues: number` and `has_errors: boolean` to the frontend `RepoInfo` type. Display a warning badge on repo cards when `validation_issues > 0` or `has_errors === true`.

---

## ISSUE 017 — `GitAnalysisConfig.preset_id` Not Tracked After Manual Edits

**Severity**: UX  
**Value**: Users should know when their config has drifted from a preset  
**Concerned files**:
- `src/frontend/src/features/settings/GitAnalysisConfigurator.tsx` — `updateField` normalizes but doesn't reset `preset_id` to "custom"
- `src/frontend/src/features/settings/gitAnalysisConfig.ts` — `normalizeGitAnalysisConfig` preserves existing `preset_id`

**Expected behavior**: When a user manually changes a field that differs from the active preset's overrides, `preset_id` should automatically switch to `"custom"`. Currently it stays on the original preset ID, making the review step misleadingly show a preset name for a customized config.

---

## ISSUE 018 — Tree Preview Lacks Pattern-Based Status Annotation

**Severity**: Integration gap  
**Value**: Tree preview with include/exclude status is the core UX of the configure step  
**Concerned files**:
- `src/platform/code_intel/routers/tree.py:161-171` — `preview_tree` accepts `include_patterns`/`exclude_patterns` but delegates to `fetch_tree_rows_for_preview`
- `src/platform/code_intel/storage.py` — `fetch_tree_rows_for_preview` — need to verify it applies pattern matching and annotates `status`
- `src/frontend/src/features/project-wizard/steps/ConfigureStep.tsx` — Expects nodes with `status` field
- `src/frontend/src/mocks/treeMock.ts` — `collectPathsByStatus` reads `status` from tree nodes

**Expected behavior**: Verify that `fetch_tree_rows_for_preview` applies include/exclude glob patterns to each tree node and returns `status: "included" | "excluded"` per node. If it only returns raw tree structure without status annotation, the ConfigureStep's visual filtering (dimmed excluded files, selected included files) will not work.

---

## ISSUE 019 — No "Re-analyze" Button on Dashboard

**Severity**: UX  
**Value**: Common workflow — view results, tweak params, re-run  
**Concerned files**:
- `src/frontend/src/features/dashboard/AnalysisDashboard.tsx` — No re-run action
- `src/frontend/src/App.tsx:103-115` — Has route for `/repos/:repoId/wizard` (existing repo wizard)

**Expected behavior**: Add a prominent "Re-analyze" or "New Analysis" button on the dashboard header that navigates to `/repos/:repoId/wizard`. The route exists but there's no UI affordance to reach it.

---

## ISSUE 020 — `analysis_configs` Unique Active Constraint May Fail Silently

**Severity**: Correctness  
**Value**: Ensures exactly one active config per repo  
**Concerned files**:
- `src/platform/code_intel/schema.py:85-87` — Unique partial index `idx_configs_active_per_repo ON analysis_configs(repo_id) WHERE is_active = 1`
- `src/platform/code_intel/storage.py:914-951` — `create_analysis_config` inserts with `is_active=0` then calls `set_active_config` if needed

**Expected behavior**: The `set_active_config` method should deactivate all other configs for the repo first, then activate the target. Verify this happens atomically (within a transaction) to prevent race conditions when multiple wizard runs overlap.

---

## Summary Priority

**Legend:**
- ✅ = Verified still exists
- ⚠️ = Likely still exists
- 🔄 = Needs deeper verification

| # | Issue | Type | Priority | Status |
|---|-------|------|----------|--------|
| 001 | Extension filters not in frontend | Feature gap | High | ✅ Verified |
| 002 | Since/until slider boundary bug | Bug | High | ⚠️ Likely |
| 004 | Preset recommendation divergence FE/BE | Bug | High | ⚠️ Likely |
| 010 | data_dir ignores env config | Bug | **Critical** | ✅ Verified (92 occurrences) |
| 015 | repo_id collision | Bug | **Critical** | ✅ Verified (line 237) |
| 005 | buildGitAnalyzerRunConfig missing paths | Misleading API | Medium | ⚠️ Likely |
| 008 | Duplicate config dataclasses | Maintainability | Medium | ⚠️ Likely |
| 013 | Backend preset config values unused | Bug | High | ⚠️ Likely |
| 003 | Preset duplication FE/BE | Maintainability | Medium | ⚠️ Likely |
| 006 | No run from settings | Feature gap | Medium | ⚠️ Likely |
| 007 | config_schema unused | Extensibility | Medium | ⚠️ Likely |
| 009 | No date range vs scan validation | UX | Medium | ⚠️ Likely |
| 011 | No connection pooling | Performance | Medium | ⚠️ Likely |
| 012 | Quick-start scope not shown | UX | Low | ⚠️ Likely |
| 014 | SSE stream inefficiency | Performance | Medium | 🔄 Runtime |
| 016 | Missing FE fields | Feature gap | Low | ✅ Verified |
| 017 | preset_id not reset on edit | UX | Medium | ⚠️ Likely |
| 018 | Tree preview pattern matching | Integration | Medium | 🔄 Needs test |
| 019 | No re-analyze button | UX | Medium | ⚠️ Likely |
| 020 | Active config race condition | Correctness | Low | 🔄 Runtime |

**Immediate Action Items:**
1. **ISSUE 010** (Critical): Fix `data_dir` to use `DEFAULT_DATA_DIR` from config
2. **ISSUE 015** (Critical): Add hash suffix or collision check for `repo_id` generation
3. **ISSUE 001** (High): Add extension filter fields to frontend interface
4. **ISSUE 016** (Low but easy): Add missing fields to `RepoInfo` interface
