import { client } from './client';

export interface RepoInfo {
    id: string;
    name: string;
    path: string;
    state: string;
    file_count: number;
    commit_count: number;
    last_analyzed?: string;
    validation_issues?: number;
    has_errors?: boolean;
    scan?: ScanSummary | null;
}

export interface ScanSummary {
    scan_id: string;
    total_files: number;
    total_dirs: number;
    commit_count: number;
    languages: Record<string, number>;
    frameworks: string[];
    first_commit_date?: string | null;
    last_commit_date?: string | null;
}

export interface ScanStatusResponse {
    repo_id: string;
    state: string;
    scan: ScanSummary | null;
    error?: string | null;
}

export const getRepos = () =>
    client.get<RepoInfo[]>('/repos').then(res => res.data);

export const createRepo = (payload: { path: string; name?: string }) =>
    client.post<RepoInfo>('/repos', payload).then(res => res.data);

export const deleteRepo = (repoId: string) =>
    client.delete(`/repos/${repoId}`).then(res => res.data);

export const getRepoScan = (repoId: string) =>
    client.get<ScanStatusResponse>(`/repos/${repoId}/scan`).then(res => res.data);

export const rescanRepo = (repoId: string) =>
    client.post<ScanStatusResponse>(`/repos/${repoId}/scan`).then(res => res.data);
