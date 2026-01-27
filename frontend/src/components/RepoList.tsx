import { useState } from 'react';
import type { RepoInfo } from '../api';
import { deleteRepo } from '../api';
import { FolderGit, Clock, ExternalLink, Trash2, AlertCircle, X } from 'lucide-react';

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
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center">
                <FolderGit className="mx-auto text-slate-700 mb-4" size={48} />
                <h3 className="text-xl font-semibold mb-2">No projects found</h3>
                <p className="text-slate-400">Register a repository to start analyzing its coupling history.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {repos.map((repo) => (
                <div
                    key={repo.id}
                    onClick={() => onSelect(repo.id)}
                    className="group bg-slate-900 border border-slate-800 hover:border-sky-500/50 rounded-2xl p-6 cursor-pointer transition-all hover:shadow-2xl hover:shadow-sky-500/10 hover:-translate-y-1 relative"
                >
                    {/* Delete button */}
                    <div className="absolute top-4 right-4">
                        {deleteConfirm === repo.id ? (
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
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
                                    className="px-2 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium transition-colors"
                                >
                                    {deleting ? 'Deleting...' : 'Confirm'}
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={(e) => handleDelete(e, repo.id)}
                                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 bg-slate-800 hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
                                title="Delete project"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>

                    <div className="flex justify-between items-start mb-4">
                        <div className={`p-3 rounded-xl transition-transform group-hover:scale-110 ${
                            repo.state === 'failed' 
                                ? 'bg-red-500/10 text-red-400' 
                                : 'bg-sky-500/10 text-sky-400'
                        }`}>
                            {repo.state === 'failed' ? <AlertCircle size={24} /> : <FolderGit size={24} />}
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                            repo.state === 'complete' ? 'bg-emerald-500/10 text-emerald-400' :
                            repo.state === 'running' ? 'bg-amber-500/10 text-amber-400 animate-pulse' :
                            repo.state === 'failed' ? 'bg-red-500/10 text-red-400' :
                            'bg-slate-800 text-slate-400'
                        }`}>
                            {repo.state.replace('_', ' ')}
                        </span>
                    </div>

                    <h3 className="text-lg font-bold mb-1 text-slate-100 group-hover:text-sky-400 transition-colors">
                        {repo.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono truncate mb-6">
                        {repo.path}
                    </p>

                    <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-800 pt-4">
                        <div className="flex items-center gap-1.5">
                            <Clock size={14} />
                            <span>{repo.last_analyzed ? new Date(repo.last_analyzed).toLocaleDateString() : 'Never'}</span>
                        </div>
                        <div className="flex items-center gap-1 group-hover:text-sky-400 transition-colors">
                            <span>Open</span>
                            <ExternalLink size={14} />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
