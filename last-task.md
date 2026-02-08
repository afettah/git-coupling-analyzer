# File-Details Implementation Review — Findings

Full front-to-back review of the `v2/file-details` feature, following the natural data flow:  
**Frontend UI → API client → Router → Interface → Implementation → Metrics helpers**

---

## 🔴 Critical Issues (Severity: HIGH)

### 1. Risk Score Scale Mismatch (Backend ↔ Frontend)

**Where:** `api.py:get_file_details_enhanced` → `FileDetailsPanel.tsx` / `FileInsightsTab.tsx`

The base `get_file_details()` computes `risk_score` on a **0–100 scale** (api.py L268-275).  
The enhanced `get_file_details_enhanced()` overwrites it with `compute_risk_factors()` result which uses a **0–10 scale** (file_metrics.py L325).  
The frontend displays it as `risk_score/100` (FileDetailsPanel.tsx L335) and uses thresholds of 70/40 (L228-230).

**Impact:** Risk score will always appear extremely low in the UI (e.g. 7.2/100 instead of 72/100). Risk color coding will always show green.

**Fix:** Either:
- Scale up in `compute_risk_factors`: `risk_score = float(round(min(risk_score * 10, 100), 1))` to return 0-100, OR
- Scale down the frontend thresholds to match 0-10 and display as `/10`

---

### 2. Missing Fields: Backend Does Not Return Several Fields the Frontend Expects

**Where:** `api.py:get_file_details()` → `FileDetailsResponse` interface in `git.ts`

The frontend `FileDetailsResponse` interface expects these fields, but the backend `get_file_details()` (base method) never returns them:

| Field | Frontend expects | Backend returns |
|---|---|---|
| `first_commit_date` | `string \| null` | ❌ Not returned (only `first_commit_ts` as epoch) |
| `last_commit_date` | `string \| null` | ❌ Not returned (only `last_commit_ts` as epoch) |
| `top_author` | `string \| null` | ❌ Not returned |
| `commits_last_30_days` | `number` | ❌ Not returned |
| `strong_coupling_count` | `number` | ❌ Not returned |

**Impact:** The UI header stats for "Age" (uses `first_commit_date`), "Authors → Top" (uses `top_author`), recent commits indicator (`commits_last_30_days`), and the Insights tab risk calculations (`commits_last_30_days`, `strong_coupling_count`) all receive `undefined`/`null`.

**Fix:** Add these fields in `get_file_details()` or `get_file_details_enhanced()`:
```python
# Convert timestamps to ISO dates
from datetime import datetime, timezone
first_ts = result.get("first_commit_ts")
last_ts = result.get("last_commit_ts")
result["first_commit_date"] = datetime.fromtimestamp(first_ts, tz=timezone.utc).isoformat() if first_ts else None
result["last_commit_date"] = datetime.fromtimestamp(last_ts, tz=timezone.utc).isoformat() if last_ts else None

# Add top_author from metadata or computed from changes
result["top_author"] = metadata.get("top_author")  # or compute

# Add commits_last_30_days and strong_coupling_count
# (need to query changes parquet for recent commits, and git_edges for strong coupling)
```

---

### 3. Commits Date Always `null`

**Where:** `routers/git.py` L462-471 (get_file_commits endpoint)

The commit response hardcodes `"date": None` for every commit. The `authored_ts` or `committer_ts` from the commits parquet is available in `ci` but is never used.

**Impact:** All commit dates show "Unknown" in the UI. The commit density timeline (FileCommitsTab.tsx L287-299) will always be empty because `c.date` is always null.

**Fix:**
```python
ts = ci.get("authored_ts") or ci.get("committer_ts")
date_str = None
if ts:
    from datetime import datetime, timezone
    date_str = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()

results.append({
    "oid": ch.get("commit_oid", ""),
    "message": msg,
    "author": ci.get("author_name", "Unknown"),
    "date": date_str,
    ...
})
```

---

### 4. Authors Response Missing `first_commit` / `last_commit` Per Author

