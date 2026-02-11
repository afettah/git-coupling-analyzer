import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import type { RepoInfo } from '../../../api/repos';
import ClusteringHub from './ClusteringHub';
import SnapshotDetail from './SnapshotDetail';
import ClusteringView from '../ClusteringView';

interface ClusteringWorkspaceProps {
    repo: RepoInfo;
    onBack: () => void;
}

export default function ClusteringWorkspace({ repo, onBack }: ClusteringWorkspaceProps) {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50">
            <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div>
                        <button data-testid="clustering-workspace-btn-btn-1"
                            onClick={onBack}
                            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                        >
                            ← Back to Analysis
                        </button>
                        <h1 className="text-2xl font-bold text-sky-400 mt-1">Clustering</h1>
                        <p className="text-xs text-slate-500">{repo.name}</p>
                    </div>
                    <button data-testid="clustering-workspace-btn-btn-2"
                        onClick={() => navigate(`/repos/${repo.id}/clustering/new`)}
                        className="px-4 py-2 bg-sky-500 text-slate-900 font-semibold rounded-lg hover:bg-sky-400 transition-colors"
                    >
                        Run New Analysis
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-6">
                <Routes>
                    <Route index element={<ClusteringHub repoId={repo.id} />} />
                    <Route path="new" element={<ClusteringView repoId={repo.id} />} />
                    <Route path=":snapshotId/*" element={<SnapshotDetail repoId={repo.id} />} />
                    <Route path="*" element={<Navigate to="." replace />} />
                </Routes>
            </main>
        </div>
    );
}
