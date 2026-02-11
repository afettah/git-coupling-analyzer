# Task 06: Add Sort Feature (Sort by Name, Commits, Risk, etc.)

## Issue
There is no UI control to sort files in the file list/table. The `FilterEngine.ts` already supports `sortItems()` and the `FilterState` has `sortBy` and `sortOrder` fields, but there is no sort selector in the toolbar.

## Expected Behavior
- A sort dropdown/selector in the toolbar allowing users to sort files by: **name** (path), **commits**, **churn**, **risk**, **coupling**, **last changed**.
- A toggle for ascending/descending order.
- Sorting should apply to both table view and the flat file list. Tree view sorts folders-first alphabetically by default but could show a visual indicator.

## Files to Modify
- `src/frontend/src/features/git/files/FilesToolbar.tsx` — Add a sort dropdown (select or popover) with sort field options and an asc/desc toggle button. Wire to `updateFilter('sortBy', ...)` and `updateFilter('sortOrder', ...)`.
- `src/frontend/src/shared/filters/types.ts` — Already has `sortBy` and `sortOrder` in `FilterState`, no changes needed.
- `src/frontend/src/shared/filters/FilterEngine.ts` — Already has `sortItems()`, no changes needed.

## Suggested Fix
1. Add a `<select>` or custom dropdown in `FilesToolbar.tsx` with options: `path`, `commits`, `churn`, `risk`, `coupling`, `lastChanged`.
2. Add an `ArrowUpDown` toggle button for sort direction.
3. The `useFilesFilters().filterAndSortFiles()` already applies sorting, so only the UI selector is needed.

## Progress Update (2026-02-11)
- Status: ✅ Completed
- Implemented:
  - `FilesToolbar.tsx`: Added sort field selector with options for name/commits/churn/risk/coupling/last changed.
  - `FilesToolbar.tsx`: Added asc/desc toggle button wired to `sortOrder`.
  - Test IDs added for sort controls to support QA and E2E coverage.
- Notes:
  - Sorting is applied through existing `useFilesFilters().filterAndSortFiles()` without backend changes.