**Where:** `api.py:get_file_authors_enhanced()` L891-901 → `FileAuthor` interface in `git.ts`

The frontend `FileAuthor` type expects `first_commit: string | null` and `last_commit: string | null`.  
The backend authors list omits these fields entirely.

**Impact:** The "Last Edit" column in the authors table always shows "Unknown". Author sorting by `last_commit` doesn't work.

**Fix:** Track first/last commit timestamps per author during the iteration in `get_file_authors_enhanced()` and include them in the response.

---

## 🟠 Medium Issues (Severity: MEDIUM)

### 5. `quarterly` Granularity Rejected by Backend

**Where:** `FileActivityTab.tsx` L20/L129 → `routers/git.py` L374

The frontend offers a "quarterly" granularity option in the Activity tab, but the backend validates granularity against `("daily", "weekly", "monthly")` and returns **HTTP 400** for "quarterly".

Note: `file_metrics.py:bucketize_ts()` does support `"quarterly"` in its freq_map (L103), so the limitation is only in the router validation.

**Fix:** Add `"quarterly"` to the allowed granularity set in the 3 router endpoints that validate it:
```python
if granularity not in ("daily", "weekly", "monthly", "quarterly"):
```

---

### 6. `exclude_merges` Parameter Ignored in Commits Endpoint

**Where:** `routers/git.py` L421-477

The `exclude_merges` query parameter is declared but never used in the commit filtering logic. Merge commits are always included.

**Impact:** The "Exclude merges" checkbox in FileCommitsTab has no effect.

**Fix:** Filter using the `is_merge` or `parent_count` field from the commits parquet:
```python
if exclude_merges and ci.get("parent_count", 1) > 1:
    continue
```

---

### 7. `linesDeletedData` Computed but Never Rendered

**Where:** `FileActivityTab.tsx` L79-82, L183-205

`linesDeletedData` is computed (L79-82) but the "Lines Changed Over Time" chart only renders `linesAddedData` (L187). The legend (L196-204) shows both "Additions" and "Deletions" colors, but only the green additions line is visible.

**Impact:** Misleading UI — legend promises two series but only one is shown.

**Fix:** Either render both series in the chart (using a dual-series TimelineChart or stacked area), or remove the deletions legend entry.

---

### 8. FileAuthorsTab Computes Bus Factor Client-Side While Backend Already Returns It

**Where:** `FileAuthorsTab.tsx` L215-247

The component manually computes bus factor from author commit counts (L216-224), completely ignoring the `data.bus_factor` field returned by the backend.

**Impact:** Potential inconsistency — the frontend-computed bus factor may differ from the backend's `compute_bus_factor()` which uses a configurable threshold. Not a bug per se, but wasteful duplication that could diverge.

**Fix:** Use `data.bus_factor` from the API response instead of recomputing.

---

### 9. `loadCommits` useCallback Has Stale `offset` in Dependency Array

**Where:** `FileCommitsTab.tsx` L235-266

The `loadCommits` callback includes `offset` in its dependency array (L266). When the effect at L269-271 calls `loadCommits(true)` on filter change, it recreates the callback on every offset change, causing potential unnecessary re-renders. More importantly, the "load more" path uses the `offset` from closure, but `setOffset` is called with a functional update that references `prev`, which is correct for the reset case but could lead to stale reads in the non-reset path.

**Fix:** Remove `offset` from the dependency array and always use functional `setOffset` updates with a ref for the current offset:
```ts
const offsetRef = useRef(0);
```

---

### 10. FileInsightsTab Uses Different Risk Calculation Than Backend

**Where:** `FileInsightsTab.tsx` L143-153

The component computes its own `stabilityScore`, `ownershipScore`, `couplingScore`, `sizeScore` and `overallScore` locally (L143-153), which is completely independent from the backend's `compute_risk_factors()` logic and the `risk_score` field in the response.

The backend risk uses weighted factors (churn 30%, coupling 25%, bus_factor 25%, age 10%, trend 10%) while the frontend uses equal-weighted 4-factor average. The backend also returns `risk_factors` array that is never used by the frontend.

