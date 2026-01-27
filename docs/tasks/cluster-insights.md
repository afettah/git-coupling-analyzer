# Task: Cluster Insights

Status: Need Review

## Problem
Clusters lack actionable summaries, making it hard to prioritize refactors.

## Goal
Provide summaries, hotspots, and refactor hints per cluster.

## Scope
- Cluster summary: size, churn, average coupling.
- Hot files, top commits, common authors.
- Compare clusters across snapshots (growth/shrink/drift).

## Relevant files
- `lfca/clustering/*`
- `lfca/schema.py`
- `lfca/api.py`
- `frontend/src/components/ClusteringView.tsx`
- `frontend/src/components/AnalysisDashboard.tsx`

## Implementation Notes
- **Data Pipeline**: Leveraged `pandas` to perform high-performance grouping and aggregation on the `changes.parquet` and `commits.parquet` datasets. This allows for fast computation of "hot files" and "top authors" without loading the entire history into the API's memory.
- **Drift Detection**: Implemented a Jaccard-based overlap algorithm to track cluster identity across snapshots. A threshold of 80% is used to define "stability," while lower overlaps trigger "drift" alerts.
- **UI Architecture**: Enhanced `ClusteringView` with an expandable card layout. Insights are only displayed upon expansion to keep the overview clean. Added a dedicated Compare mode to visualize architectural shifts.

## Next Steps
- **Visualization**: Implemented a SVG-based flow visualization (simplified Sankey) to represent cluster drift and merging/dissolving intuitively.
- **Report Export**: Add specialized PDF or Markdown report generation that includes these insights for offline distribution.
- **Persistence**: Store the computed insights directly in the snapshot JSON to avoid re-calculating them every time a snapshot is reopened.

## Status: Done
