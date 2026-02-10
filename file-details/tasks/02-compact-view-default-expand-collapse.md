# Task 02: Default to Compact View with Expand All / Collapse All Buttons

## Issue
The file tree view does not default to a compact (collapsed) state. There is no UI control to expand all or collapse all folders at once.

## Expected Behavior
- The tree view should start **collapsed by default** (no folders expanded, or only top-level folders visible).
- An **icon button pair** (Expand All / Collapse All) should be available in the toolbar to toggle the entire tree open or closed in one click.

## Files to Modify
- `src/frontend/src/features/git/FilesPage.tsx` — Change the initial `expanded` state from `new Set(Object.keys(data).slice(0, 8))` to `new Set()` (collapsed by default). Add `handleExpandAll` and `handleCollapseAll` callbacks that set `expanded` to all folder paths or empty set.
- `src/frontend/src/features/git/files/FilesToolbar.tsx` — Add Expand All / Collapse All icon buttons to the toolbar UI. Accept new props `onExpandAll` and `onCollapseAll`.

## Suggested Fix
1. In `FilesPage.tsx`, change the initial expanded state:
   ```tsx
   setExpanded(new Set()); // collapsed by default
   ```
2. Add a helper to collect all folder paths from the tree for "expand all".
3. In `FilesToolbar.tsx`, add two icon buttons using `ChevronsDownUp` / `ChevronsUpDown` from lucide-react wired to the new callbacks.
