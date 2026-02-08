/**
 * Analysis Dashboard
 * 
 * Main dashboard component with multiple views, navigation, and global features.
 * Includes new views: Dashboard, Hotspots, Time Machine, and Settings.
 */

import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { type RepoInfo } from '../../api/repos';
import { type AnalysisStatus, type GitRemoteInfo, getAnalysisStatus, startAnalysis, getGitInfo } from '../../api/git';
import { useFilters } from '../../shared/filters/useFilters';
import {
    ArrowLeft, Play, Loader2, GitCommit,
    AlertTriangle, Filter, Keyboard, Command, ChevronDown, ChevronRight
} from 'lucide-react';
import * as Icons from 'lucide-react';

// Common Config
import { NAVIGATION_TABS } from '../../config/navigation';

// Views
import ImpactGraph from '../git/ImpactGraph';
import ClusteringView from '../git/ClusteringView';
import FilesPage from '../git/FilesPage';
import FileDetailsPanel from '../git/FileDetailsPanel';
import FolderDetailsPanel from '../git/FolderDetailsPanel';
import ProjectDashboard from './ProjectDashboard';
import HotspotsView from '../git/HotspotsView';
import TimeMachineView from '../git/TimeMachineView';
import SettingsView from '../settings/SettingsView';
import DepsLayout from '../deps/DepsLayout';
import SemanticLayout from '../semantic/SemanticLayout';
import KnowledgeGraph from '../graph/KnowledgeGraph';
import RiskLayout from '../risk/RiskLayout';

// UI Components
import GlobalFiltersPanel from '../../shared/GlobalFiltersPanel';
import KeyboardShortcutsModal, { useGlobalKeyboardShortcuts } from '../../shared/KeyboardShortcutsModal';
import CommandPalette from '../../shared/CommandPalette';
import { Breadcrumbs, useBreadcrumbs } from '../../shared/Breadcrumbs';

interface DetailsSelection {
    path: string;
    type: 'file' | 'folder';
}

interface AnalysisDashboardProps {
    repo: RepoInfo;
    onBack: () => void;
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export default function AnalysisDashboard({ repo, onBack, activeTab, onTabChange }: AnalysisDashboardProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const { isFiltering, activeFilterCount } = useFilters();

    // Derived state for sub-tabs
    // If activeTab is 'git', we might be in 'git/coupling', 'git/files', etc.
    // The parent passes 'git' or 'dashboard' as the main tab. But we need to handle sub-navigation.
    // Actually, App.tsx passes the *main* tab (e.g. 'git'). The sub-tab logic needs to be handled here or inside the components.
    // Let's assume onTabChange handles full paths if needed, but App.tsx says: onTabChange={(newTab) => navigate(`/repos/${repoId}/${newTab}`)}

    // We need to parse strict active state for sub-menus
    const currentPath = location.pathname.split(`/repos/${repo.id}/`)[1] || 'dashboard';
    const [mainTabId, subTabId] = currentPath.split('/');

    const [status, setStatus] = useState<AnalysisStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [detailsSelection, setDetailsSelection] = useState<DetailsSelection | null>(null);
    const [gitInfo, setGitInfo] = useState<GitRemoteInfo | null>(null);

    // UI State
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const sidebarCollapsed = false;
    const [expandedTabs, setExpandedTabs] = useState<Record<string, boolean>>({ git: true });

    const breadcrumbs = useBreadcrumbs(repo.name, repo.id);

    // Global keyboard shortcuts
    useGlobalKeyboardShortcuts({
        onNavigate: (path) => onTabChange(path as string),
        onToggleFilters: () => setIsFiltersOpen(prev => !prev),
        onToggleShortcuts: () => setIsShortcutsOpen(prev => !prev),
        onSearch: () => setIsCommandPaletteOpen(true),
        onRefresh: () => fetchStatus(),
    });

    // Extract file/folder path from URL pathname for detail panels
    useEffect(() => {
        const pathMatch = location.pathname.match(/\/repos\/[^/]+\/(file-details|folder-details)\/(.+)/);
        if (pathMatch) {
            const type = pathMatch[1] === 'file-details' ? 'file' : 'folder';
            const filePath = decodeURIComponent(pathMatch[2]);
            setDetailsSelection({ path: filePath, type });
        } else if (!location.pathname.includes('/file-details/') && !location.pathname.includes('/folder-details/')) {
            setDetailsSelection(null);
        }
    }, [location.pathname]);

    const handleOpenDetails = useCallback((path: string, type: 'file' | 'folder') => {
        const tab = type === 'file' ? 'file-details' : 'folder-details';
        navigate(`/repos/${repo.id}/${tab}/${encodeURIComponent(path)}`);
    }, [navigate, repo.id]);

    const handleCloseDetails = useCallback(() => {
        setDetailsSelection(null);
        navigate(`/repos/${repo.id}/git/files`);
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

    const isComplete = status?.state === 'completed';
    const isRunning = status?.state === 'running';
    const isFailed = status?.state === 'failed';

    const toggleTabExpanded = (tabId: string) => {
        setExpandedTabs(prev => ({ ...prev, [tabId]: !prev[tabId] }));
    };

    // Render content based on active tab
    const renderContent = () => {
        // Show "Ready to analyze" or "Failed" screens only for analysis-dependent tabs
        // Dashboard and settings should always be accessible
        const requiresAnalysis = mainTabId !== 'dashboard' && mainTabId !== 'settings';

        // Handle "not run" state
        if (isFailed && requiresAnalysis) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center text-center p-8">
                    <div className="bg-red-500/10 p-6 rounded-2xl text-red-400 mb-6 border border-red-500/20">
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
                        className="px-8 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-all shadow-xl shadow-red-500/20 text-lg"
                    >
                        {loading ? 'Starting...' : 'Retry Analysis'}
                    </button>
                </div>
            );
        }

        if (!isComplete && !isRunning && requiresAnalysis) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center text-center p-8 bg-gradient-to-br from-slate-950 to-slate-900">
                    <div className="bg-sky-500/10 p-8 rounded-full text-sky-400 mb-8 blur-sm animate-pulse absolute" />
                    <div className="bg-sky-500/10 p-6 rounded-2xl text-sky-400 mb-6 relative z-10 border border-sky-500/20 shadow-lg shadow-sky-500/10">
                        <GitCommit size={64} />
                    </div>
                    <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">Ready to analyze</h2>
                    <p className="text-slate-400 max-w-md mx-auto mb-8 text-lg">
                        Start the analysis to build the dependency graph and uncover hidden coupling.
                    </p>
                    <button
                        onClick={handleStartAnalysis}
                        className="px-8 py-4 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-sky-500/25 hover:-translate-y-1 hover:shadow-xl hover:shadow-sky-500/30 text-lg flex items-center gap-3"
                    >
                        <Play fill="currentColor" size={20} />
                        Analyze Project Now
                    </button>
                </div>
            );
        }

