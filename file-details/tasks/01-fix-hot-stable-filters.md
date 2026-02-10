# Task 01: Fix Hot / Stable Quick Filters Not Working

## Problem Summary
The current `hot` and `stable` quick filters are unreliable because metric semantics are inconsistent across layers.

Observed issues:
- Frontend quick filters in `FilterEngine.ts` assume `churn` is a frequency-like signal.
- Frontend mapping in `useFilesFilters.ts` and `FilesPage.tsx` computes `churn` as `lines_added + lines_deleted` (raw volume), which breaks threshold meaning.
- Tree payload currently comes from `build_file_tree()` in `src/git-analyzer/git_analyzer/sync.py`, and is too sparse for robust classification.
- The extractor currently writes `total_lines_added/total_lines_deleted` as zeros in many repos, so line-based churn is not a reliable source for quick filters.
- Some files can have missing or partial history (`total_commits = 0`), which must be treated explicitly.

## Design Goal
Define one canonical, explainable, data-driven `hot/stable` classification owned by backend, then let frontend consume flags instead of re-deriving behavior from mixed fields.

## Canonical Definitions

### Core Per-File Metrics
For each file at HEAD:
- `total_commits`
- `first_commit_ts`
- `last_commit_ts`
- `days_since_last_change`
- `commits_30d`
- `commits_90d`
- `lifetime_commits_per_month`

Derived:
- `lifetime_commits_per_month = total_commits / max(1, (last_commit_ts - first_commit_ts) / 86400 / 30)`

### Repo-Level Dynamic Thresholds
Compute per repository after analysis:
- `T_hot30 = max(3, P95(commits_30d))`
- `T_hot90 = max(6, P90(commits_90d))`
- `T_hotRate = max(3.0, P90(lifetime_commits_per_month))`
- `T_stableDays = max(180, P75(days_since_last_change))`
- `T_stable90 = min(1, P25(commits_90d))`
- `T_stableRate = min(1.0, P50(lifetime_commits_per_month))`

### Final Classification
- `is_hot`:
  - `commits_30d >= T_hot30`
  - OR `(commits_90d >= T_hot90 AND days_since_last_change <= 90)`
  - OR `(lifetime_commits_per_month >= T_hotRate AND days_since_last_change <= 30)`
- `is_stable`:
  - `NOT is_hot`
  - AND `total_commits >= 3`
  - AND `days_since_last_change >= T_stableDays`
  - AND `commits_90d <= T_stable90`
  - AND `lifetime_commits_per_month <= T_stableRate`
- `is_unknown`:
  - `total_commits = 0`
  - OR `last_commit_ts IS NULL`

Notes:
- `hot` and `stable` are mutually exclusive.
- Unknown-history files are excluded from both.
- This avoids dependence on line-churn quality until numstat ingestion is fixed.

## Global Solution (Frontend + Backend + Data)

## Backend Design

### 1) Materialize File Activity Metrics
Add a post-analysis materialization step in git analyzer (new helper in `file_metrics.py` or `extract.py`):
- Read `entities.metadata_json` for commit timestamps/counts.
- Read `changes.parquet` to compute `commits_30d` and `commits_90d`.
- Compute per-file derived metrics and repo-level thresholds.
- Persist:
  - Per-file metrics + flags (`is_hot`, `is_stable`, `is_unknown`).
  - Repo thresholds snapshot for traceability/debugging.

### 2) Enrich Tree API Contract
Update `build_file_tree()` and `/repos/{id}/git/tree` response to include:
- `total_commits`
- `last_modified` (ISO from `last_commit_ts`)
- `commits_30d`
- `commits_90d`
- `lifetime_commits_per_month`
- `days_since_last_change`
- `is_hot`
- `is_stable`
- `is_unknown`

This makes quick filters deterministic and removes frontend guesswork.

### 3) Keep Existing Endpoints Compatible
Do not break current consumers:
- Keep existing fields (`commits`, etc.).
- Add new fields additively.
- If metrics unavailable, set `is_unknown = true`.

## Frontend Design

