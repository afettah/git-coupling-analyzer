# Task: Save & Reopen Clustering Results

**Status:** Need Review

## Problem
Clustering results are not persisted, forcing re-computation and limiting sharing or comparison.

## Goal
Persist clustering snapshots to disk and allow reopening/exporting without recompute.

## Scope
- Save snapshots with metadata (repo SHA, LFCA version, parameters).
- Reopen snapshots in UI/API/CLI.
- Export single cluster or all clusters to CSV/JSON/GraphML.

## Relevant files
- `lfca/storage.py`
- `lfca/schema.py`
- `lfca/api.py`
- `lfca/cli.py`
- `frontend/src/api.ts`
- `frontend/src/components/ClusteringView.tsx`
- `frontend/src/components/AnalysisDashboard.tsx`

## Implementation Notes
- **Persistence Strategy**: Implemented a JSON file-based snapshot system. Snapshots are stored under the repository's data directory in a `snapshots/` folder, ensuring they are portable and easy to back up without requiring complex database migrations for experimental data.
- **Export Formats**: Added client-side CSV generation for clusters. This offloads the formatting work from the server and provides an instant download experience for the user.
- **API Integration**: Developed standard CRUD-like endpoints for snapshots (`GET /list`, `POST /save`, `GET /{id}`), enabling both the frontend and potential future CLI tools to interact with saved states.

## Next Steps
- **Cloud/Remote Sync**: Allow snapshots to be uploaded to a central storage if configured, for team-wide architectural reviews.
- **Metadata Versioning**: Add more detailed environment metadata to snapshots (e.g., installed dependencies versions) to guarantee reproducibility during long-term maintenance.
- **Custom Export Templates**: Support exporting to more advanced formats like GraphML or Gephi-compatible CSVs for deeper network analysis.
