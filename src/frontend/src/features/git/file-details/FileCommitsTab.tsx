/**
 * FileCommitsTab Component
 * 
 * Commit history browser with search and filtering.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getFileCommits, type FileCommitsResponse, type FileCommit } from '../../../api/git';
import { Spinner } from '@/shared';
import { TimelineChart } from '@/shared/charts';
import type { TimeSeriesPoint } from '@/shared/charts';
import { Search, ExternalLink, GitCommit, X, Calendar, User } from 'lucide-react';

interface FileCommitsTabProps {
    repoId: string;
    filePath: string;
    gitWebUrl?: string;
    gitProvider?: string;
}

// Common bot patterns
const BOT_PATTERNS = [
    /\[bot\]$/i,
    /bot$/i,
    /^dependabot/i,
    /^renovate/i,
    /^github-actions/i,
    /^semantic-release/i,
    /^greenkeeper/i,
];

function isBot(author: string): boolean {
    return BOT_PATTERNS.some(pattern => pattern.test(author));
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

// Commit detail modal
function CommitDetailModal({
    commit,
    gitWebUrl,
    gitProvider,
    onClose
}: {
    commit: FileCommit;
    gitWebUrl?: string;
    gitProvider?: string;
    onClose: () => void;
}) {
    const commitUrl = buildCommitUrl(gitWebUrl, gitProvider, commit.oid);

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-5 max-w-lg w-full" onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-4 mb-4">
                    <h3 className="text-sm font-semibold text-slate-200">Commit Details</h3>
                    <button data-testid="file-commits-btn-btn-1" onClick={onClose} className="p-1 text-slate-500 hover:text-slate-300">
                        <X size={16} />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Commit hash */}
                    <div className="flex items-center gap-2">
                        <GitCommit size={14} className="text-slate-500" />
                        <code className="text-sm text-sky-400 font-mono">{commit.oid}</code>
                        {commitUrl && (
                            <a data-testid="file-commits-link-link-1"
                                href={commitUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 text-slate-500 hover:text-sky-400"
                            >
                                <ExternalLink size={12} />
                            </a>
                        )}
                    </div>

                    {/* Message */}
                    <div className="bg-slate-800/50 rounded-lg p-3">
                        <p className="text-sm text-slate-200 whitespace-pre-wrap">{commit.message || 'No message'}</p>
                    </div>

                    {/* Author and date */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <User size={14} className="text-slate-500" />
                            <span className="text-slate-400">Author:</span>
                            <span className="text-slate-200">{commit.author}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-slate-500" />
                            <span className="text-slate-400">Date:</span>
                            <span className="text-slate-200">
                                {commit.date ? new Date(commit.date).toLocaleString() : 'Unknown'}
                            </span>
                        </div>
                    </div>

                    {/* Changes */}
                    <div className="flex items-center gap-4 pt-3 border-t border-slate-700">
                        <span className="text-sm text-slate-400">Changes:</span>
                        <span className="text-sm text-emerald-400">+{commit.lines_added} additions</span>
                        <span className="text-sm text-red-400">-{commit.lines_deleted} deletions</span>
                    </div>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                    {commitUrl && (
                        <a data-testid="file-commits-link-link-2"
                            href={commitUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 text-sm bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 rounded-lg transition-colors"
                        >
                            View in Repository
                        </a>
                    )}
                    <button data-testid="file-commits-btn-btn-2"
                        onClick={onClose}
                        className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

// Commit item component
function CommitItem({
    commit,
    gitWebUrl,
    gitProvider,
    onShowDetail
}: {
    commit: FileCommit;
    gitWebUrl?: string;
    gitProvider?: string;
    onShowDetail: () => void;
}) {
    const commitUrl = buildCommitUrl(gitWebUrl, gitProvider, commit.oid);
    const shortOid = commit.oid.slice(0, 7);
    const botCommit = isBot(commit.author);

    return (
        <div
            className="p-3 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group cursor-pointer"
            onClick={onShowDetail}
        >
            <div className="flex items-start gap-3">
                <div className={`p-1.5 rounded ${botCommit ? 'bg-purple-900/50 text-purple-400' : 'bg-slate-800 text-slate-500'}`}>
                    <GitCommit size={14} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-slate-200 line-clamp-2">{commit.message || 'No message'}</p>
                        {commitUrl && (
                            <a data-testid="file-commits-link-link-3"
                                href={commitUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="p-1 text-slate-600 hover:text-sky-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                            >
                                <ExternalLink size={14} />
                            </a>
                        )}
                    </div>

                    <div className="flex items-center gap-3 mt-1.5 text-xs">
                        <span className="font-mono text-slate-500">{shortOid}</span>
                        <span className={`${botCommit ? 'text-purple-400' : 'text-slate-500'}`}>
                            @{commit.author}
                            {botCommit && <span className="ml-1 text-[10px] bg-purple-500/20 px-1 rounded">bot</span>}
                        </span>
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
    const [excludeBots, setExcludeBots] = useState(false);
    const [selectedCommit, setSelectedCommit] = useState<FileCommit | null>(null);
    const [offset, setOffset] = useState(0);
    const [densityRange, setDensityRange] = useState<[Date, Date] | undefined>(undefined);
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

    useEffect(() => {
        setDensityRange(undefined);
    }, [repoId, filePath, search, excludeMerges, excludeBots]);

    // Debounced search
    const [searchInput, setSearchInput] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchInput);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // Filter out bots if needed
    const filteredCommits = data?.commits.filter(c => !excludeBots || !isBot(c.author)) || [];
    const hasMore = data && filteredCommits.length < data.total_count;

    // Commit density timeline data
    const commitDensityData: TimeSeriesPoint[] = useMemo(() => {
        if (!filteredCommits.length) return [];
        // Group commits by date
        const dateMap = new Map<string, number>();
        filteredCommits.forEach(c => {
            if (c.date) {
                const day = c.date.split('T')[0];
                dateMap.set(day, (dateMap.get(day) || 0) + 1);
            }
        });
        return Array.from(dateMap.entries())
            .map(([date, value]) => ({ date, value }))
            .sort((a, b) => (a.date as string).localeCompare(b.date as string));
    }, [filteredCommits]);

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
                        <input data-testid="file-commits-input-input-1"
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search commits..."
                            className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4 mt-2">
                    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                        <input data-testid="file-commits-input-input-2"
                            type="checkbox"
                            checked={excludeMerges}
                            onChange={(e) => setExcludeMerges(e.target.checked)}
                            className="rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-sky-500"
                        />
                        Exclude merges
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                        <input data-testid="file-commits-input-input-3"
                            type="checkbox"
                            checked={excludeBots}
                            onChange={(e) => setExcludeBots(e.target.checked)}
                            className="rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500"
                        />
                        Exclude bots
                    </label>
                </div>

                {data && (
                    <div className="mt-2 text-xs text-slate-500">
                        Showing {filteredCommits.length} of {data.total_count} commits
                        {excludeBots && data.commits.length !== filteredCommits.length && (
                            <span className="ml-1 text-purple-400">
                                ({data.commits.length - filteredCommits.length} bot commits hidden)
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Commit density timeline */}
            {commitDensityData.length > 0 && (
                <div className="p-3 border-b border-slate-800 flex-shrink-0">
                    <div className="text-xs text-slate-500 mb-1">Commit Density</div>
                    <TimelineChart
                        data={commitDensityData}
                        chartType="bar"
                        xDomain={densityRange}
                        height={60}
                        brushEnabled={true}
                        zoomEnabled={true}
                        onRangeChange={setDensityRange}
                        colorScheme={['#0ea5e9']}
                    />
                </div>
            )}

            {/* Commit list */}
            <div className="flex-1 overflow-auto">
                {filteredCommits.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        <GitCommit size={32} className="mx-auto mb-3 opacity-50" />
                        <p>No commits found</p>
                        {search && (
                            <p className="text-xs mt-1">Try a different search term</p>
                        )}
                        {excludeBots && (
                            <p className="text-xs mt-1">Try disabling "Exclude bots"</p>
                        )}
                    </div>
                ) : (
                    <>
                        {filteredCommits.map((commit) => (
                            <CommitItem
                                key={commit.oid}
                                commit={commit}
                                gitWebUrl={gitWebUrl}
                                gitProvider={gitProvider}
                                onShowDetail={() => setSelectedCommit(commit)}
                            />
                        ))}

                        {hasMore && (
                            <div className="p-4 text-center">
                                <button data-testid="file-commits-btn-btn-3"
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

            {/* Commit detail modal */}
            {selectedCommit && (
                <CommitDetailModal
                    commit={selectedCommit}
                    gitWebUrl={gitWebUrl}
                    gitProvider={gitProvider}
                    onClose={() => setSelectedCommit(null)}
                />
            )}
        </div>
    );
}

export default FileCommitsTab;
