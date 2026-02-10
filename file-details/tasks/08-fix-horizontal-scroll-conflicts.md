# Task 08: Fix Horizontal Scroll and Scroll Conflicts

## Issue
There is unexpected horizontal scrolling on the page. Scroll behavior sometimes gets "stuck" — conflict between the main page scroll and inner section scrollbars (e.g., the file tree panel vs. the page body).

## Expected Behavior
- No horizontal scrollbar should appear on the page.
- Vertical scroll should work smoothly without conflict between nested scroll containers.
- The file tree/table section should scroll within its own container without affecting the main page scroll.

## Root Cause Analysis
In `FilesPage.tsx`, the root div uses `overflow-hidden` but the inner content div uses `overflow-auto`. In `AnalysisDashboard.tsx`, the main content area uses `h-[calc(100vh-60px)] overflow-hidden flex flex-col`, and the sidebar is `fixed` with its own scroll. Charts (especially D3 SVGs in `TimelineChart.tsx`) may render wider than their container, causing horizontal overflow.

The conflict arises when nested `overflow-auto` containers compete for scroll events — particularly when the mouse is over a chart or inner scroll area.

## Files to Modify
- `src/frontend/src/features/git/FilesPage.tsx` — Ensure root container has `overflow-x-hidden` to prevent horizontal scroll. Use `overflow-y-auto` only where needed.
- `src/frontend/src/features/git/file-details/FileActivityTab.tsx` — Already has `overflow-x-hidden` on the root div, verify D3 charts respect container width.
- `src/frontend/src/shared/charts/TimelineChart.tsx` — Ensure SVG width is bounded by parent container width (`width: 100%; max-width: 100%`). Add `overflow: hidden` on the chart wrapper div.
- `src/frontend/src/features/dashboard/AnalysisDashboard.tsx` — Review the main content area scroll setup to avoid nested scroll traps.

## Suggested Fix
1. Add `overflow-x-hidden` to the main content wrapper in the dashboard.
2. In `TimelineChart.tsx`, set explicit `max-width: 100%` and `overflow: hidden` on the chart container div.
3. Use `overscroll-behavior: contain` CSS on inner scroll containers to prevent scroll chaining to the parent.
