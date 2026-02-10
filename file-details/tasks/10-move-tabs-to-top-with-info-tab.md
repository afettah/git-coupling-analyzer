# Task 10: Move Tabs to Top of Page with "Information" as a Tab

## Issue
The current tab navigation for file details (Activity, Authors, Commits, Coupling, Insights) is placed within the file details panel. The "Information" / summary section should also be a tab rather than a separate fixed section.

## Expected Behavior
- Tabs should be at the top of the content area (below the page header).
- The first tab should be **Information** (file summary, basic stats, metadata).
- Other tabs: Activity, Authors, Commits, Coupling, Insights — remain as they are.
- The information that was previously in a pinned header (file path, basic stats) becomes the "Information" tab content.

## Files to Modify
- `src/frontend/src/features/git/FileDetailsPanel.tsx` — Restructure so that the file summary/header info becomes a tab ("Information") instead of a fixed header. Move the tab bar to the top of the panel.
- Potentially create a new `FileInfoTab.tsx` component in `src/frontend/src/features/git/file-details/` to hold the summary content.

## Suggested Fix
1. Extract the current header info section from `FileDetailsPanel.tsx` into a new `FileInfoTab.tsx`.
2. Add "Information" as the first tab in the tab list.
3. Move the tab bar to the very top of the panel layout.
4. Remove the pinned header section that duplicated the info.
