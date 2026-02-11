/**
 * Cluster Insights Panel Component
 * 
 * Displays insights about a cluster: authors, commits, hot files.
 */

import { ExternalLink, FileSearch } from 'lucide-react';
import type { ClusterData, RepoUrlConfig } from '../types';
import { formatNumber, getFileName, buildFileUrl, buildCommitUrl } from '../utils';

export interface ClusterInsightsProps {
    cluster: ClusterData;
    repoUrlConfig?: RepoUrlConfig;
    onFileSelect?: (path: string) => void;
}

export function ClusterInsights({ cluster, repoUrlConfig, onFileSelect }: ClusterInsightsProps) {
    return (
        <div className="border-t border-slate-800 pt-4">
            <h4 className="text-sm font-semibold text-slate-200 mb-3">Cluster Insights</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <AuthorsCard authors={cluster.common_authors || []} />
                <CommitsCard
                    commits={cluster.top_commits || []}
                    repoUrlConfig={repoUrlConfig}
                />
                <HotFilesCard
                    hotFiles={cluster.hot_files || []}
                    repoUrlConfig={repoUrlConfig}
                    onFileSelect={onFileSelect}
                />
            </div>
        </div>
    );
}

interface AuthorsCardProps {
    authors: Array<{ name: string; email: string; commit_count: number }>;
}

function AuthorsCard({ authors }: AuthorsCardProps) {
    return (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-xs text-slate-500 mb-2">Top Authors</div>
            {authors.length === 0 ? (
                <div className="text-xs text-slate-400">No author data</div>
            ) : (
                <div className="space-y-1">
                    {authors.slice(0, 5).map((author) => (
                        <div key={author.email} className="text-xs text-slate-200">
                            {author.name} • {formatNumber(author.commit_count)} commits
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

interface CommitsCardProps {
    commits: Array<{ oid: string; message: string; author: string; file_count: number }>;
    repoUrlConfig?: RepoUrlConfig;
}

function CommitsCard({ commits, repoUrlConfig }: CommitsCardProps) {
    return (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-xs text-slate-500 mb-2">Top Commits</div>
            {commits.length === 0 ? (
                <div className="text-xs text-slate-400">No commit data</div>
            ) : (
                <div className="space-y-1">
                    {commits.slice(0, 5).map((commit) => (
                        <div key={commit.oid} className="flex items-center gap-1 text-xs text-slate-200">
                            <span className="truncate">
                                {getFileName(commit.message || 'Commit')} • {commit.file_count} files
                            </span>
                            {repoUrlConfig && (
                                <a data-testid="clusterinsights-link-link-1"
                                    href={buildCommitUrl(repoUrlConfig, commit.oid)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-slate-500 hover:text-sky-400 flex-shrink-0"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

interface HotFilesCardProps {
    hotFiles: Array<{ path: string; churn: number }>;
    repoUrlConfig?: RepoUrlConfig;
    onFileSelect?: (path: string) => void;
}

function HotFilesCard({ hotFiles, repoUrlConfig, onFileSelect }: HotFilesCardProps) {
    return (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-xs text-slate-500 mb-2">Hot Files</div>
            {hotFiles.length === 0 ? (
                <div className="text-xs text-slate-400">No churn data</div>
            ) : (
                <div className="space-y-1">
                    {hotFiles.slice(0, 5).map((file) => (
                        <div key={file.path} className="flex items-center gap-1 text-xs text-slate-200">
                            <span className="truncate flex-1">
                                {getFileName(file.path)} • {formatNumber(file.churn)} churn
                            </span>
                            {onFileSelect && (
                                <button data-testid="clusterinsights-btn-btn-1"
                                    onClick={() => onFileSelect(file.path)}
                                    className="text-slate-500 hover:text-sky-400 flex-shrink-0"
                                    title="View file details"
                                >
                                    <FileSearch className="w-3 h-3" />
                                </button>
                            )}
                            {repoUrlConfig && (
                                <a data-testid="clusterinsights-link-open-in-repository"
                                    href={buildFileUrl(repoUrlConfig, file.path)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-slate-500 hover:text-sky-400 flex-shrink-0"
                                    title="Open in repository"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default ClusterInsights;
