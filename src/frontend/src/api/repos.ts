import { client } from './client';

export interface RepoInfo {
    id: string;
    name: string;
    path: string;
    state: string;
    file_count: number;
    commit_count: number;
    last_analyzed?: string;
}

export const getRepos = () =>
    client.get<RepoInfo[]>('/repos').then(res => res.data);

export const createRepo = (payload: { path: string; name?: string }) =>
    client.post<RepoInfo>('/repos', payload).then(res => res.data);

export const deleteRepo = (repoId: string) =>
    client.delete(`/repos/${repoId}`).then(res => res.data);
