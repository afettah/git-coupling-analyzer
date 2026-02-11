# Task 05: Restore Lost Feature Icons (Hot, Risky, Coupled, etc.)

## Issue
The old `FolderTree.tsx` displayed inline icons/badges on file rows indicating status (hot 🔥, stable, risky ⚠️, coupled 🔗, etc.). These visual indicators were removed in the refactoring to the new `FileRow.tsx` component.

## Expected Behavior
- File rows should display small inline icon badges based on the file's metrics:
  - **Hot** (🔥 Flame icon): High churn or recent activity
  - **Risky** (⚠️ AlertTriangle icon): Risk score ≥ 7
  - **Coupled** (🔗 Link2 icon): Coupling score > 0.6
  - **Stable** (⚓ Anchor icon): Low churn, no recent changes
- These icons should appear in the file row next to the metrics, using the same criteria as the quick filters in `FilterEngine.ts`.

## Reference
See `LOST_FEATURES_ANALYSIS.md` §4.2 — Quick Filters section listing the old FolderTree's icon badges: hot, stable, recent, coupled, risky.

Also from `FilterEngine.ts`, `matchesQuickFilter()` defines the exact thresholds for each category.

## Files to Modify
- `src/frontend/src/features/git/files/FileRow.tsx` — Add icon badges computed from the file's metrics. Import `Flame`, `Anchor`, `Link2`, `AlertTriangle` from lucide-react. Accept `churn` and `coupling` as additional props. Use `matchesQuickFilter` logic to determine which badges to show.
- `src/frontend/src/features/git/files/FilesTree.tsx` — Pass `churn` and `coupling` to `FileRow`.
- `src/frontend/src/features/git/files/FilesTable.tsx` — Same as above.

## Suggested Fix
1. Import the `matchesQuickFilter` function from `FilterEngine.ts`.
2. In `FileRow`, compute which badges apply to the file and render small colored icons inline.
3. Keep the badges subtle (small, muted colors) to avoid visual clutter.

## Progress Update (2026-02-11)
- Status: ✅ Completed
- Implemented:
  - `FileRow.tsx`: Added inline badges using `matchesQuickFilter` (`Flame`, `AlertTriangle`, `Link2`, `Anchor`).
  - `FilesTree.tsx`: Passes `churn` and `coupling` to `FileRow`.
  - `FilesTable.tsx`: Passes `churn` and `coupling` to `FileRow`.
- Notes:
  - Badge logic is now consistent with quick filter thresholds from `FilterEngine.ts`.
