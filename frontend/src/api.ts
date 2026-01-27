import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

export interface RepoInfo {
    id: string;
    name: string;
    path: string;
    last_analyzed: string | null;
    state: 'not_started' | 'running' | 'complete' | 'failed';
}

export interface AnalysisStatus {
    state: string;
    stage: string;
    processed_commits: number;
    total_commits: number;
    progress: number;
    error?: string;
    updated_at: string;
}

export const getRepos = () => api.get<RepoInfo[]>('/repos').then(res => res.data);

export const createRepo = (payload: { path: string; name?: string }) =>
    api.post<RepoInfo>('/repos', payload).then(res => res.data);

export const startAnalysis = (repoId: string, payload: any) =>
    api.post(`/repos/${repoId}/analysis/start`, payload).then(res => res.data);

export const getAnalysisStatus = (repoId: string) =>
    api.get<AnalysisStatus>(`/repos/${repoId}/analysis/status`).then(res => res.data);

export const getFolderTree = (repoId: string) =>
    api.get(`/repos/${repoId}/folders/tree`).then(res => res.data);

export const getImpactGraph = (repoId: string, params: any) =>
    api.get(`/repos/${repoId}/impact/graph`, { params }).then(res => res.data);

export const getImpact = (repoId: string, params: any) =>
    api.get(`/repos/${repoId}/impact`, { params }).then(res => res.data);

export const getLineage = (repoId: string, path: string) =>
    api.get(`/repos/${repoId}/files/${encodeURIComponent(path)}/lineage`).then(res => res.data);

export const startClustering = (repoId: string, payload: any) =>
    api.post(`/repos/${repoId}/clusters/start`, payload).then(res => res.data);

export const getClusterStatus = (repoId: string, runId: string) =>
    api.get(`/repos/${repoId}/clusters/${runId}/status`).then(res => res.data);

export const getClusterResults = (repoId: string, runId: string) =>
    api.get(`/repos/${repoId}/clusters/${runId}`).then(res => res.data);

export default api;
