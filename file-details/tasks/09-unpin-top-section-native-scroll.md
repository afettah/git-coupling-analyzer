# Task 09: Unpin Top Section — Use Native Page Scroll

## Issue
The top section (header/toolbar) appears to be pinned/sticky, creating a multi-panel layout with separate scroll regions. This causes the scroll conflicts described in issue #10.

## Expected Behavior
- The page should be a single, natively scrollable document — no sticky/pinned top section within the content area.
- The top header with tabs, toolbar, and file info should scroll naturally with the page content.
- Only the global sidebar (left navigation) should remain fixed.

## Root Cause Analysis
In `AnalysisDashboard.tsx` line ~422: `<div className="sticky top-0 z-10 ...">` makes the top bar sticky. Combined with `h-[calc(100vh-60px)] overflow-hidden` on the main content, this creates a constrained viewport with inner scroll.

## Files to Modify
- `src/frontend/src/features/dashboard/AnalysisDashboard.tsx` — Remove `sticky top-0` from the top section header. Change the main content container from `h-[calc(100vh-60px)] overflow-hidden` to allow natural document flow (`min-h-screen` with no fixed height constraint).
- `src/frontend/src/features/git/FileDetailsPanel.tsx` — If the file details panel has its own sticky header or fixed height, convert to natural flow.

## Suggested Fix
1. In `AnalysisDashboard.tsx`:
   - Remove `sticky top-0 z-10` from the tab header div.
   - Change main content from `h-[calc(100vh-60px)] overflow-hidden flex flex-col` to `min-h-[calc(100vh-60px)]` with `overflow-y-auto` on the body or no overflow constraint.
2. Let the browser handle scrolling natively instead of creating scroll containers.
