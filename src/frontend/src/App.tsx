import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { type RepoInfo, getRepos } from './api/repos';
import AnalysisDashboard from './features/dashboard/AnalysisDashboard';
import { ProjectWizard } from './features/project-wizard';
import RepoList from './features/repos/RepoList';
import ErrorNotification from './shared/ErrorNotification';

function mergeRepos(primary: RepoInfo[], secondary: RepoInfo[]): RepoInfo[] {
  const map = new Map<string, RepoInfo>();
  for (const repo of [...primary, ...secondary]) {
    map.set(repo.id, repo);
  }
  return [...map.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function upsertRepo(list: RepoInfo[], repo: RepoInfo): RepoInfo[] {
  const withoutCurrent = list.filter((item) => item.id !== repo.id);
  return mergeRepos([...withoutCurrent, repo], []);
}

function App() {
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchRepos = async () => {
    try {
      const remoteRepos = await getRepos();
      setRepos(mergeRepos(remoteRepos, []));
    } catch (error) {
      console.error('Failed to fetch repos:', error);
      setRepos([]);
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

        <Route
          path="/repos"
          element={(
            <div className="relative min-h-screen overflow-hidden p-8">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-900/20 via-slate-950 to-slate-950" />
              <header className="relative z-10 mx-auto mb-12 flex max-w-7xl items-center justify-between">
                <div>
                  <h1 className="bg-gradient-to-r from-sky-400 via-indigo-400 to-violet-400 bg-clip-text text-4xl font-bold text-transparent">
                    Code Intelligence Platform
                  </h1>
                  <p className="mt-2 text-lg text-slate-400">Unified analysis for git, dependencies, and semantics</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/wizard/new')}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-lg shadow-sky-500/20 transition-all hover:-translate-y-0.5 hover:from-sky-500 hover:to-indigo-500 hover:shadow-sky-500/30"
                >
                  <Plus size={20} />
                  New Project
                </button>
              </header>

              <main className="relative z-10 mx-auto max-w-7xl">
                {loading ? (
                  <div className="flex justify-center py-20">
                    <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-sky-500" />
                  </div>
                ) : (
                  <RepoList
                    repos={repos}
                    onSelect={(id) => navigate(`/repos/${id}`)}
                    onDeleted={(id) => setRepos((current) => current.filter((repo) => repo.id !== id))}
                  />
                )}
              </main>
            </div>
          )}
        />

        <Route
          path="/wizard/new"
          element={(
            <WizardPage
              title="New Project Wizard"
              onCancel={() => navigate('/repos')}
              onComplete={(repo) => {
                setRepos((current) => upsertRepo(current, repo));
                navigate(`/repos/${repo.id}/dashboard`);
              }}
            />
          )}
        />

        <Route
          path="/repos/:repoId/wizard"
          element={(
            <RepoWizardPage
              repos={repos}
              loading={loading}
              onCancel={(repoId) => navigate(`/repos/${repoId}/dashboard`)}
              onComplete={(repo) => {
                setRepos((current) => upsertRepo(current, repo));
                navigate(`/repos/${repo.id}/dashboard`);
              }}
            />
          )}
        />

        <Route path="/repos/:repoId" element={<Navigate to="dashboard" replace />} />

        <Route path="/repos/:repoId/*" element={<AnalysisDashboardWrapper repos={repos} />} />
      </Routes>

      <ErrorNotification />
    </div>
  );
}

function WizardPage({
  title,
  onCancel,
  onComplete,
}: {
  title: string;
  onCancel: () => void;
  onComplete: (repo: RepoInfo) => void;
}) {
  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="mx-auto mb-6 max-w-7xl">
        <h1 className="text-3xl font-semibold text-slate-100">{title}</h1>
        <p className="mt-1 text-sm text-slate-400">Repository - Scan - Preset - Configure - Review</p>
      </div>
      <ProjectWizard onCancel={onCancel} onComplete={onComplete} />
    </div>
  );
}

function RepoWizardPage({
  repos,
  loading,
  onCancel,
  onComplete,
}: {
  repos: RepoInfo[];
  loading: boolean;
  onCancel: (repoId: string) => void;
  onComplete: (repo: RepoInfo) => void;
}) {
  const { repoId } = useParams<{ repoId: string }>();
  const repo = repoId ? repos.find((item) => item.id === repoId) : undefined;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-sky-500" />
      </div>
    );
  }

  if (!repoId || !repo) {
    return <Navigate to="/repos" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="mx-auto mb-6 max-w-7xl">
        <h1 className="text-3xl font-semibold text-slate-100">New Analysis</h1>
        <p className="mt-1 text-sm text-slate-400">Configure and run analysis for {repo.name}</p>
      </div>
      <ProjectWizard
        initialRepo={repo}
        onCancel={() => onCancel(repo.id)}
        onComplete={onComplete}
      />
    </div>
  );
}

function AnalysisDashboardWrapper({ repos }: { repos: RepoInfo[] }) {
  const { repoId, '*': subPath } = useParams<{ repoId: string; '*': string }>();
  const navigate = useNavigate();
  const repo = repos.find((r) => r.id === repoId);

  const pathParts = subPath?.split('/') || [];
  const mainTab = pathParts[0] || 'dashboard';

  if (!repo) {
    if (repos.length > 0) {
      return <Navigate to="/repos" replace />;
    }
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-sky-500" />
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
