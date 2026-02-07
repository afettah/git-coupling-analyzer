import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { createRepo } from '../../api/repos';

interface CreateRepoModalProps {
    onClose: () => void;
    onCreated: (repo: any) => void;
}

export default function CreateRepoModal({ onClose, onCreated }: CreateRepoModalProps) {
    const [path, setPath] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const repo = await createRepo({ path, name: name || undefined });
            onCreated(repo);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to create project');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center p-6 border-b border-slate-800">
                    <h2 className="text-xl font-bold">New Project</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">
                            Repository Path
                        </label>
                        <input
                            type="text"
                            required
                            value={path}
                            onChange={(e) => setPath(e.target.value)}
                            placeholder="/home/user/workspace/my-project"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-100 focus:outline-none focus:border-sky-500 transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">
                            Project Name (Optional)
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Auto-computed if empty"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-100 focus:outline-none focus:border-sky-500 transition-colors"
                        />
                    </div>

                    {error && <p className="text-red-400 text-sm">{error}</p>}

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-sky-500 hover:bg-sky-400 disabled:bg-sky-500/50 text-slate-900 font-bold rounded-lg transition-all flex justify-center items-center"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Create Project'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
