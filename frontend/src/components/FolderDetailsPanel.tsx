/**
 * FolderDetailsPanel Component
 * 
 * Folder-level statistics and visualizations.
 */

import { useState, useEffect, useCallback } from 'react';
import { X, ExternalLink, Copy, Folder, FileCode, Users, GitBranch, Heart, Flame } from 'lucide-react';
import { getFolderDetails, type FolderDetailsResponse } from '../api';
import { cn } from '@/lib/utils';
import { Spinner } from './shared';

export interface FolderDetailsPanelProps {
    repoId: string;
    folderPath: string;
    onClose: () => void;
    onFileSelect?: (path: string) => void;
    gitWebUrl?: string;
    gitProvider?: 'github' | 'gitlab' | 'azure_devops' | 'bitbucket';
    defaultBranch?: string;
}

type TabId = 'hot-files' | 'activity' | 'coupling';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'hot-files', label: 'Hot Files', icon: <Flame size={14} /> },
    // { id: 'activity', label: 'Activity', icon: <Activity size={14} /> },
    // { id: 'coupling', label: 'Coupling', icon: <Link2 size={14} /> },
];

// Build folder URL
function buildFolderUrl(gitWebUrl: string | undefined, provider: string | undefined, branch: string | undefined, path: string): string | null {
    if (!gitWebUrl) return null;
    const branchName = branch || 'main';

    switch (provider) {
        case 'github':
            return `${gitWebUrl}/tree/${branchName}/${path}`;
        case 'gitlab':
            return `${gitWebUrl}/-/tree/${branchName}/${path}`;
        case 'azure_devops':
            return `${gitWebUrl}?path=/${path}`;
        case 'bitbucket':
            return `${gitWebUrl}/src/${branchName}/${path}`;
        default:
            return `${gitWebUrl}/tree/${branchName}/${path}`;
    }
}

// Stat card component
function StatCard({
    icon,
    label,
    value,
    subValue,
    color = 'text-slate-100'
}: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    subValue?: string;
    color?: string;
}) {
    return (
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                {icon}
                <span className="uppercase font-medium tracking-wide">{label}</span>
            </div>
            <div className={cn('text-xl font-bold', color)}>{value}</div>
            {subValue && (
                <div className="text-xs text-slate-500 mt-0.5">{subValue}</div>
            )}
        </div>
    );
}

// Health score display
function HealthScoreDisplay({ score }: { score: number }) {
    const config = score >= 70
        ? { label: 'Good', color: 'text-emerald-400', bg: 'bg-emerald-500', icon: '🟢' }
        : score >= 40
            ? { label: 'Moderate', color: 'text-amber-400', bg: 'bg-amber-500', icon: '🟡' }
            : { label: 'At Risk', color: 'text-red-400', bg: 'bg-red-500', icon: '🔴' };

    return (
        <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                    className={cn('h-full rounded-full transition-all', config.bg)}
                    style={{ width: `${score}%` }}
                />
            </div>
            <span className={cn('text-sm font-medium', config.color)}>
                {config.icon} {score}/100
            </span>
        </div>
    );
}

