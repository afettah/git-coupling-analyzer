# Parametrable Analysis Progress

Updated: 2026-02-11

Scope policy used for this implementation:
- No migration path (forward schema only).
- Existing stored data is ignored.

## Current status

The full V2 flow from `v2/parametable/todo-full.md` is implemented and functional for the core product path:
- Repo creation triggers scan.
- Tree preview is API-backed.
- Project-scoped config CRUD exists.
- Run execution is config-driven.
- Progress streaming uses SSE.
- Wizard uses real backend APIs.
- Settings analysis config now persists to backend config APIs (not localStorage).

## Completed work

### Backend foundation and APIs
- Schema/storage redesigned for project-scoped configs and scans:
  - `analysis_configs.repo_id`, `analysis_configs.is_active`
  - unique active config per repo index
  - `analysis_tasks.config_id`
  - `project_scan.repo_id`, `project_scan.total_dirs`, commit date fields
  - `project_tree.repo_id`, `project_tree.name`
  - entity unique index fixed to `(qualified_name, kind)`
  - broader `ON DELETE CASCADE` usage
- Storage layer expanded:
  - `get_active_config(repo_id)`
  - `set_active_config(repo_id, config_id)`
  - config CRUD/list/update/delete
  - run/task list/read helpers
  - scan/tree read helpers for preview
- Repos API updated:
  - `POST /repos` auto-scans and returns scan summary
  - `POST /repos/{repo_id}/scan`
  - `GET /repos/{repo_id}/scan`
  - improved creation error handling (hard failure on create errors)
- Added tree API:
  - `GET /repos/{repo_id}/tree`
  - `POST /repos/{repo_id}/tree/preview`
- Added analysis API:
  - config CRUD + activate + validate
  - presets endpoints with scan-driven recommendation
  - run endpoints (create/list/get)
- Added analysis SSE API:
  - `GET /repos/{repo_id}/analysis/runs/{run_id}/stream`

### Git analyzer engine integration and fixes
- Single-source config model added in `analysis_config.py`; plugin now uses it.
- Scanner implemented with persisted scan + tree data and commit date metrics.
- Preset system implemented (balanced/quality/fast/explore + recommendation helper).
- Git extraction/edge pipeline improvements include:
  - `--numstat` parsing and real line stats
  - include/exclude path and extension filtering
  - rename lineage end commit updates
  - entity cache to reduce repeated DB lookups
  - batched transaction commits
  - dead changeset penalty branch removed
- API fixes:
  - symmetric file coupling query
  - unified risk score formula
  - folder details endpoint returns computed values
- Runner progress metrics improved and exposed for SSE.
- CLI defaults aligned with config defaults.
- Git stderr capture/logging improved.

### Frontend integration
- Wizard cut over from mocks to real APIs:
  - create repo, read scan, fetch presets, tree preview, create config, run analysis, consume SSE
- Added API clients:
  - `src/frontend/src/api/analysis.ts`
  - `src/frontend/src/api/tree.ts`
- Ref selector uses backend refs API only.
- Configurator moved to shared feature location and used by wizard + settings.
- Settings passes `repoId` into configurator.
- App/dashboard routing keeps wizard as creation/re-run entrypoint.
- Settings analysis config persistence moved to backend config API.
- Wizard now pre-fills from existing active backend config for existing repos.
- Dashboard status surfaces now use analysis config/run APIs:
  - active config display
  - latest run `config_id` display
- Legacy frontend analysis local-storage compatibility path removed.

### Strict cutover cleanup (no backward compatibility)
- Removed analysis config schema compatibility columns and bumped schema to v3.
- Removed storage task `_config_id` fallback bridge.
- Removed duplicate legacy handlers from `routers/git.py`.
- Removed legacy `storage.py.legacy`.
- Git analyzer legacy run endpoint (`/analyzers/run` for `git`) now returns explicit cutover response (`410`), with canonical path at `/analysis/run`.
- Repos create flow transaction boundary fixed (commit before scan transaction).
- Performance hardening: bulk head-status updates now run in chunked/batched SQL (avoids per-file update loops).

## Verification completed

- Frontend build: `npm run build` passed.
- Scoped backend tests: `pytest tests --ignore=tests/test_quick_check.py --ignore=tests/test_clustering.py` passed (52 tests).
- Python compile checks: `python -m compileall src/platform src/git-analyzer` passed.
- Runtime smoke test passed:
  - temp git repo creation
  - scan persistence
  - config creation/activation
  - analysis run completion
  - task persistence
- New automated API coverage added:
  - config activation invariant (single active config per repo)
  - repo create + scan + tree preview flow
  - run + SSE lifecycle with config linkage validation (`config_id`)

## Remaining work / next steps

- Mandatory V2 parametrable scope is complete under strict cutover policy (no migration, no compatibility bridge).
- Optional: split frontend bundle chunks to reduce Vite large-chunk warning.
