# Task 13: Provide Details on Click / Navigate to Source and Commits

## Issue
Clicking on data points, chart elements, author names, commit entries, and other interactive information does not navigate to detailed views or external URLs. The data is presented as read-only with no actionable links.

## Expected Behavior
- **File paths**: Clicking a coupled file path should navigate to that file's details page.
- **Author names**: Clicking should navigate to author-specific view or filter by that author.
- **Commit entries**: Clicking a commit should open it in the git web interface (GitHub/Azure DevOps) or show commit details inline.
- **Chart data points**: Clicking a bar/point on a timeline should show the commits for that period.
- **Coupling entries**: Clicking a coupled file should navigate to its file details.
- All linkable information should have visual affordance (underline, pointer cursor, color hint).

## Files to Modify
- `src/frontend/src/features/git/file-details/FileCommitsTab.tsx` — Make commit hashes/subjects clickable to open in git web.
- `src/frontend/src/features/git/file-details/FileAuthorsTab.tsx` — Make author names clickable to filter by author.
- `src/frontend/src/features/git/file-details/FileCouplingTab.tsx` — Make coupled file paths clickable to navigate to their file details.
- `src/frontend/src/features/git/file-details/FileActivityTab.tsx` — Add click handlers on chart data points to drill down.
- `src/frontend/src/shared/charts/TimelineChart.tsx` — Add `onClick` callback prop for bar/point clicks, emitting the data point's date and value.

## Suggested Fix
1. Add an `onPointClick?: (point: TimeSeriesPoint) => void` prop to `TimelineChart`.
2. In each tab, wire click handlers that either navigate (via react-router) or open external URLs.
3. Use `cursor-pointer`, `hover:underline`, and `text-sky-400` classes for visual affordance on all clickable elements.
4. For external links (commits, git source), use `window.open(url, '_blank')` with proper URL construction per git provider.