// Hot files list
function HotFilesList({
    files,
    onFileSelect
}: {
    files: Array<{ path: string; commits: number }>;
    onFileSelect?: (path: string) => void;
}) {
    const maxCommits = Math.max(1, ...files.map(f => f.commits));

    return (
        <div className="space-y-2">
            {files.map((file, i) => {
                const fileName = file.path.split('/').pop() || file.path;
                const percentage = (file.commits / maxCommits) * 100;

                return (
                    <div
                        key={file.path}
                        className="group flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors"
                        onClick={() => onFileSelect?.(file.path)}
                    >
                        <span className="text-slate-500 text-xs w-5">{i + 1}.</span>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-sky-400">📄</span>
                                <span className="text-slate-300 truncate text-sm" title={file.path}>
                                    {fileName}
                                </span>
                            </div>
                            <div className="mt-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className={cn(
                                        'h-full rounded-full transition-all',
                                        percentage > 66 ? 'bg-red-500' : percentage > 33 ? 'bg-amber-500' : 'bg-emerald-500'
                                    )}
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>
                        </div>
                        <span className="text-xs text-slate-500 tabular-nums">
                            {file.commits} commits
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

export function FolderDetailsPanel({
    repoId,
    folderPath,
    onClose,
    onFileSelect,
    gitWebUrl,
    gitProvider,
    defaultBranch,
}: FolderDetailsPanelProps) {
    const [details, setDetails] = useState<FolderDetailsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabId>('hot-files');
    const [copied, setCopied] = useState(false);

    const folderName = folderPath.split('/').pop() || folderPath || 'Root';
    const folderUrl = buildFolderUrl(gitWebUrl, gitProvider, defaultBranch, folderPath);

    // Load folder details
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const data = await getFolderDetails(repoId, folderPath);
                setDetails(data);
            } catch (e) {
                console.error('Failed to load folder details:', e);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [repoId, folderPath]);

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleCopyPath = useCallback(() => {
        navigator.clipboard.writeText(folderPath);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [folderPath]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-900">
                <Spinner size="lg" />
            </div>
        );
    }

    if (!details) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-900 text-slate-400">
                <div className="text-center">
                    <Folder size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Failed to load folder details</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-slate-900 border-l border-slate-800">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex-shrink-0">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">📁</span>
                            <h2 className="text-lg font-semibold text-slate-100 truncate">{folderName}</h2>
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-1 font-mono">{folderPath || '/'}</p>
                        <p className="text-xs text-slate-600 mt-1">
                            Contains {details.file_count} files in {details.subfolder_count} subfolders
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-4">
                    {folderUrl && (
                        <a
                            href={folderUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 rounded-lg transition-colors"
                        >
                            <ExternalLink size={12} />
                            Browse in Repo
                        </a>
                    )}
                    <button
                        onClick={handleCopyPath}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <Copy size={12} />
                        {copied ? 'Copied!' : 'Copy Path'}
                    </button>
                </div>
            </div>

            {/* Stats cards */}
            <div className="p-4 border-b border-slate-800 flex-shrink-0">
                <div className="grid grid-cols-4 gap-3">
                    <StatCard
                        icon={<FileCode size={12} />}
                        label="Files"
                        value={details.file_count}
                        subValue={`${details.subfolder_count} folders`}
                    />
                    <StatCard
                        icon={<GitBranch size={12} />}
                        label="Commits"
                        value={details.total_commits}
                    />
                    <StatCard
                        icon={<Users size={12} />}
                        label="Authors"
                        value={details.authors_count}
                        subValue={details.top_author ? `Top: @${details.top_author.split(' ')[0]}` : undefined}
                    />
                    <StatCard
                        icon={<Heart size={12} />}
                        label="Health"
                        value={`${details.health_score}/100`}
                        color={details.health_score >= 70 ? 'text-emerald-400' : details.health_score >= 40 ? 'text-amber-400' : 'text-red-400'}
                    />
                </div>

                {/* Health score bar */}
                <div className="mt-4">
                    <HealthScoreDisplay score={details.health_score} />
                </div>
            </div>

            {/* Tab navigation */}
            <div className="flex border-b border-slate-800 px-4 flex-shrink-0">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors',
                            activeTab === tab.id
                                ? 'text-sky-400 border-sky-400'
                                : 'text-slate-500 border-transparent hover:text-slate-300'
                        )}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-auto p-4">
                {activeTab === 'hot-files' && (
                    <div className="space-y-4">
                        <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                                <Flame size={14} className="text-red-400" />
                                Hot Files (Top {details.hot_files.length})
                            </h3>

                            {details.hot_files.length > 0 ? (
                                <HotFilesList
                                    files={details.hot_files}
                                    onFileSelect={onFileSelect}
                                />
                            ) : (
                                <p className="text-sm text-slate-500 text-center py-4">
                                    No files with significant activity
                                </p>
                            )}
                        </div>

                        {/* Summary stats */}
                        <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                            <h3 className="text-sm font-semibold text-slate-300 mb-3">📋 Folder Summary</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Total lines added</span>
                                    <span className="text-emerald-400">+{details.total_lines_added.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Total lines deleted</span>
                                    <span className="text-red-400">-{details.total_lines_deleted.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Net change</span>
                                    <span className={details.total_lines_added - details.total_lines_deleted >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                        {(details.total_lines_added - details.total_lines_deleted >= 0 ? '+' : '')}{(details.total_lines_added - details.total_lines_deleted).toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Avg commits/file</span>
                                    <span className="text-slate-300">
                                        {details.file_count > 0 ? Math.round(details.total_commits / details.file_count) : 0}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default FolderDetailsPanel;
