import { useState } from 'react';
import type { RepoInfo } from '../../api/repos';
import { deleteRepo } from '../../api/repos';
import { FolderGit, Clock, ExternalLink, Trash2, AlertCircle, X, ArrowRight } from 'lucide-react';

interface RepoListProps {
    repos: RepoInfo[];
    onSelect: (id: string) => void;
    onDeleted?: (id: string) => void;
}

export default function RepoList({ repos, onSelect, onDeleted }: RepoListProps) {
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async (e: React.MouseEvent, repoId: string) => {
        e.stopPropagation();
        if (deleteConfirm === repoId) {
            setDeleting(true);
            try {
                await deleteRepo(repoId);
                onDeleted?.(repoId);
            } catch (error) {
                console.error('Failed to delete repo:', error);
            } finally {
                setDeleting(false);
                setDeleteConfirm(null);
            }
        } else {
            setDeleteConfirm(repoId);
        }
    };

    const cancelDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleteConfirm(null);
    };

    if (repos.length === 0) {
        return (
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-3xl p-16 text-center shadow-2xl">
                <div className="bg-slate-800/50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <FolderGit className="text-slate-600" size={40} />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-slate-200">No projects yet</h3>
                <p className="text-slate-400 max-w-md mx-auto text-lg">Register a repository to start analyzing its coupling history and dependency structure.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {repos.map((repo) => (
                <div
                    key={repo.id}
                    onClick={() => onSelect(repo.id)}
                    className="group bg-slate-900/40 backdrop-blur-sm border border-slate-800/60 hover:border-sky-500/30 rounded-3xl p-6 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-sky-500/10 hover:-translate-y-2 relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    {/* Delete button */}
                    <div className="absolute top-5 right-5 z-10">
                        {deleteConfirm === repo.id ? (
                            <div className="flex items-center gap-2 bg-slate-950/80 p-1 rounded-xl backdrop-blur-md border border-slate-800" onClick={e => e.stopPropagation()}>
                                <button
                                    onClick={cancelDelete}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
                                    title="Cancel"
                                >
                                    <X size={14} />
                                </button>
                                <button
                                    onClick={(e) => handleDelete(e, repo.id)}
                                    disabled={deleting}
                                    className="px-2 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold transition-colors"
                                >
                                    {deleting ? '...' : 'Confirm'}
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={(e) => handleDelete(e, repo.id)}
                                className="p-2 rounded-xl opacity-0 group-hover:opacity-100 bg-slate-800/50 hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
                                title="Delete project"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>

                    <div className="flex justify-between items-start mb-6 relative">
                        <div className={`p-4 rounded-2xl transition-transform duration-300 group-hover:scale-110 shadow-lg ${repo.state === 'failed'
                                ? 'bg-gradient-to-br from-red-500/20 to-red-600/5 text-red-400 shadow-red-500/10'
                                : 'bg-gradient-to-br from-sky-500/20 to-indigo-600/5 text-sky-400 shadow-sky-500/10'
                            }`}>
                            {repo.state === 'failed' ? <AlertCircle size={28} /> : <FolderGit size={28} />}
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${repo.state === 'complete' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                repo.state === 'running' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse' :
                                    repo.state === 'failed' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                        'bg-slate-800 text-slate-400 border-slate-700'
                            }`}>
                            {repo.state.replace('_', ' ')}
                        </span>
                    </div>

                    <div className="relative">
                        <h3 className="text-xl font-bold mb-2 text-slate-100 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-sky-400 group-hover:to-indigo-400 transition-all">
                            {repo.name}
                        </h3>
                        <p className="text-sm text-slate-500 font-mono truncate mb-6 bg-slate-950/30 p-2 rounded-lg border border-slate-800/50">
                            {repo.path}
                        </p>

                        <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/50 pt-4">
                            <div className="flex items-center gap-1.5">
                                <Clock size={14} />
                                <span>{repo.last_analyzed ? new Date(repo.last_analyzed).toLocaleDateString() : 'Never analyzed'}</span>
                            </div>
                            <div className="flex items-center gap-1 group-hover:text-sky-400 transition-colors font-medium">
                                <span>Open Dashboard</span>
                                <ArrowRight size={14} />
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
