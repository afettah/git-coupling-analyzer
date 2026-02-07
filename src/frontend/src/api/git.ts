import { client, type ApiErrorInfo } from './client';
export type { ApiErrorInfo };

// === Types ===

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

export interface GitRemoteInfo {
    git_remote_url: string | null;
    git_web_url: string | null;
    git_provider: 'github' | 'gitlab' | 'azure_devops' | 'bitbucket' | null;
    git_default_branch: string;
}

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


// === API Functions ===

export const getGitInfo = (repoId: string) =>
    client.get<GitRemoteInfo>(`/repos/${repoId}/git-info`).then(res => res.data);

export const updateGitInfo = (repoId: string, info: Partial<GitRemoteInfo>) =>
    client.put(`/repos/${repoId}/git-info`, info).then(res => res.data);

export const startAnalysis = (repoId: string, config: AnalysisConfig) =>
    client.post(`/repos/${repoId}/analyzers/run`, { analyzer_type: 'git', config }).then(res => res.data);

export const getAnalysisStatus = (repoId: string) =>
    client.get(`/repos/${repoId}/analyzers/git/status`).then(res => res.data);

// Files
export const getFileTree = (repoId: string) =>
    client.get(`/repos/${repoId}/git/tree`).then(res => res.data);

export const listFiles = (repoId: string, params?: {
    q?: string;
    current_only?: boolean;
    limit?: number;
    sort_by?: 'path' | 'commits';
    sort_dir?: 'asc' | 'desc';
}) => client.get<FileInfo[]>(`/repos/${repoId}/git/files`, { params }).then(res => res.data);

export const getFolders = (repoId: string, depth?: number) =>
    client.get<string[]>(`/repos/${repoId}/git/folders`, { params: { depth } }).then(res => res.data);

// File history
export const getFileHistory = (repoId: string, path: string) =>
    client.get(`/repos/${repoId}/git/files/${encodeURIComponent(path)}/history`).then(res => res.data);

export const getFileDetails = (repoId: string, path: string) =>
    client.get<FileDetailsResponse>(`/repos/${repoId}/git/files/${encodeURIComponent(path)}/details`).then(res => res.data);

export const getFileActivity = (repoId: string, path: string, granularity: string = 'monthly') =>
    client.get<FileActivityResponse>(`/repos/${repoId}/git/files/${encodeURIComponent(path)}/activity`, {
        params: { granularity }
    }).then(res => res.data);

export const getFileAuthors = (repoId: string, path: string) =>
    client.get<FileAuthorsResponse>(`/repos/${repoId}/git/files/${encodeURIComponent(path)}/authors`).then(res => res.data);

export const getFileCommits = (repoId: string, path: string, params?: {
    search?: string;
    exclude_merges?: boolean;
    limit?: number;
    offset?: number;
}) => client.get<FileCommitsResponse>(`/repos/${repoId}/git/files/${encodeURIComponent(path)}/commits`, { params }).then(res => res.data);

export const getFolderDetails = (repoId: string, path: string) =>
    client.get<FolderDetailsResponse>(`/repos/${repoId}/git/folders/${encodeURIComponent(path)}/details`).then(res => res.data);

// Coupling
export const getCoupling = (repoId: string, path: string, params?: {
    metric?: string;
    min_weight?: number;
    limit?: number;
}) => client.get<CoupledFile[]>(`/repos/${repoId}/git/coupling`, {
    params: { path, ...params }
}).then(res => res.data);

export const getCouplingGraph = (repoId: string, path: string, params?: {
    metric?: string;
    min_weight?: number;
    limit?: number;
}) => client.get(`/repos/${repoId}/git/graph`, {
    params: { root_path: path, ...params }
}).then(res => res.data);

// Component coupling
export const getComponentCoupling = (repoId: string, component: string, depth?: number) =>
    client.get(`/repos/${repoId}/git/coupling/components`, {
        params: { component, depth }
    }).then(res => res.data);

// Clustering
export const getClusteringAlgorithms = (repoId: string) =>
    client.get<Array<{ name: string; params_schema: any }>>(`/repos/${repoId}/git/clustering/algorithms`)
        .then(res => res.data);

export const runClustering = (repoId: string, config: ClusterConfig) =>
    client.post<ClusterResult>(`/repos/${repoId}/git/clustering/run`, config).then(res => res.data);

export const saveClusteringSnapshot = (repoId: string, name: string, result: ClusterResult, tags?: string[]) =>
    client.post(`/repos/${repoId}/git/clustering/snapshots`, { name, result, tags }).then(res => res.data);

export const getClusteringSnapshots = (repoId: string) =>
    client.get<Array<{
        id: string;
        name: string;
        algorithm: string;
        created_at: string;
        cluster_count?: number;
        file_count?: number;
        avg_coupling?: number;
        tags?: string[];
    }>>(`/repos/${repoId}/git/clustering/snapshots`).then(res => res.data);

export const getClusteringSnapshot = (repoId: string, snapshotId: string) =>
    client.get<{ name: string; result: ClusterResult }>(`/repos/${repoId}/git/clustering/snapshots/${snapshotId}`).then(res => res.data);

