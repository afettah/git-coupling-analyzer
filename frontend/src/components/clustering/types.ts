import type { ClusterResult } from '../../api';

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

export interface SnapshotDetail {
    id: string;
    name: string;
    result: ClusterResult;
    tags?: string[];
}

export interface ClusterEdge {
    from_cluster: number;
    to_cluster: number;
    coupling_strength: number;
    shared_files?: string[];
}

export interface RepoUrlConfig {
    type: 'github' | 'azure-devops' | 'gitlab' | 'bitbucket';
    baseUrl: string;
    project?: string; // For Azure DevOps
    repository?: string; // For Azure DevOps
    branch?: string; // Default branch
}

export function buildFileUrl(config: RepoUrlConfig, filePath: string): string {
    const branch = config.branch || 'main';
    switch (config.type) {
        case 'azure-devops':
            return `${config.baseUrl}/${config.project}/_git/${config.repository}?path=${encodeURIComponent('/' + filePath)}&version=GB${branch}`;
        case 'github':
            return `${config.baseUrl}/blob/${branch}/${filePath}`;
        case 'gitlab':
            return `${config.baseUrl}/-/blob/${branch}/${filePath}`;
        case 'bitbucket':
            return `${config.baseUrl}/src/${branch}/${filePath}`;
        default:
            return '';
    }
}

export function buildCommitUrl(config: RepoUrlConfig, commitOid: string): string {
    switch (config.type) {
        case 'azure-devops':
            return `${config.baseUrl}/${config.project}/_git/${config.repository}/commit/${commitOid}`;
        case 'github':
            return `${config.baseUrl}/commit/${commitOid}`;
        case 'gitlab':
            return `${config.baseUrl}/-/commit/${commitOid}`;
        case 'bitbucket':
            return `${config.baseUrl}/commits/${commitOid}`;
        default:
            return '';
    }
}
