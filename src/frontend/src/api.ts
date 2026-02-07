import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

// === Global Error Handling ===

export interface ApiErrorInfo {
    code: string;
    message: string;
    details?: any;
    status: number;
}

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const errorInfo: ApiErrorInfo = {
            code: 'UNKNOWN_ERROR',
            message: 'An unexpected error occurred',
            status: error.response?.status || 500,
        };

        if (error.response && error.response.data && error.response.data.error) {
            const apiError = error.response.data.error;
            errorInfo.code = apiError.code;
            errorInfo.message = apiError.message;
            errorInfo.details = apiError.details;
        } else if (error.message) {
            errorInfo.message = error.message;
        }

        // Dispatch a global event for the UI to handle
        window.dispatchEvent(new CustomEvent('api-error', { detail: errorInfo }));

        return Promise.reject(errorInfo);
    }
);

// === Types ===

export interface RepoInfo {
    id: string;
    name: string;
    path: string;
    state: string;
    file_count: number;
    commit_count: number;
    last_analyzed?: string;
}

export interface AnalysisStatus {
    state: string;
    stage?: string;
    progress?: number;
    processed_commits?: number;
    total_commits?: number;
    error?: string;
}

export interface FileInfo {
    file_id: number;
    path: string;
    exists_at_head: boolean;
    total_commits: number;
}

export interface CoupledFile {
    file_id: number;
    path: string;
    pair_count: number;
    jaccard: number;
    jaccard_weighted: number;
    p_dst_given_src: number;
    p_src_given_dst: number;
}

export interface ClusterResult {
    algorithm: string;
    parameters: Record<string, any>;
    cluster_count: number;
    clusters: Array<{
        id: number;
        size: number;
        files: string[];
        total_churn?: number;
        avg_coupling?: number;
        hot_files?: Array<{ path: string; churn: number }>;
        top_commits?: Array<{ oid: string; message: string; author: string; file_count: number }>;
        common_authors?: Array<{ name: string; email: string; commit_count: number }>;
    }>;
    metrics: Record<string, any>;
}

export interface ComparisonResult {
    comparisons: Array<{
        old_id: number | null;
        new_id: number | null;
        overlap_count?: number;
        overlap_ratio?: number;
        status: 'stable' | 'drifted' | 'dissolved' | 'new';
        size_diff?: number;
    }>;
    flows: Array<{
        source: number;
        target: number;
        value: number;
    }>;
    nodes: {
        old: Array<{ id: number; size: number }>;
        new: Array<{ id: number; size: number }>;
    };
    summary: {
        stable: number;
        drifted: number;
        dissolved: number;
        new: number;
    };
}

export interface AnalysisConfig {
    repo_path?: string;
    min_revisions?: number;
    max_changeset_size?: number;
    changeset_mode?: 'by_commit' | 'by_author_time' | 'by_ticket_id';
    min_cooccurrence?: number;
    window_days?: number;
    since?: string;
    until?: string;
}

export interface ClusterConfig {
    algorithm: string;
    weight_column?: string;
    min_weight?: number;
    folders?: string[];
    params?: Record<string, any>;
}

// === API Functions ===

export const getRepos = () =>
    api.get<RepoInfo[]>('/repos').then(res => res.data);

export const createRepo = (payload: { path: string; name?: string }) =>
    api.post<RepoInfo>('/repos', payload).then(res => res.data);

export const deleteRepo = (repoId: string) =>
    api.delete(`/repos/${repoId}`).then(res => res.data);

// Git remote info
export interface GitRemoteInfo {
    git_remote_url: string | null;
    git_web_url: string | null;
    git_provider: 'github' | 'gitlab' | 'azure_devops' | 'bitbucket' | null;
    git_default_branch: string;
}

export const getGitInfo = (repoId: string) =>
    api.get<GitRemoteInfo>(`/repos/${repoId}/git-info`).then(res => res.data);

export const updateGitInfo = (repoId: string, info: Partial<GitRemoteInfo>) =>
    api.put(`/repos/${repoId}/git-info`, info).then(res => res.data);

export const startAnalysis = (repoId: string, config: AnalysisConfig) =>
    api.post(`/repos/${repoId}/analysis/start`, config).then(res => res.data);

export const getAnalysisStatus = (repoId: string) =>
    api.get(`/repos/${repoId}/analysis/status`).then(res => res.data);

// Files - current structure only
export const getFileTree = (repoId: string) =>
    api.get(`/repos/${repoId}/files/tree`).then(res => res.data);

export const listFiles = (repoId: string, params?: {
    q?: string;
    current_only?: boolean;
    limit?: number;
    sort_by?: 'path' | 'commits';
    sort_dir?: 'asc' | 'desc';
}) => api.get<FileInfo[]>(`/repos/${repoId}/files`, { params }).then(res => res.data);

export const getFolders = (repoId: string, depth?: number) =>
    api.get<string[]>(`/repos/${repoId}/folders`, { params: { depth } }).then(res => res.data);

