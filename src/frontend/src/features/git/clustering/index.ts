/**
 * Clustering Module
 * 
 * This module provides comprehensive clustering visualization and analysis
 * capabilities for the Git Coupling Analyzer.
 * 
 * @example
 * ```tsx
 * // Import components
 * import { ClustersTab, ClusterCard, ClusterModal } from './clustering';
 * 
 * // Import utilities
 * import { generateClusterName, filterClusters } from './clustering';
 * 
 * // Import types
 * import type { ClusterData, ClusterFilterState } from './clustering';
 * ```
 */

// ============================================================
// Types
// ============================================================

export type {
    // Core types
    SnapshotSummary,
    SnapshotDetail,
    ClusterEdge,
    ClusterData,
    HotFile,
    TopCommit,
    Author,

    // Configuration
    RepoUrlType,
    RepoUrlConfig,

    // Filter & Sort
    SortField,
    SortOrder,
    ViewMode,
    ModalViewMode,
    ColorMode,
    ClusterFilterState,
    FullFilterState,

    // Tree structures
    TreeNode,
    FolderCount,

    // Visualization
    FileData,
    FolderNode,
    BuildingData,
    DistrictData,

    // Component props
    ClusterCardProps,
    ClusterModalProps,
    FilterBarProps,
    ClusterFiltersProps,
} from './types';

// ============================================================
// Constants
// ============================================================

export {
    CLUSTER_PALETTE,
    UNCLUSTERED_COLOR,
    COUPLING_COLORS,
    getCouplingColor,
    DISTRICT_COLORS,
    DEFAULT_FILTER_STATE,
    EXCLUDED_TOKENS,
    EXCALIDRAW_CONFIG,
    CITY_CONFIG,
} from './constants';

// ============================================================
// Utilities
// ============================================================

export {
    // Formatting
    formatPercent,
    formatNumber,
    formatDateShort,
    relativeTime,
    getFileName,
    getFolderPath,
    truncate,

    // Naming
    generateClusterName,
    calculateClusterRank,
    sortClustersByRank,
    enrichClustersWithNames,

    // Tree operations
    buildFileTree,
    aggregateFolders,
    getUniqueFolders,
    getAllFilesFromTree,

    // URL building
    buildFileUrl,
    buildCommitUrl,
    buildFolderUrl,
    parseRepoUrl,

    // Filtering
    filterClusters,
    sortClusters,
    filterAndSortClusters,
    calculateClusterStats,

    // Export
    exportClusterToCsv,
    exportAllClustersToCsv,
    downloadBlob,
    copyToClipboard,
} from './utils';

// ============================================================
// Hooks
// ============================================================

export {
    useSnapshots,
    useClusterFilters,
    useSelection,
} from './hooks';

// ============================================================
// UI Components (Re-exported from shared library)
// ============================================================

export {
    Button,
    Select,
    SearchInput,
    NumberInput,
    RangeSlider,
    ToggleButton,
    StatCard,
    Modal,
    Spinner,
    LoadingState,
    EmptyState,
    CouplingLegend,
} from '@/shared';

// Clustering-specific filter component
export { ClusterFilters } from './ui';

// ============================================================
// Feature Components
// ============================================================

export {
    ClusterCard,
    ClustersTable,
    ClusterModal,
    ClusterFilterBar,
    FileTreeView,
    FileListView,
    FolderSummaryView,
    ClusterInsights,
} from './components';

// ============================================================
// View Components
// ============================================================

export {
    ClustersTab,
    ExcalidrawView,
    ProjectCity,
} from './views';
