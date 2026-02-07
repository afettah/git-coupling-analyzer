import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getClusteringAlgorithms,
    runClustering,
    getFolders,
    saveClusteringSnapshot,
    type ClusterResult,
} from '../../api/git';
import AlgorithmInfoModal from '../../shared/AlgorithmInfoModal';
import { Info, Activity } from 'lucide-react';

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
    const navigate = useNavigate();
    const [algorithms, setAlgorithms] = useState<AlgorithmInfo[]>([]);
    const [selectedAlgo, setSelectedAlgo] = useState('louvain');
    const [weightColumn, setWeightColumn] = useState('jaccard');
    const [minWeight, setMinWeight] = useState(0.1);
    const [folders, setFolders] = useState('');
    const [params, setParams] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);
    const [_results, setResults] = useState<ClusterResult | null>(null);
    const [availableFolders, setAvailableFolders] = useState<string[]>([]);
    const [infoModalOpen, setInfoModalOpen] = useState(false);
    const [snapshotName, setSnapshotName] = useState('');

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
        let nameToUse = snapshotName.trim();
        if (!nameToUse) {
            const timestamp = new Date().toLocaleString();
            nameToUse = `${selectedAlgo.charAt(0).toUpperCase() + selectedAlgo.slice(1)} Analysis - ${timestamp}`;
        }

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
            // Auto-save the snapshot
            const saved = await saveClusteringSnapshot(repoId, nameToUse, result);
            // Redirect to the new snapshot detail view
            navigate(`/repos/${repoId}/clustering/${saved.id}`);
        } catch (e) {
            console.error(e);
            alert("Failed to run or save clustering analysis");
        } finally {
            setLoading(false);
        }
    };

    const selectedSchema = algorithms.find(a => a.name === selectedAlgo)?.params_schema;

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-sky-400">Clustering Analysis</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-slate-400">Algorithm</label>
                            <button
                                onClick={() => setInfoModalOpen(true)}
                                className="text-slate-500 hover:text-sky-400 transition-colors"
                                title="Learn more about these algorithms"
                            >
                                <Info className="w-4 h-4" />
                            </button>
                        </div>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">
                            Snapshot Name
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Q4 Baseline Analysis"
                            value={snapshotName}
                            onChange={(e) => setSnapshotName(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white"
                        />
                    </div>

                    <div>
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
                </div>

                <button
                    onClick={handleRun}
                    disabled={loading}
                    className="w-full bg-sky-500 hover:bg-sky-400 text-slate-900 font-bold py-3 rounded-xl transition-all shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-900"></div>
                            Running Analysis...
                        </>
                    ) : (
                        <>
                            <Activity className="w-5 h-5" />
                            Run Clustering
                        </>
                    )}
                </button>
            </div>

            <AlgorithmInfoModal
                isOpen={infoModalOpen}
                onClose={() => setInfoModalOpen(false)}
            />
        </div>
    );
}
