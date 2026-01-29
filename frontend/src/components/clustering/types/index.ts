/**
 * Clustering Module Types
 * 
 * Centralized type definitions for the clustering feature.
 * Provides strong typing for all clustering-related data structures.
 */

import type { ClusterResult } from '../../../api';

// ============================================================
// Core Domain Types
// ============================================================

/** Summary information for a saved snapshot */
export interface SnapshotSummary {
    id: string;
    name: string;
    algorithm: string;
    created_at: string;
    cluster_count?: number;
    file_count?: number;
    avg_coupling?: number;
    tags?: string[];
}

/** Full snapshot detail with clustering result */
export interface SnapshotDetail {
    id: string;
    name: string;
    result: ClusterResult;
    tags?: string[];
}

/** Edge between two clusters representing coupling strength */
export interface ClusterEdge {
    from_cluster: number;
    to_cluster: number;
    coupling_strength: number;
    shared_files?: string[];
}

/** Individual cluster data with computed name */
export interface ClusterData {
    id: number;
    name: string;
    size: number;
    files: string[];
    avg_coupling?: number;
    total_churn?: number;
    hot_files?: HotFile[];
    top_commits?: TopCommit[];
    common_authors?: Author[];
}

/** Hot file with high churn */
export interface HotFile {
    path: string;
    churn: number;
}

/** Top commit in a cluster */
export interface TopCommit {
    oid: string;
    message: string;
    author: string;
    file_count: number;
}

/** Author contribution info */
export interface Author {
    name: string;
    email: string;
    commit_count: number;
}

// ============================================================
// Repository URL Configuration
// ============================================================

export type RepoUrlType = 'github' | 'azure-devops' | 'gitlab' | 'bitbucket';

export interface RepoUrlConfig {
    type: RepoUrlType;
    baseUrl: string;
    project?: string;
    repository?: string;
    branch?: string;
}

// ============================================================
// Filter & Sort Types
// ============================================================

export type SortField = 'rank' | 'coupling' | 'files' | 'folders' | 'churn' | 'name';
export type SortOrder = 'asc' | 'desc';
export type ViewMode = 'cards' | 'table';
export type ModalViewMode = 'tree' | 'flat' | 'summary';
export type ColorMode = 'cluster' | 'coupling';

/** Unified filter state for clusters */
export interface ClusterFilterState {
    minClusterSize: number;
    couplingRange: [number, number];
    fileRange: [number, number];
    search: string;
}

/** Full filter state including sort options */
export interface FullFilterState extends ClusterFilterState {
    sortBy: SortField;
    sortOrder: SortOrder;
    viewMode: ViewMode;
    depth: number;
    directory: string;
}

// ============================================================
// Tree Structures
// ============================================================

/** File tree node for directory visualization */
export interface TreeNode {
    name: string;
    path: string;
    children: TreeNode[];
    files: string[];
}

/** Folder aggregation result */
export interface FolderCount {
    path: string;
    count: number;
}

// ============================================================
// Visualization Types (ProjectCity)
// ============================================================

export interface FileData {
    path: string;
    filename: string;
    coupling: number;
    clusterId: number | null;
    clusterIndex: number | null;
    loc?: number;
}

export interface FolderNode {
    name: string;
    path: string;
    files: FileData[];
    children: Map<string, FolderNode>;
    x: number;
    y: number;
    width: number;
    height: number;
    depth: number;
}

export interface BuildingData {
    x: number;
    z: number;
    height: number;
    width: number;
    depth: number;
    color: string;
    label: string;
    fullPath: string;
    coupling: number;
    clusterId: number | null;
    folder: string;
}

export interface DistrictData {
    x: number;
    z: number;
    width: number;
    depth: number;
    name: string;
    path: string;
    level: number;
    labelPosition: 'top' | 'left';
    labelMargin: number;
}

// ============================================================
// Component Props Types
// ============================================================

export interface ClusterCardProps {
    cluster: ClusterData;
    folderDepth: number;
    onExplore: () => void;
    onExport: () => void;
    repoUrlConfig?: RepoUrlConfig;
}

export interface ClusterModalProps {
    cluster: ClusterData;
    onClose: () => void;
    onExport: () => void;
    repoUrlConfig?: RepoUrlConfig;
}

export interface FilterBarProps {
    viewMode: ViewMode;
    onViewModeChange: (value: ViewMode) => void;
    sortBy: SortField;
    onSortByChange: (value: SortField) => void;
    sortOrder: SortOrder;
    onSortOrderChange: (value: SortOrder) => void;
    depth: number;
    onDepthChange: (value: number) => void;
    filters: ClusterFilterState;
    onFiltersChange: (filters: ClusterFilterState) => void;
}

export interface ClusterFiltersProps {
    filters: ClusterFilterState;
    onFiltersChange: (filters: ClusterFilterState) => void;
    maxFileCount: number;
    filteredCount: number;
    totalCount: number;
    showFileRange?: boolean;
    countLabel?: string;
}
