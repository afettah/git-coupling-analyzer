import { useState, useEffect } from 'react';
import { getClusteringAlgorithms, runClustering, getFolders, type ClusterResult } from '../api';

interface ClusteringViewProps {
    repoId: string;
}

interface AlgorithmInfo {
    name: string;
    params_schema: {
        properties: Record<string, { type: string; default?: any; description?: string }>;
    };
}

export default function ClusteringView({ repoId }: ClusteringViewProps) {
    const [algorithms, setAlgorithms] = useState<AlgorithmInfo[]>([]);
    const [selectedAlgo, setSelectedAlgo] = useState('louvain');
    const [weightColumn, setWeightColumn] = useState('jaccard');
    const [minWeight, setMinWeight] = useState(0.1);
    const [folders, setFolders] = useState('');
    const [params, setParams] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<ClusterResult | null>(null);
    const [availableFolders, setAvailableFolders] = useState<string[]>([]);

    useEffect(() => {
        loadAlgorithms();
        loadFolders();
    }, [repoId]);

    const loadAlgorithms = async () => {
        try {
            const data = await getClusteringAlgorithms(repoId);
            setAlgorithms(data);
        } catch (e) {
            console.error(e);
        }
    };

    const loadFolders = async () => {
        try {
            const data = await getFolders(repoId, 2);
            setAvailableFolders(data);
        } catch (e) {
            console.error(e);
        }
    };

    const handleRun = async () => {
        setLoading(true);
        setResults(null);
        try {
            const result = await runClustering(repoId, {
                algorithm: selectedAlgo,
                weight_column: weightColumn,
                min_weight: minWeight,
                folders: folders.split(',').map(f => f.trim()).filter(Boolean),
                params
            });
            setResults(result);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const selectedSchema = algorithms.find(a => a.name === selectedAlgo)?.params_schema;

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8">
                <h2 className="text-xl font-bold text-sky-400 mb-6">Clustering Analysis</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Algorithm</label>
                        <select
                            value={selectedAlgo}
                            onChange={(e) => {
                                setSelectedAlgo(e.target.value);
                                setParams({});
                            }}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white"
                        >
                            {algorithms.map(a => (
                                <option key={a.name} value={a.name}>{a.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Weight Metric</label>
                        <select
                            value={weightColumn}
                            onChange={(e) => setWeightColumn(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white"
                        >
                            <option value="jaccard">Jaccard Similarity</option>
                            <option value="jaccard_weighted">Weighted Jaccard</option>
                            <option value="p_dst_given_src">P(B|A)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Min Weight</label>
                        <input
                            type="number"
                            step="0.05"
                            min="0"
                            max="1"
                            value={minWeight}
                            onChange={(e) => setMinWeight(parseFloat(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white"
                        />
                    </div>
                </div>

                {/* Algorithm-specific parameters */}
                {selectedSchema && Object.keys(selectedSchema.properties || {}).length > 0 && (
                    <div className="mb-6">
                        <div className="text-slate-400 text-sm font-medium mb-3">Algorithm Parameters</div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {Object.entries(selectedSchema.properties || {}).map(([key, prop]) => (
                                <div key={key}>
                                    <label className="block text-xs text-slate-500 mb-1">
                                        {key} {prop.description && `- ${prop.description}`}
                                    </label>
                                    <input
                                        type={prop.type === 'number' || prop.type === 'integer' ? 'number' : 'text'}
                                        step={prop.type === 'number' ? '0.1' : undefined}
                                        value={params[key] ?? prop.default ?? ''}
                                        onChange={(e) => setParams({
                                            ...params,
                                            [key]: prop.type === 'number' || prop.type === 'integer'
                                                ? parseFloat(e.target.value)
                                                : e.target.value
                                        })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                        Filter to folders (comma-separated)
                    </label>
                    <input
                        type="text"
                        placeholder="e.g. src/api, src/hooks"
                        value={folders}
                        onChange={(e) => setFolders(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white"
                        list="folder-suggestions"
                    />
                    <datalist id="folder-suggestions">
                        {availableFolders.map(f => <option key={f} value={f} />)}
                    </datalist>
                </div>

                <button
                    onClick={handleRun}
                    disabled={loading}
                    className="w-full py-3 bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 text-slate-900 font-bold rounded-xl transition-all"
                >
                    {loading ? 'Running...' : `Run ${selectedAlgo} Clustering`}
                </button>
            </div>

            {results && (
                <div className="space-y-4">
                    <div className="flex justify-between items-end mb-2">
                        <h3 className="text-lg font-bold text-white">
                            {results.cluster_count} Clusters Found
                        </h3>
                        {results.metrics.modularity !== undefined && (
                            <span className="text-sm text-slate-400">
                                Modularity: {results.metrics.modularity.toFixed(3)}
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {results.clusters.map((cluster) => (
                            <div key={cluster.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-sky-400 font-bold">Cluster {cluster.id}</span>
                                    <span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-400">
                                        {cluster.size} files
                                    </span>
                                </div>
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {cluster.files.slice(0, 10).map((f, j) => (
                                        <div key={j} className="text-xs text-slate-400 truncate font-mono">{f}</div>
                                    ))}
                                    {cluster.size > 10 && (
                                        <div className="text-[10px] text-slate-600">...and {cluster.size - 10} more</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
