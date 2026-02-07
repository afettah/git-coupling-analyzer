/**
 * FileDetailsPanel Component
 * 
 * Comprehensive file details panel with tabs for activity, authors, coupling, commits, and insights.
 */

import { useState, useEffect, useCallback } from 'react';
import { X, ExternalLink, GitBranch, Copy, FileCode, Users, Calendar, Link2, Plus, Minus, Activity, AlertTriangle } from 'lucide-react';
import {
    getFileDetails,
    getCoupling,
    type FileDetailsResponse,
    type CoupledFile
} from '../../api/git';
import { cn } from '@/lib/utils';
import { Spinner } from '@/shared';

// Tab components
import { FileActivityTab } from './file-details/FileActivityTab';
import { FileAuthorsTab } from './file-details/FileAuthorsTab';
import { FileCouplingTab } from './file-details/FileCouplingTab';
import { FileCommitsTab } from './file-details/FileCommitsTab';
import { FileInsightsTab } from './file-details/FileInsightsTab';

export interface FileDetailsPanelProps {
    repoId: string;
    filePath: string;
    onClose: () => void;
    onFileSelect?: (path: string) => void;
    gitWebUrl?: string;
    gitProvider?: 'github' | 'gitlab' | 'azure_devops' | 'bitbucket';
    defaultBranch?: string;
}

type TabId = 'activity' | 'authors' | 'coupling' | 'commits' | 'insights';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'activity', label: 'Activity', icon: <Activity size={14} /> },
    { id: 'authors', label: 'Authors', icon: <Users size={14} /> },
    { id: 'coupling', label: 'Coupling', icon: <Link2 size={14} /> },
    { id: 'commits', label: 'Commits', icon: <GitBranch size={14} /> },
    { id: 'insights', label: 'Insights', icon: <AlertTriangle size={14} /> },
];

// Helper to get file extension icon
function getFileIcon(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    const iconMap: Record<string, string> = {
        ts: '📘', tsx: '📘', js: '📒', jsx: '📒',
        py: '🐍', java: '☕', go: '🔷', rs: '🦀',
        css: '🎨', scss: '🎨', html: '🌐', vue: '💚',
        json: '📋', yaml: '📋', yml: '📋', md: '📝',
        sql: '🗃️', sh: '💻', dockerfile: '🐳',
    };
    return iconMap[ext || ''] || '📄';
}

