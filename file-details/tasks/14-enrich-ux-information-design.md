# Task 14: Design a Reliable UX to Enrich All Available Information

## Issue
The current file details UX presents data in isolated sections without a cohesive information architecture. Users cannot easily cross-reference data (e.g., see which authors contributed during a high-churn period, or which commits introduced coupling).

## Expected Behavior
- A unified, interconnected information design where:
  - **Tooltips** on hover provide contextual summary (e.g., hovering a chart bar shows commits + authors for that period).
  - **Cross-linking** between tabs: activity chart highlights correlate with commit list entries.
  - **Contextual actions**: every piece of data has a clear next action (view, filter, navigate).
  - **Information hierarchy**: most important metrics (risk, churn, coupling) are visually prominent; secondary data is progressive disclosure (expand/drill-down).
  - **Consistent patterns**: all lists use the same row pattern, all charts support the same interactions (hover tooltip, click to drill, brush to zoom).

## Scope
This is a UX design task — define the interaction patterns before implementing:
1. **Hover**: What shows on hover for each data type (file, author, commit, chart point)?
2. **Click**: What happens on single click vs double click?
3. **Context menu**: What actions are available per element type?
4. **Navigation**: How do users move between file details, commit details, author views?
5. **Progressive disclosure**: What is shown by default vs on expand?

## Files to Modify
This is cross-cutting across all file-details components:
- `src/frontend/src/features/git/file-details/FileActivityTab.tsx`
- `src/frontend/src/features/git/file-details/FileAuthorsTab.tsx`
- `src/frontend/src/features/git/file-details/FileCommitsTab.tsx`
- `src/frontend/src/features/git/file-details/FileCouplingTab.tsx`
- `src/frontend/src/features/git/file-details/FileInsightsTab.tsx`
- `src/frontend/src/shared/charts/TimelineChart.tsx`
- `src/frontend/src/shared/charts/HeatmapCalendar.tsx`
- `src/frontend/src/shared/charts/DayHourMatrix.tsx`
- `src/frontend/src/features/git/files/FileRow.tsx`

## Suggested Approach
1. Define a `DataAction` type: `{ type: 'navigate' | 'filter' | 'open-external' | 'show-tooltip'; target: string; payload: any }`.
2. Create a shared `useDataNavigation()` hook that handles all navigation/action patterns consistently.
3. All interactive elements emit actions through this hook rather than having ad-hoc click handlers.
4. Add rich tooltips using a shared `<DataTooltip>` component that can render structured info (mini file card, commit card, author card).
5. Ensure every data point answers: "What can the user do next with this information?"
