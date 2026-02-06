/**
 * Analysis Dashboard
 * 
 * Main dashboard component with multiple views, navigation, and global features.
 * Includes new views: Dashboard, Hotspots, Time Machine, and Settings.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { type RepoInfo, type AnalysisStatus, type GitRemoteInfo, getAnalysisStatus, startAnalysis, getGitInfo } from '../api';
import { useFilters } from '../stores/filterStore';
import {
    ArrowLeft, Play, BarChart3, Network, Box, Settings2, Loader2, GitCommit,
    AlertTriangle, LayoutDashboard, Flame, Clock, Filter, Keyboard, Command
} from 'lucide-react';

// Views
import ImpactGraph from './ImpactGraph';
import ClusteringView from './ClusteringView';
import FolderTree from './FolderTree';
import FileDetailsPanel from './FileDetailsPanel';
import FolderDetailsPanel from './FolderDetailsPanel';
import ProjectDashboard from './ProjectDashboard';
import HotspotsView from './HotspotsView';
import TimeMachineView from './TimeMachineView';
import SettingsView from './SettingsView';

// UI Components
import GlobalFiltersPanel from './GlobalFiltersPanel';
import KeyboardShortcutsModal, { useGlobalKeyboardShortcuts } from './KeyboardShortcutsModal';
import CommandPalette from './CommandPalette';
import { Breadcrumbs, useBreadcrumbs } from './Breadcrumbs';

interface DetailsSelection {
    path: string;
    type: 'file' | 'folder';
}

type TabType = 'dashboard' | 'graph' | 'tree' | 'clustering' | 'hotspots' | 'time-machine' | 'settings' | 'file-details' | 'folder-details';

interface AnalysisDashboardProps {
    repo: RepoInfo;
    onBack: () => void;
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
}

const TABS = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'graph', label: 'Impact Graph', icon: Network },
    { id: 'tree', label: 'Folder Tree', icon: BarChart3 },
    { id: 'clustering', label: 'Clustering', icon: Box },
    { id: 'hotspots', label: 'Hotspots', icon: Flame },
    { id: 'time-machine', label: 'Time Machine', icon: Clock },
    { id: 'settings', label: 'Settings', icon: Settings2 },
] as const;

export default function AnalysisDashboard({ repo, onBack, activeTab, onTabChange }: AnalysisDashboardProps) {
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { isFiltering, activeFilterCount } = useFilters();
    
    const [status, setStatus] = useState<AnalysisStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [detailsSelection, setDetailsSelection] = useState<DetailsSelection | null>(null);
    const [gitInfo, setGitInfo] = useState<GitRemoteInfo | null>(null);
    
    // UI State
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [sidebarCollapsed] = useState(false);

    const breadcrumbs = useBreadcrumbs(repo.name, repo.id);

    // Global keyboard shortcuts
    useGlobalKeyboardShortcuts({
        onNavigate: (path) => onTabChange(path as TabType),
        onToggleFilters: () => setIsFiltersOpen(prev => !prev),
        onToggleShortcuts: () => setIsShortcutsOpen(prev => !prev),
        onSearch: () => setIsCommandPaletteOpen(true),
        onRefresh: () => fetchStatus(),
    });

    // Extract file/folder path from URL pathname
    useEffect(() => {
        const pathMatch = location.pathname.match(/\/repos\/[^/]+\/(file-details|folder-details)\/(.+)/);
        if (pathMatch) {
            const type = pathMatch[1] === 'file-details' ? 'file' : 'folder';
            const filePath = decodeURIComponent(pathMatch[2]);
            setDetailsSelection({ path: filePath, type });
        } else if (activeTab !== 'file-details' && activeTab !== 'folder-details') {
            setDetailsSelection(null);
        }
    }, [location.pathname, activeTab]);

    // Handle ?file= query param for backwards compatibility
    useEffect(() => {
        const fileParam = searchParams.get('file');
        if (fileParam && !detailsSelection) {
            navigate(`/repos/${repo.id}/file-details/${encodeURIComponent(fileParam)}`, { replace: true });
        }
    }, [searchParams, detailsSelection, repo.id, navigate]);

    const handleOpenDetails = useCallback((path: string, type: 'file' | 'folder') => {
        const tab = type === 'file' ? 'file-details' : 'folder-details';
        navigate(`/repos/${repo.id}/${tab}/${encodeURIComponent(path)}`);
    }, [navigate, repo.id]);

    const handleCloseDetails = useCallback(() => {
        setDetailsSelection(null);
        navigate(`/repos/${repo.id}/tree`);
    }, [navigate, repo.id]);

    const fetchStatus = async () => {
        try {
            const data = await getAnalysisStatus(repo.id);
            setStatus(data);
        } catch (e) {
            console.error(e);
        }
    };

    const fetchGitInfo = async () => {
        try {
            const data = await getGitInfo(repo.id);
            setGitInfo(data);
        } catch (e) {
            console.error('Failed to fetch git info:', e);
        }
    };

    useEffect(() => {
        fetchStatus();
        fetchGitInfo();
        const interval = setInterval(fetchStatus, 3000);
        return () => clearInterval(interval);
    }, [repo.id]);

    const handleStartAnalysis = async () => {
        setLoading(true);
        try {
            await startAnalysis(repo.id, {});
            fetchStatus();
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const isComplete = status?.state === 'complete';
    const isRunning = status?.state === 'running';
    const isFailed = status?.state === 'failed';

    // Render content based on analysis state
    const renderContent = () => {
        if (isFailed) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center text-center p-8">
                    <div className="bg-red-500/10 p-6 rounded-2xl text-red-400 mb-6">
                        <AlertTriangle size={64} />
                    </div>
                    <h2 className="text-3xl font-bold mb-4 text-red-400">Analysis Failed</h2>
                    <div className="bg-slate-900 border border-red-500/30 rounded-xl p-4 max-w-2xl mx-auto mb-8">
                        <p className="text-sm text-slate-300 font-mono break-all">
                            {status?.error || 'Unknown error occurred'}
                        </p>
                    </div>
                    <button
                        onClick={handleStartAnalysis}
                        disabled={loading}
                        className="px-8 py-3 bg-sky-500 hover:bg-sky-400 text-slate-900 font-bold rounded-xl transition-all shadow-xl shadow-sky-500/20 text-lg"
                    >
                        {loading ? 'Starting...' : 'Retry Analysis'}
                    </button>
                </div>
            );
        }

        if (!isComplete && !isRunning) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center text-center p-8">
                    <div className="bg-sky-500/10 p-6 rounded-2xl text-sky-400 mb-6">
                        <GitCommit size={64} />
                    </div>
                    <h2 className="text-3xl font-bold mb-4">Ready to analyze</h2>
                    <p className="text-slate-400 max-w-md mx-auto mb-8">
                        Logical Coupling analysis detects files that tend to change together over time.
                        Start the analysis to build the dependency graph.
                    </p>
                    <button
                        onClick={handleStartAnalysis}
                        className="px-8 py-3 bg-sky-500 hover:bg-sky-400 text-slate-900 font-bold rounded-xl transition-all shadow-xl shadow-sky-500/20 text-lg"
                    >
                        Analyze Project Now
                    </button>
                </div>
            );
        }

        // Render active tab content
        switch (activeTab) {
            case 'dashboard':
                return <ProjectDashboard repo={repo} />;
            case 'graph':
                return <ImpactGraph repoId={repo.id} />;
            case 'tree':
                return (
                    <FolderTree
                        repoId={repo.id}
                        onOpenDetails={handleOpenDetails}
                        gitWebUrl={gitInfo?.git_web_url ?? undefined}
                        gitProvider={gitInfo?.git_provider ?? undefined}
                        defaultBranch={gitInfo?.git_default_branch}
                    />
                );
            case 'file-details':
                return detailsSelection?.type === 'file' ? (
                    <FileDetailsPanel
                        repoId={repo.id}
                        filePath={detailsSelection.path}
                        onClose={handleCloseDetails}
                        onFileSelect={(path) => navigate(`/repos/${repo.id}/file-details/${encodeURIComponent(path)}`)}
                        gitWebUrl={gitInfo?.git_web_url ?? undefined}
                        gitProvider={gitInfo?.git_provider ?? undefined}
                        defaultBranch={gitInfo?.git_default_branch}
                    />
                ) : null;
            case 'folder-details':
                return detailsSelection?.type === 'folder' ? (
                    <FolderDetailsPanel
                        repoId={repo.id}
                        folderPath={detailsSelection.path}
                        onClose={handleCloseDetails}
                        onFileSelect={(path) => navigate(`/repos/${repo.id}/file-details/${encodeURIComponent(path)}`)}
                        gitWebUrl={gitInfo?.git_web_url ?? undefined}
                        gitProvider={gitInfo?.git_provider ?? undefined}
                        defaultBranch={gitInfo?.git_default_branch}
                    />
                ) : null;
            case 'clustering':
                return <ClusteringView repoId={repo.id} />;
            case 'hotspots':
                return <HotspotsView repoId={repo.id} />;
            case 'time-machine':
                return <TimeMachineView repoId={repo.id} />;
            case 'settings':
                return <SettingsView repo={repo} />;
            default:
                return <ProjectDashboard repo={repo} />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50">
            {/* Sidebar */}
            <aside className={`fixed top-0 left-0 h-screen border-r border-slate-800 bg-slate-900 flex flex-col z-10 transition-all ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
                {/* Header */}
                <div className="p-4 border-b border-slate-800">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-slate-400 hover:text-slate-100 transition-colors mb-3"
                    >
                        <ArrowLeft size={16} />
                        {!sidebarCollapsed && <span className="text-sm font-medium">Projects</span>}
                    </button>
                    {!sidebarCollapsed && (
                        <>
                            <h2 className="text-lg font-bold truncate text-sky-400">{repo.name}</h2>
                            <p className="text-[10px] font-mono text-slate-500 mt-1 truncate">{repo.path}</p>
                        </>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id || 
                            (tab.id === 'tree' && (activeTab === 'file-details' || activeTab === 'folder-details'));
                        
                        return (
                            <TabButton
                                key={tab.id}
                                active={isActive}
                                onClick={() => onTabChange(tab.id as TabType)}
                                icon={<Icon size={18} />}
                                label={tab.label}
                                disabled={!isComplete && tab.id !== 'settings'}
                                collapsed={sidebarCollapsed}
                            />
                        );
                    })}
                </nav>

                {/* Quick Actions */}
                <div className="p-3 border-t border-slate-800 space-y-2">
                    {/* Filter Toggle */}
                    <button
                        onClick={() => setIsFiltersOpen(true)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${isFiltering
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                            }`}
                    >
                        <Filter size={16} />
                        {!sidebarCollapsed && (
                            <>
                                <span>Filters</span>
                                {activeFilterCount > 0 && (
                                    <span className="ml-auto px-1.5 py-0.5 bg-amber-500/20 rounded text-[10px] font-bold">
                                        {activeFilterCount}
                                    </span>
                                )}
                            </>
                        )}
                    </button>

                    {/* Command Palette */}
                    <button
                        onClick={() => setIsCommandPaletteOpen(true)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                    >
                        <Command size={16} />
                        {!sidebarCollapsed && (
                            <>
                                <span>Search</span>
                                <kbd className="ml-auto px-1.5 py-0.5 bg-slate-800 rounded text-[10px] border border-slate-700">⌘K</kbd>
                            </>
                        )}
                    </button>

                    {/* Keyboard Shortcuts */}
                    <button
                        onClick={() => setIsShortcutsOpen(true)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                    >
                        <Keyboard size={16} />
                        {!sidebarCollapsed && (
                            <>
                                <span>Shortcuts</span>
                                <kbd className="ml-auto px-1.5 py-0.5 bg-slate-800 rounded text-[10px] border border-slate-700">?</kbd>
                            </>
                        )}
                    </button>
                </div>

                {/* Analysis Status */}
                <div className="p-4 bg-slate-950/50 border-t border-slate-800">
                    {isRunning ? (
                        <div className="space-y-3">
                            <div className="flex justify-between text-[10px] font-bold uppercase text-amber-400 animate-pulse">
                                <span>{status?.stage}</span>
                                <span>{Math.round((status?.progress || 0) * 100)}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-amber-500 transition-all duration-500"
                                    style={{ width: `${(status?.progress || 0) * 100}%` }}
                                />
                            </div>
                            {!sidebarCollapsed && (
                                <p className="text-[10px] text-slate-500 text-center">
                                    {status?.processed_commits} / {status?.total_commits} commits
                                </p>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={handleStartAnalysis}
                            disabled={loading || isRunning}
                            className={`w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 text-slate-900 font-bold py-2 rounded-lg transition-all ${sidebarCollapsed ? 'px-2' : 'px-4'}`}
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
                            {!sidebarCollapsed && (isComplete ? 'Re-analyze' : 'Start Analysis')}
                        </button>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className={`min-h-screen transition-all ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
                {/* Top Bar with Breadcrumbs */}
                {isComplete && (
                    <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 px-4 py-2">
                        <Breadcrumbs items={breadcrumbs} />
                    </div>
                )}

                {/* Content */}
                <div className="min-h-screen">
                    {renderContent()}
                </div>
            </main>

            {/* Modals & Overlays */}
            <GlobalFiltersPanel
                isOpen={isFiltersOpen}
                onClose={() => setIsFiltersOpen(false)}
            />

            <KeyboardShortcutsModal
                isOpen={isShortcutsOpen}
                onClose={() => setIsShortcutsOpen(false)}
            />

            <CommandPalette
                isOpen={isCommandPaletteOpen}
                onClose={() => setIsCommandPaletteOpen(false)}
                repoId={repo.id}
            />
        </div>
    );
}

function TabButton({
    active,
    onClick,
    icon,
    label,
    disabled = false,
    collapsed = false,
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    disabled?: boolean;
    collapsed?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={collapsed ? label : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium ${active
                ? 'bg-sky-500/10 text-sky-400'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                } ${disabled ? 'opacity-30 cursor-not-allowed' : ''} ${collapsed ? 'justify-center' : ''}`}
        >
            {icon}
            {!collapsed && <span className="text-sm">{label}</span>}
        </button>
    );
}
