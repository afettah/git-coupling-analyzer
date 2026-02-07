import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { type RepoInfo, getRepos } from './api/repos';
import RepoList from './features/repos/RepoList';
import AnalysisDashboard from './features/dashboard/AnalysisDashboard';
import CreateRepoModal from './features/repos/CreateRepoModal';
import ErrorNotification from './shared/ErrorNotification';
import ClusteringWorkspace from './features/git/ClusteringView'; // Check this path - likely needs adjustment
import { Plus } from 'lucide-react';
import { NAVIGATION_TABS } from './config/navigation';

function App() {
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchRepos = async () => {
    try {
      const data = await getRepos();
      setRepos(data);
    } catch (error) {
      console.error('Failed to fetch repos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepos();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-sky-500/30">
      <Routes>
        <Route path="/" element={<Navigate to="/repos" replace />} />

        <Route path="/repos" element={
          <div className="p-8 min-h-screen relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-900/20 via-slate-950 to-slate-950 pointer-events-none" />
            <header className="max-w-7xl mx-auto flex justify-between items-center mb-12 relative z-10">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-sky-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
                  Code Intelligence Platform
                </h1>
                <p className="text-slate-400 mt-2 text-lg">Unified analysis for git, dependencies, and semantics</p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-sky-500/20 hover:shadow-sky-500/30 hover:-translate-y-0.5"
              >
                <Plus size={20} />
                New Project
              </button>
            </header>

            <main className="max-w-7xl mx-auto relative z-10">
              {loading ? (
                <div className="flex justify-center py-20">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
                </div>
              ) : (
                <RepoList
                  repos={repos}
                  onSelect={(id) => navigate(`/repos/${id}`)}
                  onDeleted={(id) => setRepos(repos.filter(r => r.id !== id))}
                />
              )}
            </main>
          </div>
        } />

        <Route path="/repos/:repoId" element={<Navigate to="dashboard" replace />} />

        {/* Main Dashboard Route - Handles all tabs */}
        <Route path="/repos/:repoId/*" element={<AnalysisDashboardWrapper repos={repos} />} />
      </Routes>

      {isCreateModalOpen && (
        <CreateRepoModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={(newRepo) => {
            setRepos([...repos, newRepo]);
            setIsCreateModalOpen(false);
            navigate(`/repos/${newRepo.id}`);
          }}
        />
      )}
      <ErrorNotification />
    </div>
  );
}

function AnalysisDashboardWrapper({ repos }: { repos: RepoInfo[] }) {
  const { repoId, '*': subPath } = useParams<{ repoId: string; '*': string }>();
  const navigate = useNavigate();
  const repo = repos.find(r => r.id === repoId);

  // Parse active tab from URL
  // /repos/:id/dashboard -> activeTab = 'dashboard'
  // /repos/:id/git/coupling -> activeTab = 'git', subTab = 'coupling'
  const pathParts = subPath?.split('/') || [];
  const mainTab = pathParts[0] || 'dashboard';

  if (!repo) {
    if (repos.length > 0) {
      return <Navigate to="/repos" replace />;
    }
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  return (
    <AnalysisDashboard
      repo={repo}
      onBack={() => navigate('/repos')}
      activeTab={mainTab}
      onTabChange={(newTab) => navigate(`/repos/${repoId}/${newTab}`)}
    />
  );
}

export default App;
