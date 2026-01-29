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

export default api;
