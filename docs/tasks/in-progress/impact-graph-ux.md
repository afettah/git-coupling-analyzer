# Task: Impact Graph UX

**Status:** Need Review

## Problem
Impact Graph is unclear and often empty, creating user confusion.

## Goal
Define behavior, add defaults, and guide users with validation.

## Scope
- Document "impacted files" definition.
- Provide default inputs and example presets.
- Add validation hints and "no data" suggestions.

## Relevant files
- `frontend/src/components/ImpactGraph.tsx`
- `frontend/src/api.ts`
- `lfca/api.py`
- `docs/SPEC.md`

## Implementation Notes
- **Empty State UX**: Optimized the graph views to provide clear "No Data Found" feedback when filtering criteria are too strict (e.g., high min-weight on small repos).
- **Consistency**: Standardized the use of `jaccard` as the default metric across both the Impact Graph and Clustering views to provide a unified mental model for the user.
- **Performance**: Restricted graph visualization to `top-k` neighbors to ensure fast rendering even for highly connected files.

## Next Steps
- **Validation Hints**: Surface "Potential matches found if you lower weight" hints when a search returns zero results.
- **Preset Buttons**: Add "Low Churn/High Weight" and "Recent Active" presets to help users find common patterns without manually adjusting sliders.