        // --- Custom logic for "file-details" and "folder-details" tabs acting as overlays or full views ---
        if (activeTab === 'file-details') {
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
        }
        if (activeTab === 'folder-details') {
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
        }

        // --- Main Tab Routing ---
        switch (mainTabId) {
            case 'dashboard':
                return <ProjectDashboard repo={repo} />;

            case 'git':
                // Sub-tabs for Git
                switch (subTabId) {
                    case 'coupling':
                        return <ImpactGraph repoId={repo.id} />;
                    case 'files':
                        return (
                            <FilesPage
                                repoId={repo.id}
                                onOpenDetails={handleOpenDetails}
                                gitWebUrl={gitInfo?.git_web_url ?? undefined}
                                gitProvider={gitInfo?.git_provider ?? undefined}
                                defaultBranch={gitInfo?.git_default_branch}
                            />
                        );
                    case 'hotspots':
                        return <HotspotsView repoId={repo.id} />;
                    case 'clustering':
                        return <ClusteringView repoId={repo.id} />;
                    case 'time-machine':
                        return <TimeMachineView repoId={repo.id} />;
                    default:
                        // Default to coupling if no subtab
                        return <ImpactGraph repoId={repo.id} />;
                }

            case 'deps':
                return <DepsLayout repoId={repo.id} />;
            case 'semantic':
                return <SemanticLayout repoId={repo.id} />;
            case 'graph':
                return <KnowledgeGraph repoId={repo.id} />;
            case 'risk':
                return <RiskLayout repoId={repo.id} />;
            case 'settings':
                return <SettingsView repo={repo} />;
            default:
                return <ProjectDashboard repo={repo} />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 flex font-sans">
            {/* Sidebar */}
            <aside className={`fixed top-0 left-0 h-screen border-r border-slate-800 bg-slate-900/80 backdrop-blur-md flex flex-col z-20 transition-all duration-300 ${sidebarCollapsed ? 'w-20' : 'w-72'}`}>
                {/* Header */}
                <div className="p-5 border-b border-slate-800/50 flex items-center justify-between">
                    {!sidebarCollapsed && (
                        <div className="overflow-hidden">
                            <button
                                onClick={onBack}
                                className="flex items-center gap-2 text-slate-400 hover:text-sky-400 transition-colors mb-2 text-xs uppercase tracking-wider font-semibold"
                            >
                                <ArrowLeft size={14} />
                                Projects
                            </button>
                            <h2 className="text-xl font-bold truncate bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">{repo.name}</h2>
                        </div>
                    )}
                    {sidebarCollapsed && (
                        <button onClick={onBack} className="mx-auto text-slate-400 hover:text-sky-400">
                            <ArrowLeft size={20} />
                        </button>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                    {NAVIGATION_TABS.map((tab) => {
                        // Dynamic icon loading
                        const Icon = (Icons as any)[tab.icon] || Icons.HelpCircle;
                        const isActive = mainTabId === tab.id;
                        const hasSubTabs = tab.subTabs && tab.subTabs.length > 0;
                        const isExpanded = expandedTabs[tab.id];
                        // Dashboard and settings are always accessible
                        const requiresAnalysis = tab.id !== 'dashboard' && tab.id !== 'settings';
                        const isDisabled = !isComplete && requiresAnalysis;

                        return (
                            <div key={tab.id}>
                                <div className="relative group">
                                    <button
                                        onClick={() => {
                                            if (hasSubTabs) {
                                                toggleTabExpanded(tab.id);
                                                // Navigate to first subtab if clicking main tab
                                                if (!isActive) {
                                                    onTabChange(`${tab.id}/${tab.subTabs[0].id}`);
                                                }
                                            } else {
                                                onTabChange(tab.id);
                                            }
                                        }}
                                        disabled={isDisabled}
                                        title={sidebarCollapsed ? tab.label : undefined}
                                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-medium ${isActive
                                            ? 'bg-gradient-to-r from-sky-500/20 to-indigo-500/20 text-sky-400 border border-sky-500/20 shadow-lg shadow-sky-500/5'
                                            : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 hover:translate-x-1'
                                            } ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Icon size={20} className={isActive ? 'text-sky-400' : 'text-slate-500 group-hover:text-slate-300'} />
                                            {!sidebarCollapsed && <span>{tab.label}</span>}
                                        </div>
                                        {hasSubTabs && !sidebarCollapsed && (
                                            <div className="text-slate-600 transform transition-transform duration-200">
                                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            </div>
                                        )}
                                    </button>
                                </div>

                                {/* Sub-tabs */}
                                {hasSubTabs && isExpanded && !sidebarCollapsed && (
                                    <div className="ml-10 mt-1 space-y-1 border-l-2 border-slate-800 pl-2">
                                        {tab.subTabs.map((sub) => {
                                            const isSubActive = isActive && subTabId === sub.id;
                                            return (
                                                <button
                                                    key={sub.id}
                                                    onClick={() => onTabChange(`${tab.id}/${sub.id}`)}
                                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${isSubActive
                                                        ? 'text-sky-400 bg-sky-500/10 font-medium'
                                                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'
                                                        }`}
                                                >
                                                    {sub.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>

                {/* Analysis Status & Footer */}
                <div className="p-4 bg-slate-950/30 border-t border-slate-800 backdrop-blur-sm">
                    {/* Collapsed Toggle for sidebar could go here if implemented, or user resizing */}

                    {isRunning ? (
                        <div className="space-y-3 p-3 bg-indigo-900/10 rounded-xl border border-indigo-500/20">
                            <div className="flex justify-between text-[10px] font-bold uppercase text-indigo-400 animate-pulse">
                                <span>{status?.stage || 'Processing'}</span>
                                <span>{Math.round((status?.progress || 0) * 100)}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all duration-500"
                                    style={{ width: `${(status?.progress || 0) * 100}%` }}
                                />
                            </div>
                            {!sidebarCollapsed && (
                                <p className="text-[10px] text-slate-500 text-center font-mono">
                                    {status?.processed_commits} / {status?.total_commits ?? '?'} commits
                                </p>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={handleStartAnalysis}
                            disabled={loading || isRunning}
                            className={`w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-sky-900/20 ${sidebarCollapsed ? 'px-0' : 'px-4'}`}
                            title="Re-analyze"
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
                            {!sidebarCollapsed && (isComplete ? 'Re-analyze' : 'Start Analysis')}
                        </button>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'ml-20' : 'ml-72'} relative`}>
                {/* Top Bar with Breadcrumbs & Actions */}
                {isComplete && (
                    <div className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-sm border-b border-slate-800 px-6 py-3 flex items-center justify-between">
                        <Breadcrumbs items={breadcrumbs} />

                        <div className="flex items-center gap-2">
                            {/* Command Palette Trigger */}
                            <button onClick={() => setIsCommandPaletteOpen(true)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700" title="Search (Cmd+K)">
                                <Command size={18} />
                            </button>

                            {/* Filter Trigger */}
                            <button
                                onClick={() => setIsFiltersOpen(true)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all border ${isFiltering
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-amber-500/10 shadow-lg'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border-transparent hover:border-slate-700'
                                    }`}
                            >
                                <Filter size={16} />
                                {activeFilterCount > 0 && (
                                    <span className="bg-amber-500/20 px-1.5 rounded text-xs font-bold">{activeFilterCount}</span>
                                )}
                            </button>

                            <button onClick={() => setIsShortcutsOpen(true)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700" title="Shortcuts (?)">
                                <Keyboard size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Content Area */}
                <div className="h-[calc(100vh-60px)] overflow-hidden flex flex-col">
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
