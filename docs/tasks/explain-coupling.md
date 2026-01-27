# Task: Explain Coupling

Status: Need Review

## Problem
Users see strong coupling but cannot understand why an edge is strong.

## Goal
Expose commit-level evidence and formula inputs for each edge.

## Scope
- Show top contributing commits with weights and timestamps.
- Provide time-window breakdown (30/90/365 days).
- Surface coupling formula inputs and intermediate values.

## Relevant files
- `lfca/edges.py`
- `lfca/changesets.py`
- `lfca/schema.py`
- `lfca/api.py`
- `frontend/src/components/ImpactGraph.tsx`
- `frontend/src/components/ClusteringView.tsx`

## Implementation Notes
- **Algorithm Transparency**: Implemented `AlgorithmInfoModal` which provides high-level conceptual explanations of Louvain, DBSCAN, and Hierarchical clustering. This bridges the gap between statistical output and architectural meaning.
- **Metric Context**: Extended the API and UI to display not just the raw weight, but also derived metrics like P(B|A) and Weighted Jaccard. This helps users understand "certainty" vs "volume" in coupling.

## Next Steps
- **Commit Drill-down**: Implement an "Evidence" panel that shows the specific commits (IDs, authors, messages) that contributed to a specific coupling edge. 
- **Time-Window Analysis**: Allow the user to toggle between "Lifetime" and "Recent" coupling to see if a relationship is improving or worsening.