// Helper to calculate file age
function calculateAge(firstCommitDate: string | null): string {
    if (!firstCommitDate) return 'Unknown';
    const date = new Date(firstCommitDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 30) return `${diffDays}d`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo`;
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    if (months > 0) return `${years}y ${months}mo`;
    return `${years}y`;
}

// Build remote URL for file
function buildFileUrl(gitWebUrl: string | undefined, provider: string | undefined, branch: string | undefined, path: string): string | null {
    if (!gitWebUrl) return null;
    const branchName = branch || 'main';

    switch (provider) {
        case 'github':
            return `${gitWebUrl}/blob/${branchName}/${path}`;
        case 'gitlab':
            return `${gitWebUrl}/-/blob/${branchName}/${path}`;
        case 'azure_devops':
            return `${gitWebUrl}?path=/${path}`;
        case 'bitbucket':
            return `${gitWebUrl}/src/${branchName}/${path}`;
        default:
            return `${gitWebUrl}/blob/${branchName}/${path}`;
    }
}

// Build blame URL for file
function buildBlameUrl(gitWebUrl: string | undefined, provider: string | undefined, branch: string | undefined, path: string): string | null {
    if (!gitWebUrl) return null;
    const branchName = branch || 'main';

    switch (provider) {
        case 'github':
            return `${gitWebUrl}/blame/${branchName}/${path}`;
        case 'gitlab':
            return `${gitWebUrl}/-/blame/${branchName}/${path}`;
        default:
            return null;
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

export function FileDetailsPanel({
    repoId,
    filePath,
    onClose,
    onFileSelect,
    gitWebUrl,
    gitProvider,
    defaultBranch,
}: FileDetailsPanelProps) {
    const [details, setDetails] = useState<FileDetailsResponse | null>(null);
    const [coupling, setCoupling] = useState<CoupledFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabId>('activity');
    const [copied, setCopied] = useState(false);

    const fileName = filePath.split('/').pop() || filePath;
    const fileIcon = getFileIcon(filePath);
    const fileUrl = buildFileUrl(gitWebUrl, gitProvider, defaultBranch, filePath);
    const blameUrl = buildBlameUrl(gitWebUrl, gitProvider, defaultBranch, filePath);

    const handleCopyPath = useCallback(() => {
        navigator.clipboard.writeText(filePath);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [filePath]);

    // Load file details
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [detailsData, couplingData] = await Promise.all([
                    getFileDetails(repoId, filePath),
                    getCoupling(repoId, filePath, { limit: 20 })
                ]);
                setDetails(detailsData);
                setCoupling(couplingData);
            } catch (e) {
                console.error('Failed to load file details:', e);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [repoId, filePath]);

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if ((e.metaKey || e.ctrlKey) && e.key === 'c' && !window.getSelection()?.toString()) {
                e.preventDefault();
                handleCopyPath();
            } else if ((e.metaKey || e.ctrlKey) && e.key === 'o' && fileUrl) {
                e.preventDefault();
                window.open(fileUrl, '_blank');
            } else if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
                // Tab to cycle through tabs (only when not in an input)
                const activeElement = document.activeElement;
                if (activeElement?.tagName !== 'INPUT' && activeElement?.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    const currentIndex = TABS.findIndex(t => t.id === activeTab);
                    const nextIndex = (currentIndex + 1) % TABS.length;
                    setActiveTab(TABS[nextIndex].id);
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose, fileUrl, activeTab, handleCopyPath]);

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
                    <FileCode size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Failed to load file details</p>
                </div>
            </div>
        );
    }

    const riskColor = details.risk_score >= 70 ? 'text-red-400' :
        details.risk_score >= 40 ? 'text-amber-400' :
            'text-emerald-400';

    return (
        <div className="h-full flex flex-col bg-slate-900 border-l border-slate-800 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex-shrink-0">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">{fileIcon}</span>
                            <h2 className="text-lg font-semibold text-slate-100 truncate">{fileName}</h2>
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-1 font-mono">{filePath}</p>
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
                    {fileUrl && (
                        <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 rounded-lg transition-colors"
                        >
                            <ExternalLink size={12} />
                            Open in Repo
                        </a>
                    )}
                    {blameUrl && (
                        <a
                            href={blameUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            <GitBranch size={12} />
                            Blame
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
                        icon={<GitBranch size={12} />}
                        label="Commits"
                        value={details.total_commits}
                        subValue={details.commits_last_30_days > 0 ? `+${details.commits_last_30_days} (30d)` : undefined}
                    />
                    <StatCard
                        icon={<Users size={12} />}
                        label="Authors"
                        value={details.authors_count}
                        subValue={details.top_author ? `Top: @${details.top_author.split(' ')[0]}` : undefined}
                    />
                    <StatCard
                        icon={<Calendar size={12} />}
                        label="Age"
                        value={calculateAge(details.first_commit_date)}
                        subValue={details.first_commit_date ? `Since ${new Date(details.first_commit_date).getFullYear()}` : undefined}
                    />
                    <StatCard
                        icon={<Link2 size={12} />}
                        label="Coupling"
                        value={`${details.coupled_files_count} files`}
                        subValue={details.max_coupling > 0 ? `Max: ${Math.round(details.max_coupling * 100)}%` : undefined}
                    />
                </div>
                <div className="grid grid-cols-4 gap-3 mt-3">
                    <StatCard
                        icon={<Plus size={12} />}
                        label="Additions"
                        value={details.total_lines_added.toLocaleString()}
                        color="text-emerald-400"
                    />
                    <StatCard
                        icon={<Minus size={12} />}
                        label="Deletions"
                        value={details.total_lines_deleted.toLocaleString()}
                        color="text-red-400"
                    />
                    <StatCard
                        icon={<Activity size={12} />}
                        label="Churn Rate"
                        value={`${details.churn_rate}/wk`}
                    />
                    <StatCard
                        icon={<AlertTriangle size={12} />}
                        label="Risk Score"
                        value={`${details.risk_score}/100`}
                        color={riskColor}
                    />
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
            <div className="flex-1 overflow-auto">
                {activeTab === 'activity' && (
                    <FileActivityTab repoId={repoId} filePath={filePath} />
                )}
                {activeTab === 'authors' && (
                    <FileAuthorsTab repoId={repoId} filePath={filePath} />
                )}
                {activeTab === 'coupling' && (
                    <FileCouplingTab
                        filePath={filePath}
                        coupling={coupling}
                        onFileSelect={onFileSelect}
                    />
                )}
                {activeTab === 'commits' && (
                    <FileCommitsTab
                        repoId={repoId}
                        filePath={filePath}
                        gitWebUrl={gitWebUrl}
                        gitProvider={gitProvider}
                    />
                )}
                {activeTab === 'insights' && (
                    <FileInsightsTab details={details} coupling={coupling} />
                )}
            </div>
        </div>
    );
}

export default FileDetailsPanel;
