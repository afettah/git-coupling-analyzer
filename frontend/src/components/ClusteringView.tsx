import { useState, useEffect } from 'react';
import { startClustering, getClusterStatus, getClusterResults } from '../api';
import { Box, Play, Loader2 } from 'lucide-react';

interface ClusteringViewProps {
    repoId: string;
}

export default function ClusteringView({ repoId }: ClusteringViewProps) {
    const [algorithm, setAlgorithm] = useState('components');
    const [minWeight, setMinWeight] = useState(0.2);
    const [folders, setFolders] = useState('');
    const [loading, setLoading] = useState(false);
    const [runId, setRunId] = useState<string | null>(null);
    const [status, setStatus] = useState<any>(null);
    const [results, setResults] = useState<any>(null);

    const handleStart = async () => {
        setLoading(true);
        setResults(null);
        try {
            const resp = await startClustering(repoId, {
                algorithm,
                min_weight: minWeight,
                folders: folders.split(',').map(f => f.trim()).filter(Boolean),
            });
            setRunId(resp.run_id);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!runId) return;
        const interval = setInterval(async () => {
            const s = await getClusterStatus(repoId, runId);
            setStatus(s);
            if (s.state === 'complete') {
                const r = await getClusterResults(repoId, runId);
                setResults(r);
                clearInterval(interval);
            } else if (s.state === 'failed') {
                clearInterval(interval);
            }
        }, 2000);
        return () => clearInterval(interval);
    }, [runId, repoId]);

    return (
        <div className="p-8 max-w-4xl mx-auto w-full">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8">
                <div className="flex items-center gap-2 text-sky-400 font-bold mb-6">
                    <Box size={24} />
                    <h2 className="text-xl">On-demand Clustering</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Algorithm</label>
                        <select
                            value={algorithm}
                            onChange={(e) => setAlgorithm(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-100 outline-none focus:border-sky-500"
                        >
                            <option value="components">Connected Components</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Minimum Edge Weight</label>
                        <input
                            type="number"
                            step="0.05"
                            min="0"
                            max="1"
                            value={minWeight}
                            onChange={(e) => setMinWeight(parseFloat(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-100 outline-none focus:border-sky-500"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-400 mb-1">Folders (comma separated)</label>
                        <input
                            type="text"
                            placeholder="e.g. src/api, src/hooks"
                            value={folders}
                            onChange={(e) => setFolders(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-100 outline-none focus:border-sky-500"
                        />
                    </div>
                </div>

                <button
                    onClick={handleStart}
                    disabled={loading || (status?.state === 'running')}
                    className="w-full py-3 bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 text-slate-900 font-bold rounded-xl transition-all shadow-lg flex justify-center items-center gap-2"
                >
                    {loading || status?.state === 'running' ? <Loader2 size={20} className="animate-spin" /> : <Play size={20} fill="currentColor" />}
                    Run Clustering Algorithm
                </button>
            </div>

            {status?.state === 'running' && (
                <div className="text-center py-12 animate-pulse text-slate-400">
                    Clustering in progress...
                </div>
            )}

            {results && (
                <div className="space-y-4">
                    <div className="flex justify-between items-end mb-2">
                        <h3 className="text-lg font-bold">Detected Clusters ({results.cluster_count})</h3>
                        <span className="text-xs text-slate-500">Run ID: {runId}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {results.clusters.map((cluster: any, i: number) => (
                            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-sky-400 font-bold text-sm">Cluster {cluster.id}</span>
                                    <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] text-slate-400">{cluster.size} files</span>
                                </div>
                                <div className="space-y-1">
                                    {cluster.files.slice(0, 5).map((f: string, j: number) => (
                                        <div key={j} className="text-xs text-slate-400 truncate font-mono">{f}</div>
                                    ))}
                                    {cluster.size > 5 && <div className="text-[10px] text-slate-600">...and {cluster.size - 5} more</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
