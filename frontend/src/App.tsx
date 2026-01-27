import { useState, useEffect } from 'react';
import { type RepoInfo, getRepos } from './api';
import RepoList from './components/RepoList';
import AnalysisDashboard from './components/AnalysisDashboard';
import CreateRepoModal from './components/CreateRepoModal';
import { Plus } from 'lucide-react';

function App() {
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const selectedRepo = repos.find(r => r.id === selectedRepoId);

  if (selectedRepoId && selectedRepo) {
    return (
      <AnalysisDashboard
        repo={selectedRepo}
        onBack={() => setSelectedRepoId(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans p-8">
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
            onSelect={(id) => setSelectedRepoId(id)}
            onDeleted={(id) => setRepos(repos.filter(r => r.id !== id))}
          />
        )}
      </main>

      {isCreateModalOpen && (
        <CreateRepoModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={(newRepo) => {
            setRepos([...repos, newRepo]);
            setIsCreateModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

export default App;
