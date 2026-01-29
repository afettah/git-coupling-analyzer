# Clustering Module Refactoring

## Issue

The `/frontend/src/components/clustering` folder contained several large monolithic files with mixed responsibilities:

- `utils.ts` (314 lines) - Mixed formatting, naming, tree building, URL building
- `ProjectCity.tsx` (1096 lines) - Entire 3D visualization in one file
- `ExcalidrawView.tsx` (481 lines) - Diagram view with embedded element generation
- `FilterBar.tsx` (224 lines) - Large filter component
- `ClusterModal.tsx` - Modal with embedded tree view logic
- `types.ts` - Types mixed with URL builder functions

This made the codebase difficult to maintain, test, and extend.

## Objective

Refactor the clustering module to achieve:

- **Single Responsibility**: Each file has one clear purpose
- **Clean Design**: Consistent patterns and styling
- **Maintainability**: Easy to navigate and modify
- **Performance**: Proper memoization and optimization
- **Advanced Features**: Reusable hooks and composable UI primitives

No backward compatibility required - complete restructure allowed.

## What Has Been Done

### New Directory Structure

```
clustering/
├── index.ts
├── types/
├── constants/
├── utils/
├── hooks/
├── ui/
├── components/
└── views/
```

### Types Module
- `types/index.ts` - Centralized type definitions (SnapshotSummary, ClusterData, ClusterEdge, FilterState, TreeNode, BuildingData, DistrictData, component props)

### Constants Module
- `constants/index.ts` - Cluster palette, coupling colors, district colors, default filter state, excluded tokens, Excalidraw config, city config

### Utilities (split from utils.ts)
- `utils/index.ts` - Re-exports all utilities
- `utils/formatting.ts` - formatPercent, formatNumber, formatDateShort, relativeTime, getFileName, getFolderPath, truncate
- `utils/naming.ts` - generateClusterName, calculateClusterRank, sortClustersByRank, enrichClustersWithNames
- `utils/tree.ts` - buildFileTree, aggregateFolders, getUniqueFolders, getAllFilesFromTree
- `utils/urls.ts` - buildFileUrl, buildCommitUrl, buildFolderUrl, parseRepoUrl
- `utils/filtering.ts` - filterClusters, sortClusters, filterAndSortClusters, calculateClusterStats
- `utils/export.ts` - exportClusterToCsv, exportAllClustersToCsv, downloadBlob, copyToClipboard

### Hooks
- `hooks/index.ts` - Re-exports
- `hooks/useSnapshots.ts` - Refactored with optimistic updates, error handling
- `hooks/useClusterFilters.ts` - New hook for filter state management
- `hooks/useSelection.ts` - New hook for multi-selection with maxSelections

### UI Primitives (new)
- `ui/index.ts` - Re-exports
- `ui/Button.tsx` - Variants (primary, secondary, ghost, danger), sizes, loading state
- `ui/Select.tsx` - Styled dropdown with label
- `ui/SearchInput.tsx` - Search with icon and clear button
- `ui/NumberInput.tsx` - Number input with label
- `ui/ToggleButton.tsx` - Active/inactive toggle
- `ui/StatCard.tsx` - Metric display card with color variants
- `ui/Modal.tsx` - Reusable modal with escape handling, body scroll lock
- `ui/Spinner.tsx` - Loading spinner and LoadingState component
- `ui/EmptyState.tsx` - Empty state with icon, title, description, action
- `ui/CouplingLegend.tsx` - Color legend for coupling strength

### Feature Components
- `components/index.ts` - Re-exports
- `components/ClusterCard.tsx` - Refactored with StatItem, FilePreviewItem sub-components
- `components/ClustersTable.tsx` - New table view for clusters
- `components/ClusterModal.tsx` - Refactored using sub-components
- `components/ClusterFilterBar.tsx` - New composable filter bar
- `components/FileTreeView.tsx` - Extracted tree view
- `components/FileListView.tsx` - Flat list view
- `components/FolderSummaryView.tsx` - Folder summary table
- `components/ClusterInsights.tsx` - AuthorsCard, CommitsCard, HotFilesCard

### Views
- `views/index.ts` - Re-exports
- `views/ClustersTab.tsx` - Refactored main clusters view
- `views/ExcalidrawView.tsx` - Refactored diagram view
- `views/excalidraw/elementGenerator.ts` - Extracted element generation logic
- `views/ProjectCity.tsx` - Refactored main 3D city component
- `views/city/index.ts` - Re-exports
- `views/city/treemap.ts` - Squarified treemap layout algorithm
- `views/city/CityElements.tsx` - Building, District, DistrictLabel components
- `views/city/CityScene.tsx` - Three.js scene with lighting and controls
- `views/city/CityOverlays.tsx` - BuildingInfoPanel, CityControls, CityStats, CityLegend
- `views/city/cameraUtils.ts` - Camera positioning utilities

### Main Index
- `index.ts` - Single entry point exporting all types, constants, utils, hooks, UI, components, views

## Remaining / Should Be Improved / Reviewed

### To Review
- [ ] Verify all imports in existing files that consume the clustering module are updated
- [ ] Test all functionality after refactoring (ClusteringHub, SnapshotDetail, etc.)
- [ ] Check if RangeSlider component needs to be moved to `ui/` folder
- [ ] Review if old files (original utils.ts, FilterBar.tsx, etc.) should be deleted or kept for reference

### To Improve
- [ ] Add unit tests for utility functions (formatting, naming, filtering, tree)
- [ ] Add Storybook stories for UI primitives
- [ ] Consider adding error boundaries around views
- [ ] Add loading skeletons for better UX
- [ ] Consider lazy loading for heavy views (ProjectCity, ExcalidrawView)

### Potential Enhancements
- [ ] Add keyboard navigation to ClustersTable
- [ ] Add virtualization for large cluster lists
- [ ] Add dark/light theme support to UI primitives
- [ ] Add animation transitions between view modes
- [ ] Consider extracting common patterns into shared workspace-level UI library

### Documentation
- [ ] Add JSDoc comments to exported functions
- [ ] Create README.md for the clustering module explaining architecture
- [ ] Document the cluster naming algorithm
