# Task 12: Fix "Lines Changed" Chart Not Displaying Data

## Issue
The "Lines Changed" section in the Activity tab appears to display nothing — the chart is empty even when the file has line change data.

## Expected Behavior
- The Lines Changed chart should show additions (green) and deletions (red) over time.
- If data exists in `lines_by_period`, the chart should render bars or area plots.

## Root Cause Analysis
In `FileActivityTab.tsx`, the lines changed data is split into two separate `TimeSeriesPoint[]` arrays (`linesAddedData` and `linesDeletedData`). These are passed to `TimelineChart` components. However, the `period` field from the API response is used as the `date` field: `{ date: d.period, value: d.added }`.

The `TimelineChart` component parses `d.date` with `new Date(d.date)`. If `d.period` is a format like `"2024-03"` (year-month only), `new Date("2024-03")` may parse inconsistently across browsers, or the backend may return empty `lines_by_period` if the granularity-based aggregation doesn't compute line stats.

Additionally, the backend endpoint in `git.py` now delegates to `api.get_file_activity_enhanced()` — need to verify this function correctly returns `lines_by_period` with `added` and `deleted` fields.

## Files to Modify
- `src/frontend/src/features/git/file-details/FileActivityTab.tsx` — Verify the data transformation. Ensure `d.period` is converted to a valid ISO date string (e.g., append `-01` for monthly: `"2024-03-01"`).
- `src/git-analyzer/git_analyzer/file_metrics.py` — Verify the activity endpoint returns non-empty `lines_by_period` with `added` and `deleted` per bucket.
- `src/platform/code_intel/routers/git.py` — Verify the `/files/{path}/activity` endpoint passes line stats through.

## Suggested Fix
1. In `FileActivityTab.tsx`, when transforming `lines_by_period`:
   ```tsx
   return data.lines_by_period.map(d => ({
     date: d.period.length === 7 ? `${d.period}-01` : d.period,
     value: d.added
   }));
   ```
2. In the backend, ensure the activity function computes and returns `lines_added` / `lines_deleted` aggregated per period bucket.
3. Check if the `changes.parquet` data includes `lines_added` and `lines_deleted` columns and that they are non-null.