export const updateClusteringSnapshot = (repoId: string, snapshotId: string, payload: { name?: string; tags?: string[] }) =>
    client.put(`/repos/${repoId}/git/clustering/snapshots/${snapshotId}`, payload).then(res => res.data);

export const deleteClusteringSnapshot = (repoId: string, snapshotId: string) =>
    client.delete(`/repos/${repoId}/git/clustering/snapshots/${snapshotId}`).then(res => res.data);

export const getClusteringSnapshotEdges = (repoId: string, snapshotId: string) =>
    client.get<{ edges: Array<{ from_cluster: number; to_cluster: number; coupling_strength: number; shared_files?: string[] }> }>(
        `/repos/${repoId}/git/clustering/snapshots/${snapshotId}/edges`
    ).then(res => res.data);

export const compareClusteringSnapshots = (repoId: string, base: string, head: string) =>
    client.get<ComparisonResult>(`/repos/${repoId}/git/clustering/compare`, { params: { base, head } }).then(res => res.data);

// Dashboard
export const getDashboardSummary = (repoId: string) =>
    client.get(`/repos/${repoId}/git/dashboard/summary`).then(res => {
        const d = res.data;
        return {
            totalFiles: d.file_count ?? 0,
            totalCommits: d.commit_count ?? 0,
            totalAuthors: d.author_count ?? 0,
            avgCoupling: d.avg_coupling ?? 0,
            hotspotCount: d.hotspot_count ?? 0,
            riskScore: d.risk_score ?? 0,
            lastAnalyzed: d.last_analyzed ?? null,
            codebaseAge: d.codebase_age ?? 0,
            linesAdded: d.lines_added ?? 0,
            linesDeleted: d.lines_deleted ?? 0,
        } as DashboardSummary;
    });

export const getDashboardTrends = (repoId: string, params?: {
    months?: number;
    granularity?: string;
}) => client.get(`/repos/${repoId}/git/dashboard/trends`, { params }).then(res => {
    // Backend returns [{date, count}], map to TrendPoint
    const data = res.data;
    if (Array.isArray(data)) {
        return data.map((d: any) => ({
            period: d.date ?? d.period ?? '',
            commits: d.count ?? d.commits ?? 0,
            coupling: d.coupling ?? 0,
            files: d.files ?? 0,
        })) as TrendPoint[];
    }
    return data as TrendPoint[];
});

// Hotspots
export const getHotspots = (repoId: string, params?: {
    limit?: number;
    sort_by?: string;
    sort_dir?: string;
    min_commits?: number;
    min_risk_score?: number;
    q?: string;
}) => client.get(`/repos/${repoId}/git/hotspots`, { params }).then(res => {
    const data = res.data;
    if (Array.isArray(data)) {
        return data.map((d: any) => ({
            path: d.path ?? '',
            commits: d.total_commits ?? d.commits ?? 0,
            coupling: d.coupling ?? 0,
            authors: d.authors ?? 0,
            riskScore: d.risk_score ?? d.riskScore ?? 0,
            linesChanged: (d.total_lines_added ?? 0) + (d.total_lines_deleted ?? 0),
            lastModified: d.last_modified ?? d.lastModified ?? '',
            folder: d.path ? d.path.substring(0, d.path.lastIndexOf('/')) : '',
            extension: d.path ? d.path.substring(d.path.lastIndexOf('.')) : '',
        })) as HotspotFile[];
    }
    return data as HotspotFile[];
});

// Authors
export const getRepoAuthors = (repoId: string, params?: {
    limit?: number;
}) => client.get<AuthorStats[]>(`/repos/${repoId}/git/authors`, { params }).then(res => res.data);

// Timeline
export const getRepoTimeline = (repoId: string, params?: {
    points?: number;
    granularity?: string;
}) => client.get(`/repos/${repoId}/git/timeline`, { params }).then(res => {
    const data = res.data;
    if (Array.isArray(data)) {
        return data.map((d: any) => ({
            date: d.date ?? '',
            totalFiles: d.totalFiles ?? d.total_files ?? 0,
            totalCoupling: d.totalCoupling ?? d.total_coupling ?? 0,
            avgCoupling: d.avgCoupling ?? d.avg_coupling ?? 0,
            hotspots: d.hotspots ?? 0,
            commits: d.count ?? d.commits ?? 0,
            riskScore: d.riskScore ?? d.risk_score ?? 0,
            topFiles: d.topFiles ?? d.top_files ?? [],
        })) as TimelinePoint[];
    }
    return data as TimelinePoint[];
});

// Coupling edges (for export)
export const getCouplingEdges = (repoId: string, params?: {
    limit?: number;
    min_weight?: number;
    metric?: string;
    offset?: number;
}) => client.get<CouplingEdge[]>(`/repos/${repoId}/git/coupling/edges`, { params }).then(res => res.data);

// Impact and Lineage
export const getImpact = (repoId: string, params: { path: string; top?: number }) =>
    client.get(`/repos/${repoId}/git/impact`, { params }).then(res => res.data);

export const getImpactGraph = (repoId: string, params: { path: string; top?: number }) =>
    client.get(`/repos/${repoId}/git/impact/graph`, { params }).then(res => res.data);

export const getLineage = (repoId: string, path: string) =>
    client.get(`/repos/${repoId}/git/files/${encodeURIComponent(path)}/lineage`).then(res => res.data);
