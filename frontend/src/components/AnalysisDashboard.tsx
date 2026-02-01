import { useState, useEffect } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { type RepoInfo, type AnalysisStatus, type GitRemoteInfo, getAnalysisStatus, startAnalysis, getGitInfo } from '../api';
import { ArrowLeft, Play, BarChart3, Network, Box, Settings2, Loader2, GitCommit, AlertTriangle } from 'lucide-react';
import ImpactGraph from './ImpactGraph';
import ClusteringView from './ClusteringView';
import FolderTree from './FolderTree';
import FileDetailsPanel from './FileDetailsPanel';
import FolderDetailsPanel from './FolderDetailsPanel';

interface DetailsSelection {
    path: string;
    type: 'file' | 'folder';
}

type TabType = 'graph' | 'tree' | 'clustering' | 'settings' | 'file-details' | 'folder-details';

interface AnalysisDashboardProps {
    repo: RepoInfo;
    onBack: () => void;
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
}

export default function AnalysisDashboard({ repo, onBack, activeTab, onTabChange }: AnalysisDashboardProps) {
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [status, setStatus] = useState<AnalysisStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [detailsSelection, setDetailsSelection] = useState<DetailsSelection | null>(null);
    const [gitInfo, setGitInfo] = useState<GitRemoteInfo | null>(null);

    // Extract file/folder path from URL pathname (e.g., /repos/openhands/file-details/src/app.py)
    useEffect(() => {
        const pathMatch = location.pathname.match(/\/repos\/[^/]+\/(file-details|folder-details)\/(.+)/);
        if (pathMatch) {
            const type = pathMatch[1] === 'file-details' ? 'file' : 'folder';
            const filePath = decodeURIComponent(pathMatch[2]);
            setDetailsSelection({ path: filePath, type });
        } else if (activeTab !== 'file-details' && activeTab !== 'folder-details') {
            // Clear selection when navigating away from details tabs
            setDetailsSelection(null);
        }
    }, [location.pathname, activeTab]);

    // Also handle ?file= query param for backwards compatibility (e.g., from clustering view)
    useEffect(() => {
        const fileParam = searchParams.get('file');
        if (fileParam && !detailsSelection) {
            // Redirect to proper URL format
            navigate(`/repos/${repo.id}/file-details/${encodeURIComponent(fileParam)}`, { replace: true });
        }
    }, [searchParams, detailsSelection, repo.id, navigate]);

    const handleOpenDetails = (path: string, type: 'file' | 'folder') => {
        const tab = type === 'file' ? 'file-details' : 'folder-details';
        // Navigate to URL with file/folder path
        navigate(`/repos/${repo.id}/${tab}/${encodeURIComponent(path)}`);
    };

    const handleCloseDetails = () => {
        setDetailsSelection(null);
        navigate(`/repos/${repo.id}/tree`);
    };

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

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50">
            {/* Sidebar - fixed position */}
            <aside className="fixed top-0 left-0 w-64 h-screen border-r border-slate-800 bg-slate-900 flex flex-col z-10">
                <div className="p-6 border-b border-slate-800">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-slate-400 hover:text-slate-100 transition-colors mb-4"
                    >
                        <ArrowLeft size={16} />
                        <span className="text-sm font-medium">Projects</span>
                    </button>
                    <h2 className="text-xl font-bold truncate text-sky-400">{repo.name}</h2>
                    <p className="text-[10px] font-mono text-slate-500 mt-1 truncate">{repo.path}</p>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <TabButton
                        active={activeTab === 'graph'}
                        onClick={() => onTabChange('graph')}
                        icon={<Network size={18} />}
                        label="Impact Graph"
                        disabled={!isComplete}
                    />
                    <TabButton
                        active={activeTab === 'tree'}
                        onClick={() => onTabChange('tree')}
                        icon={<BarChart3 size={18} />}
                        label="Folder Tree"
                        disabled={!isComplete}
                    />
                    <TabButton
                        active={activeTab === 'clustering'}
                        onClick={() => onTabChange('clustering')}
                        icon={<Box size={18} />}
                        label="Clustering"
                        disabled={!isComplete}
                    />
                    <TabButton
                        active={activeTab === 'settings'}
                        onClick={() => onTabChange('settings')}
                        icon={<Settings2 size={18} />}
                        label="Analysis Options"
                    />
                </nav>

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
                            <p className="text-[10px] text-slate-500 text-center">
                                {status?.processed_commits} / {status?.total_commits} commits
                            </p>
                        </div>
                    ) : (
                        <button
                            onClick={handleStartAnalysis}
                            disabled={loading || isRunning}
                            className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 text-slate-900 font-bold py-2 rounded-lg transition-all"
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
                            {isComplete ? 'Re-analyze' : 'Start Analysis'}
                        </button>
                    )}
                </div>
            </aside>

            {/* Main Content - offset by sidebar width */}
            <main className="ml-64 min-h-screen">
                {isFailed ? (
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
                ) : !isComplete && !isRunning ? (
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
                ) : (
                    <div className="min-h-screen">
                        {activeTab === 'graph' && <ImpactGraph repoId={repo.id} />}
                        {activeTab === 'tree' && (
                            <FolderTree
                                repoId={repo.id}
                                onOpenDetails={handleOpenDetails}
                                gitWebUrl={gitInfo?.git_web_url ?? undefined}
                                gitProvider={gitInfo?.git_provider ?? undefined}
                                defaultBranch={gitInfo?.git_default_branch}
                            />
                        )}
                        {activeTab === 'file-details' && detailsSelection?.type === 'file' && (
                            <FileDetailsPanel
                                repoId={repo.id}
                                filePath={detailsSelection.path}
                                onClose={handleCloseDetails}
                                onFileSelect={(path) => {
                                    navigate(`/repos/${repo.id}/file-details/${encodeURIComponent(path)}`);
                                }}
                                gitWebUrl={gitInfo?.git_web_url ?? undefined}
                                gitProvider={gitInfo?.git_provider ?? undefined}
                                defaultBranch={gitInfo?.git_default_branch}
                            />
                        )}
                        {activeTab === 'folder-details' && detailsSelection?.type === 'folder' && (
                            <FolderDetailsPanel
                                repoId={repo.id}
                                folderPath={detailsSelection.path}
                                onClose={handleCloseDetails}
                                onFileSelect={(path) => {
                                    navigate(`/repos/${repo.id}/file-details/${encodeURIComponent(path)}`);
                                }}
                                gitWebUrl={gitInfo?.git_web_url ?? undefined}
                                gitProvider={gitInfo?.git_provider ?? undefined}
                                defaultBranch={gitInfo?.git_default_branch}
                            />
                        )}
                        {activeTab === 'clustering' && <ClusteringView repoId={repo.id} />}
                        {activeTab === 'settings' && <div className="p-8">Settings View (TODO)</div>}
                    </div>
                )}
            </main>
        </div>
    );
}

function TabButton({ active, onClick, icon, label, disabled = false }: any) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${active
                ? 'bg-sky-500/10 text-sky-400'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}
