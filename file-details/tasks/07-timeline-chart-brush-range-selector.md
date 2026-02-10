# Task 07: Add Mouse Brush Range Selector to Timeline Chart

## Issue
The `TimelineChart` component supports zoom via scroll but there is no mouse drag range selector (brush) to select a specific date range to zoom into. The `brushEnabled` prop exists but is not exposed in any consumer.

## Expected Behavior
- Users should be able to click-and-drag on the timeline chart to select a date range.
- The selected range should zoom the chart into that period.
- Optionally, the brush selection could also drive global date filters via `onRangeChange`.
- A "reset zoom" button should allow returning to the full view.

## Files to Modify
- `src/frontend/src/shared/charts/TimelineChart.tsx` — The brush implementation exists (lines ~235-248) but needs refinement: the brush should update the chart's x-domain to zoom into the selected range, not just emit the range. Add a reset button overlay.
- `src/frontend/src/features/git/file-details/FileActivityTab.tsx` — Pass `brushEnabled={true}` to `TimelineChart` instances. Handle `onRangeChange` to update a local date range state that feeds back as `xDomain`.

## Suggested Fix
1. In `TimelineChart.tsx`, when brush ends, update `xDomain` internally (use local state) to zoom into the brushed range.
2. Add a small "Reset Zoom" button that appears when zoomed in.
3. In `FileActivityTab.tsx`, enable brush on the main timeline: `<TimelineChart brushEnabled onRangeChange={...} />`.
