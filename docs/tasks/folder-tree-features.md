# Task: Folder Tree Enhancements

Status: Proposed

## Problem
Folder tree is limited to structure; it lacks history and coupling context.

## Goal
Surface history, coupling aggregates, and useful filters.

## Scope
- File/folder history view and last-change info.
- Coupled files for a folder (aggregate coupling).
- Filters: stable files, high churn, recently changed.
- Advanced filters: author, file type, time window.

## Design Step
### Tech Stack
- Frontend: React + TypeScript + Vite UI, existing `FolderTree` component.
- Backend: FastAPI endpoints in `lfca/api.py` with Pydantic schemas in `lfca/schema.py`.
- Data: Git history data already extracted in parquet/logs; aggregate in API layer.

### Architecture
- UI adds a “Folder Insights” panel attached to the tree selection.
- API exposes aggregated folder stats (churn, last change, top coupled files).
- Filters are applied server-side for large repos; client keeps current filter state.

### Data Contract (Sketch)
```ts
type FolderInsightsRequest = {
	repo_id: string;
	path: string;
	time_window?: { from: string; to: string };
	author?: string;
	file_types?: string[];
	filters?: { stable?: boolean; high_churn?: boolean; recently_changed?: boolean };
};

type FolderInsightsResponse = {
	path: string;
	last_change_at?: string;
	churn: { commits: number; files_touched: number };
	top_coupled: Array<{ path: string; weight: number }>;
};
```

### Pseudocode
```
UI.onFolderSelect(path):
	state.selectedPath = path
	fetchInsights(path, state.filters)

API.get_folder_insights(repo_id, path, filters):
	changes = load_changesets(repo_id, time_window, author)
	folder_files = list_files_under(path)
	churn = aggregate_commits(changes, folder_files)
	coupling = aggregate_coupling(changes, folder_files)
	return { path, last_change_at, churn, top_coupled }
```

### UX Notes
- Show last change (date + author) and a small churn badge.
- “Top Coupled Files” list is sorted by coupling weight.
- Filters appear as chips; changing a filter re-queries the API.

## Relevant files
- `frontend/src/components/FolderTree.tsx`
- `frontend/src/api.ts`
- `lfca/api.py`
- `lfca/schema.py`
