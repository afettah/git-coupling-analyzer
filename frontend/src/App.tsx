import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { type RepoInfo, getRepos } from './api';
import RepoList from './components/RepoList';
import AnalysisDashboard from './components/AnalysisDashboard';
import CreateRepoModal from './components/CreateRepoModal';
import ErrorNotification from './components/ErrorNotification';
import ClusteringWorkspace from './components/clustering/ClusteringWorkspace';
import { Plus } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans">
      <Routes>
        <Route path="/" element={<Navigate to="/repos" replace />} />

        <Route path="/repos" element={
          <div className="p-8">
            <header className="max-w-6xl mx-auto flex justify-between items-center mb-12">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
                  LFCA Analyzer
                </h1>
                <p className="text-slate-400 mt-2">Logical File Coupling Analysis</p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-slate-900 font-semibold px-4 py-2 rounded-lg transition-all shadow-lg shadow-sky-500/20"
              >
                <Plus size={20} />
                New Project
              </button>
            </header>

            <main className="max-w-6xl mx-auto">
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

        <Route path="/repos/:repoId" element={<Navigate to="graph" replace />} />
        <Route path="/repos/:repoId/clustering/*" element={<ClusteringWorkspaceWrapper repos={repos} />} />
        <Route path="/repos/:repoId/file-details/*" element={<AnalysisDashboardWrapper repos={repos} />} />
        <Route path="/repos/:repoId/folder-details/*" element={<AnalysisDashboardWrapper repos={repos} />} />
        <Route path="/repos/:repoId/:tab" element={<AnalysisDashboardWrapper repos={repos} />} />
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

type DashboardTab = 'graph' | 'tree' | 'clustering' | 'settings' | 'file-details' | 'folder-details';

function AnalysisDashboardWrapper({ repos }: { repos: RepoInfo[] }) {
  const { repoId, tab, '*': wildcard } = useParams<{ repoId: string; tab: string; '*': string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const repo = repos.find(r => r.id === repoId);

  // Determine active tab - for file-details/* and folder-details/* routes, extract from pathname
  const getActiveTab = (): DashboardTab => {
    const pathname = location.pathname;
    if (pathname.includes('/file-details/') || pathname.match(/\/file-details$/)) {
      return 'file-details';
    }
    if (pathname.includes('/folder-details/') || pathname.match(/\/folder-details$/)) {
      return 'folder-details';
    }
    return (tab as DashboardTab) || 'graph';
  };

  if (!repo) {
    if (repos.length > 0) {
      return <Navigate to="/repos" replace />;
    }
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  return (
    <AnalysisDashboard
      repo={repo}
      onBack={() => navigate('/repos')}
      activeTab={getActiveTab()}
      onTabChange={(newTab: DashboardTab) => navigate(`/repos/${repoId}/${newTab}`)}
    />
  );
}

export default App;

function ClusteringWorkspaceWrapper({ repos }: { repos: RepoInfo[] }) {
  const { repoId } = useParams<{ repoId: string }>();
  const navigate = useNavigate();
  const repo = repos.find(r => r.id === repoId);

  if (!repo) {
    if (repos.length > 0) {
      return <Navigate to="/repos" replace />;
    }
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  return (
    <ClusteringWorkspace
      repo={repo}
      onBack={() => navigate(`/repos/${repo.id}/graph`)}
    />
  );
}
