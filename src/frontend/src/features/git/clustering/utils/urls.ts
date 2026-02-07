/**
 * URL Building Utilities
 * 
 * Functions for generating repository URLs for files and commits.
 */

import type { RepoUrlConfig } from '../types';

/** Build a URL to view a file in the repository */
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

/** Build a URL to view a commit in the repository */
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

/** Build a URL to view a folder/directory in the repository */
export function buildFolderUrl(config: RepoUrlConfig, folderPath: string): string {
    const branch = config.branch || 'main';

    switch (config.type) {
        case 'azure-devops':
            return `${config.baseUrl}/${config.project}/_git/${config.repository}?path=${encodeURIComponent('/' + folderPath)}&version=GB${branch}`;
        case 'github':
            return `${config.baseUrl}/tree/${branch}/${folderPath}`;
        case 'gitlab':
            return `${config.baseUrl}/-/tree/${branch}/${folderPath}`;
        case 'bitbucket':
            return `${config.baseUrl}/src/${branch}/${folderPath}`;
        default:
            return '';
    }
}

/** Validate and parse a repository URL config from a base URL */
export function parseRepoUrl(url: string): RepoUrlConfig | null {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();

        if (host.includes('github.com')) {
            return { type: 'github', baseUrl: url.replace(/\/$/, '') };
        }
        if (host.includes('gitlab.com') || host.includes('gitlab')) {
            return { type: 'gitlab', baseUrl: url.replace(/\/$/, '') };
        }
        if (host.includes('bitbucket.org') || host.includes('bitbucket')) {
            return { type: 'bitbucket', baseUrl: url.replace(/\/$/, '') };
        }
        if (host.includes('azure.com') || host.includes('visualstudio.com')) {
            // Azure DevOps requires additional parsing
            return { type: 'azure-devops', baseUrl: url.replace(/\/$/, '') };
        }

        return null;
    } catch {
        return null;
    }
}
