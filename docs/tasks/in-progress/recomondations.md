# Improvement Review: Fix Critical Data Corruption

**Created:** February 1, 2026
**Status:** Proposed
**Priority:** High

> Scope: challenge decisions and implementations and propose improvements only. No summary of existing advantages.

---

## Improvements

### 1) Preserve evidence instead of silently skipping invalid tokens
**Issue:** The parsing loop drops invalid status/path tokens without recording them, which makes root-cause analysis and regression detection harder.

**Better approach:** Always record a `ValidationIssue` (including raw token, cursor position, and surrounding tokens) for any rejected status or path. Only skip after logging. Store a capped sample payload per run (e.g., top 200 issues) and aggregated counts for the rest.

**Why better:** You keep a defensible audit trail for corruption sources, and can compare parsing quality across versions and repos.

**Expected gain:** Faster diagnosis and reduced time-to-fix for future parsing regressions; improved trust in analytics.

---

### 2) Make validation deterministic with a strict token-state machine
**Issue:** Using `for token in tokens` plus `next(tokens, "")` inside the loop risks misalignment and makes it hard to reason about edge cases (e.g., missing path after status, truncated rename).

**Better approach:** Replace the loop with an explicit state machine (EXPECT_STATUS → EXPECT_PATH/EXPECT_OLD → EXPECT_NEW). Maintain a `cursor_index` and always advance in one place. If a required token is missing, emit a `ValidationIssue` and resync at the next commit marker.

**Why better:** Prevents drift and makes invalid sequences recoverable without corrupting subsequent parsing.

**Expected gain:** Higher extraction accuracy on malformed or truncated logs; fewer false skips and fewer silent drops.

---

### 3) Validate path semantics using repo-aware rules
**Issue:** Current `_is_valid_path` rejects only obvious patterns. It still risks accepting garbage that happens to look like a path, and may reject valid unusual paths.

**Better approach:** Add repo-aware validation in extraction:
- Verify path exists in the file index (or in `git ls-tree` for HEAD) when available.
- Allow fallback for deleted paths (must appear in commit diff metadata).
- Store a soft-warning issue if the path does not exist in index but appears in diff.

**Why better:** The validator uses actual repo state rather than heuristics, reducing false positives/negatives.

**Expected gain:** More reliable file counts and fewer misclassified paths, especially in monorepos and unusual path conventions.

---

### 4) Make validation issues first-class in API responses
**Issue:** Validation results are stored but not clearly surfaced as part of analysis results or health status.

**Better approach:** Attach a `validation_summary` to analysis responses and repo status endpoints, including counts by issue type and a `quality_score` (e.g., 1 - invalid_tokens/total_tokens). Offer a `warning` when quality drops below a threshold.

**Why better:** Surfaces data quality to users proactively and allows tooling to block or warn on bad analyses.

**Expected gain:** Improved UX clarity and fewer downstream misinterpretations of corrupted datasets.

---

### 5) Provide a strict mode and a soft mode for extraction
**Issue:** The current behavior unconditionally skips invalid records. That is a hard-coded policy choice.

**Better approach:** Add `validation_mode` to `CouplingConfig`:
- `strict`: abort analysis on any invalid token sequence.
- `soft`: skip invalid tokens and log issues (current behavior).
- `permissive`: accept questionable paths but tag them for downstream filtering.

**Why better:** Different repos and use cases demand different data-quality tolerances.

**Expected gain:** Greater flexibility; enables CI pipelines to fail fast while allowing exploratory runs to proceed.

---

### 6) Include commit context in validation log
**Issue:** Validation log entries do not explicitly include commit metadata beyond `commit_oid`.

**Better approach:** Add `author`, `committed_at`, and `subject` in `ValidationIssue`. Persist into the validation log table for correlation with suspicious commits (bulk operations, vendor imports, etc.).

**Why better:** Enables identifying whether issues cluster around particular authors or automation, reducing debugging time.

**Expected gain:** Faster root cause analysis and better operational visibility.

---

### 7) Normalize rename handling and capture both paths for graph edges
**Issue:** The current change storage uses `status, new_path, old_path` but downstream might ignore `old_path`, causing historical continuity loss.

**Better approach:** Store rename events in a dedicated table or explicitly propagate edges for both `old_path → new_path` and `new_path → old_path` with a rename flag. Provide a canonical `file_id` mapping to keep identity stable across renames.

**Why better:** Prevents fragmentation of coupling history when files are renamed.

**Expected gain:** More accurate long-term coupling statistics and cluster stability.

---

### 8) Constrain `min_cooccurrence` defaults per repo scale
**Issue:** Fixed defaults in the API can be too conservative for small repos and too permissive for large ones.

**Better approach:** Compute recommended defaults based on repo size (e.g., median files per commit or total commits). Expose `min_cooccurrence_recommended` in the response and allow override.

**Why better:** Produces more meaningful edges without requiring users to know tuning heuristics.

**Expected gain:** Higher signal-to-noise in edge output and fewer "empty" results for small repos.

---

### 9) Add automated regression checks for parsing integrity
**Issue:** No explicit automated test ensures that parsing stays aligned under edge cases.

**Better approach:** Add test fixtures with malformed `git log -z --name-status` output and assert:
- Invalid tokens are logged and counted.
- Valid changes are still parsed after malformed sections.
- Status/path alignment never produces status tokens as paths.

**Why better:** Prevents regressions and gives confidence to future refactors.

**Expected gain:** Reduced production issues and higher confidence in releases.