// File history
export const getFileHistory = (repoId: string, path: string) =>
    api.get(`/repos/${repoId}/files/${encodeURIComponent(path)}/history`).then(res => res.data);

// File details
export interface FileDetailsResponse {
    file_id: number;
    path: string;
    exists_at_head: boolean;
    total_commits: number;
    first_commit_date: string | null;
    last_commit_date: string | null;
    total_lines_added: number;
    total_lines_deleted: number;
    authors_count: number;
    top_author: string | null;
    coupled_files_count: number;
    max_coupling: number;
    strong_coupling_count: number;
    commits_last_30_days: number;
    churn_rate: number;
    risk_score: number;
}

export interface FileActivityResponse {
    commits_by_period: Array<{ period: string; count: number }>;
    lines_by_period: Array<{ period: string; added: number; deleted: number }>;
    authors_by_period: Array<{ period: string; count: number }>;
    heatmap_data: Array<{ date: string; count: number }>;
    day_hour_matrix: Array<{ day: number; hours: number[] }>;
}

export interface FileAuthor {
    name: string;
    commits: number;
    percentage: number;
    lines_added: number;
    lines_deleted: number;
    first_commit: string | null;
    last_commit: string | null;
}

export interface FileAuthorsResponse {
    authors: FileAuthor[];
    ownership_timeline: Array<{
        month: string;
        authors: Array<{ name: string; commits: number }>;
    }>;
}

export interface FileCommit {
    oid: string;
    message: string;
    author: string;
    date: string | null;
    lines_added: number;
    lines_deleted: number;
}

export interface FileCommitsResponse {
    commits: FileCommit[];
    total_count: number;
}

export interface FolderDetailsResponse {
    path: string;
    file_count: number;
    subfolder_count: number;
    total_commits: number;
    total_lines_added: number;
    total_lines_deleted: number;
    authors_count: number;
    top_author: string | null;
    health_score: number;
    hot_files: Array<{ path: string; commits: number }>;
    treemap_data: Array<{
        path: string;
        name: string;
        size: number;
        commits: number;
        churn_level: 'high' | 'medium' | 'low';
    }>;
    churn_distribution: Array<{ bucket: string; count: number }>;
    coupling_stats: {
        internal_coupling: number;
        external_coupling: number;
        cohesion_score: number;
        coupled_external_files: Array<{ path: string }>;
    };
}

export const getFileDetails = (repoId: string, path: string) =>
    api.get<FileDetailsResponse>(`/repos/${repoId}/files/${encodeURIComponent(path)}/details`).then(res => res.data);

export const getFileActivity = (repoId: string, path: string, granularity: string = 'monthly') =>
    api.get<FileActivityResponse>(`/repos/${repoId}/files/${encodeURIComponent(path)}/activity`, {
        params: { granularity }
    }).then(res => res.data);

export const getFileAuthors = (repoId: string, path: string) =>
    api.get<FileAuthorsResponse>(`/repos/${repoId}/files/${encodeURIComponent(path)}/authors`).then(res => res.data);

export const getFileCommits = (repoId: string, path: string, params?: {
    search?: string;
    exclude_merges?: boolean;
    limit?: number;
    offset?: number;
}) => api.get<FileCommitsResponse>(`/repos/${repoId}/files/${encodeURIComponent(path)}/commits`, { params }).then(res => res.data);

export const getFolderDetails = (repoId: string, path: string) =>
    api.get<FolderDetailsResponse>(`/repos/${repoId}/folders/${encodeURIComponent(path)}/details`).then(res => res.data);

// Global coupling
export const getCoupling = (repoId: string, path: string, params?: {
    metric?: string;
    min_weight?: number;
    limit?: number;
}) => api.get<CoupledFile[]>(`/repos/${repoId}/coupling`, {
    params: { path, ...params }
}).then(res => res.data);

export const getCouplingGraph = (repoId: string, path: string, params?: {
    metric?: string;
    min_weight?: number;
    limit?: number;
}) => api.get(`/repos/${repoId}/coupling/graph`, {
    params: { path, ...params }
}).then(res => res.data);

// Component coupling
export const getComponentCoupling = (repoId: string, component: string, depth?: number) =>
    api.get(`/repos/${repoId}/coupling/components`, {
        params: { component, depth }
    }).then(res => res.data);

// Clustering
export const getClusteringAlgorithms = (repoId: string) =>
    api.get<Array<{ name: string; params_schema: any }>>(`/repos/${repoId}/clustering/algorithms`)
        .then(res => res.data);

export const runClustering = (repoId: string, config: ClusterConfig) =>
    api.post<ClusterResult>(`/repos/${repoId}/clustering/run`, config).then(res => res.data);

export const saveClusteringSnapshot = (repoId: string, name: string, result: ClusterResult, tags?: string[]) =>
    api.post(`/repos/${repoId}/clustering/snapshots`, { name, result, tags }).then(res => res.data);