### 1) Filter Logic Becomes Flag-First
In `src/frontend/src/shared/filters/FilterEngine.ts`:
- `hot` filter uses `item.is_hot === true` when available.
- `stable` filter uses `item.is_stable === true` when available.
- Fallback formula allowed only when flags are absent (migration safety).

### 2) Stop Recomputing Ambiguous Churn for Quick Filters
In:
- `src/frontend/src/features/git/files/useFilesFilters.ts`
- `src/frontend/src/features/git/FilesPage.tsx`

Do not use `(lines_added + lines_deleted)` to drive hot/stable. Keep it only as display metric if needed.

### 3) Unify Filter Chips and Row Badges
For upcoming icon restoration task:
- `FileRow.tsx` should render `hot/stable/risky/coupled` badges using same predicates as `FilterEngine`.
- No duplicate custom thresholds in UI components.

## Data / DB Design

### Phase 1 (Fast, Low-Risk)
Persist new fields in `entities.metadata_json`:
- `commits_30d`, `commits_90d`
- `days_since_last_change`
- `lifetime_commits_per_month`
- `is_hot`, `is_stable`, `is_unknown`

Persist thresholds in `repo_meta`:
- key: `hot_stable_thresholds`
- value: JSON snapshot with all threshold values and timestamp.

### Phase 2 (Scalable Query Model)
Add normalized table:

```sql
CREATE TABLE IF NOT EXISTS git_file_metrics (
  entity_id INTEGER PRIMARY KEY REFERENCES entities(entity_id),
  total_commits INTEGER NOT NULL DEFAULT 0,
  first_commit_ts INTEGER,
  last_commit_ts INTEGER,
  commits_30d INTEGER NOT NULL DEFAULT 0,
  commits_90d INTEGER NOT NULL DEFAULT 0,
  lifetime_commits_per_month REAL NOT NULL DEFAULT 0,
  days_since_last_change INTEGER,
  is_hot BOOLEAN NOT NULL DEFAULT 0,
  is_stable BOOLEAN NOT NULL DEFAULT 0,
  is_unknown BOOLEAN NOT NULL DEFAULT 1,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_git_file_metrics_hot ON git_file_metrics(is_hot);
CREATE INDEX IF NOT EXISTS idx_git_file_metrics_stable ON git_file_metrics(is_stable);
CREATE INDEX IF NOT EXISTS idx_git_file_metrics_last_change ON git_file_metrics(days_since_last_change);
```

Use this table for fast filtering and predictable contracts once stable.

## Implementation Plan

1. Add backend metric materialization and classification.
2. Extend tree payload with new fields and ISO `last_modified`.
3. Update frontend types (`TreeNode`, `FlatFileNode`, `FilterableItem`) for new flags/metrics.
4. Refactor `matchesQuickFilter()` to flag-first logic.
5. Add unknown-history handling (`is_unknown`) in UI state (optional badge/tooltip).
6. Add tests and backfill existing repositories.

## Tests and Validation

### Backend Tests
- Unit test classification helper with synthetic repos:
  - high recent activity => `is_hot`
  - old/low-frequency files => `is_stable`
  - missing history => `is_unknown`
- Integration test `/git/tree` includes new fields for all file nodes.

### Frontend Tests
- `matchesQuickFilter('hot')` and `'stable'` with flag-first behavior.
- Regression tests for table/tree filtering consistency.
- Badge rendering parity with quick filters.

### Acceptance Criteria
- Toggling `hot`/`stable` immediately changes visible file set in both tree and table.
- `hot` and `stable` results are explainable by returned metrics and thresholds.
- Files with missing history are not mislabeled as stable/hot.
- No dependency on line churn for quick filter correctness.

## Risks and Mitigations
- Risk: repos with partial analysis have sparse history.
  - Mitigation: explicit `is_unknown` state and conservative fallback.
- Risk: percentile thresholds too strict/loose in tiny repos.
  - Mitigation: floor/ceiling clamps (`max(3, ...)`, `min(1, ...)`) and minimum commit guard.
- Risk: frontend/back mismatch during rollout.
  - Mitigation: additive API fields and fallback formula until full migration completes.

## Deliverable for This Task
Adopt backend-owned, activity-based `hot/stable` classification and migrate frontend quick filters to consume canonical flags from `/git/tree`.
