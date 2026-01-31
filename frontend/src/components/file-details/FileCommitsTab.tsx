/**
 * FileCommitsTab Component
 * 
 * Commit history browser with search and filtering.
 */

import { useState, useEffect, useCallback } from 'react';
import { getFileCommits, type FileCommitsResponse, type FileCommit } from '../../api';
import { Spinner } from '../shared';
import { Search, ExternalLink, GitCommit } from 'lucide-react';

interface FileCommitsTabProps {
    repoId: string;
    filePath: string;
    gitWebUrl?: string;
    gitProvider?: string;
}

// Format relative time
function formatRelativeTime(dateStr: string | null): string {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
}

// Build commit URL
function buildCommitUrl(gitWebUrl: string | undefined, provider: string | undefined, sha: string): string | null {
    if (!gitWebUrl) return null;

    switch (provider) {
        case 'github':
            return `${gitWebUrl}/commit/${sha}`;
        case 'gitlab':
            return `${gitWebUrl}/-/commit/${sha}`;
        case 'azure_devops':
            return `${gitWebUrl}/commit/${sha}`;
        case 'bitbucket':
            return `${gitWebUrl}/commits/${sha}`;
        default:
            return `${gitWebUrl}/commit/${sha}`;
    }
}

// Commit item component
function CommitItem({
    commit,
    gitWebUrl,
    gitProvider
}: {
    commit: FileCommit;
    gitWebUrl?: string;
    gitProvider?: string;
}) {
    const commitUrl = buildCommitUrl(gitWebUrl, gitProvider, commit.oid);
    const shortOid = commit.oid.slice(0, 7);

    return (
        <div className="p-3 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group">
            <div className="flex items-start gap-3">
                <div className="p-1.5 bg-slate-800 rounded text-slate-500">
                    <GitCommit size={14} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-slate-200 line-clamp-2">{commit.message || 'No message'}</p>
                        {commitUrl && (
                            <a
                                href={commitUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 text-slate-600 hover:text-sky-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                            >
                                <ExternalLink size={14} />
                            </a>
                        )}
                    </div>

                    <div className="flex items-center gap-3 mt-1.5 text-xs">
                        <span className="font-mono text-slate-500">{shortOid}</span>
                        <span className="text-slate-500">@{commit.author}</span>
                        <span className="text-slate-600">{formatRelativeTime(commit.date)}</span>
                        <span className="flex items-center gap-1">
                            <span className="text-emerald-500">+{commit.lines_added}</span>
                            <span className="text-slate-600">/</span>
                            <span className="text-red-500">-{commit.lines_deleted}</span>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function FileCommitsTab({ repoId, filePath, gitWebUrl, gitProvider }: FileCommitsTabProps) {
    const [data, setData] = useState<FileCommitsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [search, setSearch] = useState('');
    const [excludeMerges, setExcludeMerges] = useState(false);
    const [offset, setOffset] = useState(0);
    const limit = 30;

    const loadCommits = useCallback(async (reset = false) => {
        if (reset) {
            setLoading(true);
            setOffset(0);
        } else {
            setLoadingMore(true);
        }

        try {
            const result = await getFileCommits(repoId, filePath, {
                search: search || undefined,
                exclude_merges: excludeMerges,
                limit,
                offset: reset ? 0 : offset,
            });

            if (reset) {
                setData(result);
            } else {
                setData(prev => prev ? {
                    ...result,
                    commits: [...prev.commits, ...result.commits]
                } : result);
            }
            setOffset(prev => reset ? limit : prev + limit);
        } catch (e) {
            console.error('Failed to load commits:', e);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [repoId, filePath, search, excludeMerges, offset]);

    // Load on mount and when filters change
    useEffect(() => {
        loadCommits(true);
    }, [repoId, filePath, search, excludeMerges]);

    // Debounced search
    const [searchInput, setSearchInput] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchInput);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const hasMore = data && data.commits.length < data.total_count;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Spinner size="md" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Search and filters */}
            <div className="p-3 border-b border-slate-800 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search commits..."
                            className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                        />
                    </div>

                    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={excludeMerges}
                            onChange={(e) => setExcludeMerges(e.target.checked)}
                            className="rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-sky-500"
                        />
                        Exclude merges
                    </label>
                </div>

                {data && (
                    <div className="mt-2 text-xs text-slate-500">
                        Showing {data.commits.length} of {data.total_count} commits
                    </div>
                )}
            </div>

            {/* Commit list */}
            <div className="flex-1 overflow-auto">
                {!data || data.commits.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        <GitCommit size={32} className="mx-auto mb-3 opacity-50" />
                        <p>No commits found</p>
                        {search && (
                            <p className="text-xs mt-1">Try a different search term</p>
                        )}
                    </div>
                ) : (
                    <>
                        {data.commits.map((commit) => (
                            <CommitItem
                                key={commit.oid}
                                commit={commit}
                                gitWebUrl={gitWebUrl}
                                gitProvider={gitProvider}
                            />
                        ))}

                        {hasMore && (
                            <div className="p-4 text-center">
                                <button
                                    onClick={() => loadCommits(false)}
                                    disabled={loadingMore}
                                    className="px-4 py-2 text-sm text-sky-400 hover:text-sky-300 disabled:opacity-50"
                                >
                                    {loadingMore ? 'Loading...' : 'Load more commits'}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default FileCommitsTab;
