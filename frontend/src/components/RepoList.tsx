import type { RepoInfo } from '../api';
import { FolderGit, Clock, ExternalLink } from 'lucide-react';

interface RepoListProps {
    repos: RepoInfo[];
    onSelect: (id: string) => void;
}

export default function RepoList({ repos, onSelect }: RepoListProps) {
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
                    className="group bg-slate-900 border border-slate-800 hover:border-sky-500/50 rounded-2xl p-6 cursor-pointer transition-all hover:shadow-2xl hover:shadow-sky-500/10 hover:-translate-y-1"
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="bg-sky-500/10 p-3 rounded-xl text-sky-400 group-hover:scale-110 transition-transform">
                            <FolderGit size={24} />
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${repo.state === 'complete' ? 'bg-emerald-500/10 text-emerald-400' :
                            repo.state === 'running' ? 'bg-amber-500/10 text-amber-400 animate-pulse' :
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