export const getClusteringSnapshots = (repoId: string) =>
    api.get<Array<{
        id: string;
        name: string;
        algorithm: string;
        created_at: string;
        cluster_count?: number;
        file_count?: number;
        avg_coupling?: number;
        tags?: string[];
    }>>(`/repos/${repoId}/clustering/snapshots`).then(res => res.data);

export const getClusteringSnapshot = (repoId: string, snapshotId: string) =>
    api.get<{ name: string; result: ClusterResult }>(`/repos/${repoId}/clustering/snapshots/${snapshotId}`).then(res => res.data);

export const updateClusteringSnapshot = (repoId: string, snapshotId: string, payload: { name?: string; tags?: string[] }) =>
    api.put(`/repos/${repoId}/clustering/snapshots/${snapshotId}`, payload).then(res => res.data);

export const deleteClusteringSnapshot = (repoId: string, snapshotId: string) =>
    api.delete(`/repos/${repoId}/clustering/snapshots/${snapshotId}`).then(res => res.data);

export const getClusteringSnapshotEdges = (repoId: string, snapshotId: string) =>
    api.get<{ edges: Array<{ from_cluster: number; to_cluster: number; coupling_strength: number; shared_files?: string[] }> }>(
        `/repos/${repoId}/clustering/snapshots/${snapshotId}/edges`
    ).then(res => res.data);

export const compareClusteringSnapshots = (repoId: string, base: string, head: string) =>
    api.get<ComparisonResult>(`/repos/${repoId}/clustering/compare`, { params: { base, head } }).then(res => res.data);

// Legacy compatibility
export const getImpact = (repoId: string, params: { path: string; top?: number }) =>
    api.get(`/repos/${repoId}/impact`, { params }).then(res => res.data);

export const getImpactGraph = (repoId: string, params: { path: string; top?: number }) =>
    api.get(`/repos/${repoId}/impact/graph`, { params }).then(res => res.data);

export const getLineage = (repoId: string, path: string) =>
    api.get(`/repos/${repoId}/files/${encodeURIComponent(path)}/lineage`).then(res => res.data);

// Dashboard Summary
export interface DashboardSummary {
    totalFiles: number;
    totalCommits: number;
    totalAuthors: number;
    avgCoupling: number;
    hotspotCount: number;
    riskScore: number;
    lastAnalyzed: string | null;
    codebaseAge: number;
    linesAdded: number;
    linesDeleted: number;
}

// Dashboard Trends
export interface TrendPoint {
    period: string;
    commits: number;
    coupling: number;
    files: number;
}

// Hotspot
export interface HotspotFile {
    path: string;
    commits: number;
    coupling: number;
    authors: number;
    riskScore: number;
    linesChanged: number;
    lastModified: string;
    folder: string;
    extension: string;
}

// Author stats
export interface AuthorStats {
    name: string;
    commits: number;
    files: number;
    percentage: number;
}

// Timeline point
export interface TimelinePoint {
    date: string;
    totalFiles: number;
    totalCoupling: number;
    avgCoupling: number;
    hotspots: number;
    commits: number;
    riskScore: number;
    topFiles: Array<{ path: string; coupling: number; trend: 'up' | 'down' | 'stable' }>;
}

// Coupling edge (for export)
export interface CouplingEdge {
    source: string;
    target: string;
    coupling: number;
    pair_count: number;
}

// Dashboard
export const getDashboardSummary = (repoId: string) =>
    api.get<DashboardSummary>(`/repos/${repoId}/dashboard/summary`).then(res => res.data);

export const getDashboardTrends = (repoId: string, params?: {
    months?: number;
    granularity?: string;
}) => api.get<TrendPoint[]>(`/repos/${repoId}/dashboard/trends`, { params }).then(res => res.data);

// Hotspots
export const getHotspots = (repoId: string, params?: {
    limit?: number;
    sort_by?: string;
    sort_dir?: string;
    min_commits?: number;
    min_risk_score?: number;
    q?: string;
}) => api.get<HotspotFile[]>(`/repos/${repoId}/hotspots`, { params }).then(res => res.data);

// Authors
export const getRepoAuthors = (repoId: string, params?: {
    limit?: number;
}) => api.get<AuthorStats[]>(`/repos/${repoId}/authors`, { params }).then(res => res.data);

// Timeline
export const getRepoTimeline = (repoId: string, params?: {
    points?: number;
    granularity?: string;
}) => api.get<TimelinePoint[]>(`/repos/${repoId}/timeline`, { params }).then(res => res.data);

// Coupling edges (for export)
export const getCouplingEdges = (repoId: string, params?: {
    limit?: number;
    min_weight?: number;
    metric?: string;
    offset?: number;
}) => api.get<CouplingEdge[]>(`/repos/${repoId}/coupling/edges`, { params }).then(res => res.data);

export default api;