**Impact:** The "Health Score" displayed in the Insights tab will differ from the risk_score shown in the header stats card, confusing users.

**Fix:** Use `details.risk_factors` from the API response to display the breakdown instead of recomputing locally.

---

## 🟡 Low Issues (Severity: LOW)

### 11. `subject` vs `message` Field Naming Inconsistency

**Where:** `routers/git.py` L459

The commits parquet uses `subject` for the commit message field (L459: `ci.get("subject", "")`), while the API response uses `message` and the frontend `FileCommit` type uses `message`. This works but is confusing for maintainability. Document that `subject` in parquet maps to `message` in the API.

---

### 12. No Error Boundary / Error State in Tab Components

**Where:** All tab components (`FileActivityTab`, `FileAuthorsTab`, `FileCommitsTab`)

Failed API calls are caught and logged to console, but no error state is shown to the user — the tab simply shows a spinner forever or the "No data" state, which is indistinguishable from genuinely empty data.

**Fix:** Add error state handling:
```tsx
const [error, setError] = useState<string | null>(null);
// In catch: setError('Failed to load data');
// In render: if (error) return <ErrorMessage message={error} />;
```

---

### 13. `get_repo_averages` Operator Precedence Bug

**Where:** `file_metrics.py` L613-614

```python
avg_commits = row[0] or 50 if row else 50
avg_churn = row[1] or 20 if row else 20
```

Due to Python operator precedence, this evaluates as:
```python
avg_commits = row[0] or (50 if row else 50)  # Always 50 when row[0] is falsy
```

When `row` exists but `row[0]` is `None`, the ternary is evaluated but `50 if row else 50` returns 50 either way — so it works by accident. However, if `row[0]` is `0` (legitimate value), it would be replaced with `50`.

**Fix:** Use explicit None check:
```python
avg_commits = row[0] if (row and row[0] is not None) else 50
avg_churn = row[1] if (row and row[1] is not None) else 20
```

---

### 14. `formatRelativeTime` Duplicated Across Components

**Where:** `FileAuthorsTab.tsx` L110-123, `FileCommitsTab.tsx` L37-50

The identical `formatRelativeTime` helper function is copy-pasted in two components.

**Fix:** Extract to a shared utility, e.g. `src/frontend/src/lib/date-utils.ts`.

---

### 15. Tab Keyboard Shortcut Captures Browser Tab Key

**Where:** `FileDetailsPanel.tsx` L193-200

The `Tab` key is intercepted to cycle through panel tabs, which breaks the standard browser Tab navigation for accessibility (keyboard users can't tab through interactive elements).

**Fix:** Use a different shortcut (e.g., `Ctrl+]` / `Ctrl+[`) or only intercept when the panel itself is focused.

---

### 16. Coupling Timeline and Risk Timeline Not Consumed by Any Frontend Component

**Where:** `git.ts` L327-357 (`getFileCouplingTimeline`, `getFileRiskTimeline`)

These two API functions are defined in the frontend API client but are never called from any component. The `FileCouplingTab` uses static coupling data passed as props, and `FileInsightsTab` computes everything locally.

**Impact:** Backend endpoints exist and work, frontend API functions exist, but no component actually calls them — dead code on both sides.

**Fix:** Integrate into `FileCouplingTab` (for coupling evolution chart) and `FileInsightsTab` (for risk trend chart), or remove if not needed.

---

## Summary

| Severity | Count | Key Theme |
|----------|-------|-----------|
| 🔴 HIGH | 4 | Data contract mismatches between frontend and backend |
| 🟠 MEDIUM | 6 | Missing functionality, duplicated logic, stale closures |
| 🟡 LOW | 6 | Code quality, accessibility, dead code |

**Most impactful to fix first:** Issues #1 (risk scale), #2 (missing fields), #3 (null dates), #4 (author dates) — these cause visible data to be wrong or missing in the UI.
