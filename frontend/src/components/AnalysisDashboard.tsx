import { useState, useEffect } from 'react';
import { type RepoInfo, type AnalysisStatus, getAnalysisStatus, startAnalysis } from '../api';
import { ArrowLeft, Play, BarChart3, Network, Box, Settings2, Loader2, GitCommit, AlertTriangle } from 'lucide-react';
import ImpactGraph from './ImpactGraph';
import ClusteringView from './ClusteringView';
import FolderTree from './FolderTree';

interface AnalysisDashboardProps {
    repo: RepoInfo;
    onBack: () => void;
    activeTab: 'graph' | 'tree' | 'clustering' | 'settings';
    onTabChange: (tab: 'graph' | 'tree' | 'clustering' | 'settings') => void;
}

export default function AnalysisDashboard({ repo, onBack, activeTab, onTabChange }: AnalysisDashboardProps) {
    const [status, setStatus] = useState<AnalysisStatus | null>(null);
    const [loading, setLoading] = useState(false);

    const fetchStatus = async () => {
        try {
            const data = await getAnalysisStatus(repo.id);
            setStatus(data);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchStatus();
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
        <div className="flex h-screen bg-slate-950 text-slate-50">
            {/* Sidebar */}
            <aside className="w-64 border-r border-slate-800 bg-slate-900 flex flex-col">
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

            {/* Main Content */}
            <main className="flex-1 overflow-auto flex flex-col">
                {isFailed ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
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
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
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
                    <div className="flex-1 flex flex-col">
                        {activeTab === 'graph' && <ImpactGraph repoId={repo.id} />}
                        {activeTab === 'tree' && <FolderTree repoId={repo.id} />}
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
