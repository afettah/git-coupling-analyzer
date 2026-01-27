import { useState, useEffect } from 'react';
import {
    getClusteringAlgorithms,
    runClustering,
    getFolders,
    saveClusteringSnapshot,
    getClusteringSnapshots,
    getClusteringSnapshot,
    compareClusteringSnapshots,
    type ClusterResult,
    type ComparisonResult
} from '../api';
import AlgorithmInfoModal from './AlgorithmInfoModal';
import {
    Info, Save, Download, History, FileDown,
    ChevronDown, ChevronUp, Flame, GitCommit, Users, Activity,
    ArrowRight, GitMerge, PlusCircle, MinusCircle, AlertCircle
} from 'lucide-react';

interface ClusteringViewProps {
    repoId: string;
}

interface AlgorithmInfo {
    name: string;
    params_schema: {
        properties: Record<string, { type: string; default?: any; description?: string }>;
    };
}

interface SnapshotInfo {
    id: string;
    name: string;
    algorithm: string;
    created_at: string;
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
    const [infoModalOpen, setInfoModalOpen] = useState(false);

    const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
    const [snapshotsVisible, setSnapshotsVisible] = useState(false);
    const [snapshotName, setSnapshotName] = useState('');
    const [expandedClusterId, setExpandedClusterId] = useState<number | null>(null);

    const [compareMode, setCompareMode] = useState(false);
    const [baseSnapshotId, setBaseSnapshotId] = useState<string | null>(null);
    const [headSnapshotId, setHeadSnapshotId] = useState<string | null>(null);
    const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
    const [compareLoading, setCompareLoading] = useState(false);

    useEffect(() => {
        loadAlgorithms();
        loadFolders();
        loadSnapshots();
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

    const loadSnapshots = async () => {
        try {
            const data = await getClusteringSnapshots(repoId);
            setSnapshots(data);
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

    const handleSaveSnapshot = async () => {
        if (!results || !snapshotName) return;
        try {
            await saveClusteringSnapshot(repoId, snapshotName, results);
            setSnapshotName('');
            loadSnapshots();
        } catch (e) {
            console.error(e);
        }
    };

    const handleLoadSnapshot = async (id: string) => {
        setLoading(true);
        try {
            const data = await getClusteringSnapshot(repoId, id);
            setResults(data.result);
            setSelectedAlgo(data.result.algorithm);
            // Optionally update other params if stored in snapshot result
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setSnapshotsVisible(false);
        }
    };

    const handleCompare = async () => {
        if (!baseSnapshotId || !headSnapshotId) return;
        setCompareLoading(true);
        try {
            const data = await compareClusteringSnapshots(repoId, baseSnapshotId, headSnapshotId);
            setComparisonResult(data);
        } catch (e) {
            console.error(e);
        } finally {
            setCompareLoading(false);
        }
    };

    const exportToCSV = (cluster?: any) => {
        if (!results) return;

        let csvContent = "data:text/csv;charset=utf-8,";

        if (cluster) {
            csvContent += "path\n" + cluster.files.join("\n");
        } else {
            csvContent += "cluster_id,path\n";
            results.clusters.forEach(c => {
                c.files.forEach(f => {
                    csvContent += `${c.id},"${f}"\n`;
                });
            });
        }

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", cluster ? `cluster_${cluster.id}.csv` : "all_clusters.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const selectedSchema = algorithms.find(a => a.name === selectedAlgo)?.params_schema;

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-sky-400">Clustering Analysis</h2>
                    <div className="relative">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    setCompareMode(!compareMode);
                                    setComparisonResult(null);
                                }}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm ${compareMode ? 'bg-sky-500 text-slate-900 border-sky-500' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-800'
                                    }`}
                            >
                                <GitMerge className="w-4 h-4" />
                                Compare
                            </button>
                            <button
                                onClick={() => setSnapshotsVisible(!snapshotsVisible)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors"
                            >
                                <History className="w-4 h-4" />
                                Snapshots
                            </button>
                        </div>

                        {snapshotsVisible && (
                            <div className="absolute right-0 mt-2 w-64 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-20 overflow-hidden">
                                <div className="p-2 border-b border-slate-800 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Recent Snapshots
                                </div>
                                <div className="max-h-64 overflow-y-auto">
                                    {snapshots.length === 0 ? (
                                        <div className="p-4 text-center text-sm text-slate-500">No snapshots yet</div>
                                    ) : (
                                        snapshots.map(s => (
                                            <button
                                                key={s.id}
                                                onClick={() => handleLoadSnapshot(s.id)}
                                                className="w-full text-left p-3 hover:bg-slate-900 border-b border-slate-900/50 last:border-0"
                                            >
                                                <div className="text-sm text-white font-medium truncate">{s.name}</div>
                                                <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
                                                    <span>{s.algorithm}</span>
                                                    <span>{new Date(s.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
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

            {compareMode && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <GitMerge className="w-5 h-5 text-sky-400" />
                        Compare Snapshot History
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Base Snapshot</label>
                            <select
                                value={baseSnapshotId || ''}
                                onChange={(e) => setBaseSnapshotId(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white"
                            >
                                <option value="">Select Base...</option>
                                {snapshots.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({new Date(s.created_at).toLocaleDateString()})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Target Snapshot (Head)</label>
                            <select
                                value={headSnapshotId || ''}
                                onChange={(e) => setHeadSnapshotId(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white"
                            >
                                <option value="">Select Target...</option>
                                {snapshots.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({new Date(s.created_at).toLocaleDateString()})</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <button
                        onClick={handleCompare}
                        disabled={!baseSnapshotId || !headSnapshotId || compareLoading}
                        className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 text-slate-900 font-bold rounded-xl transition-all"
                    >
                        {compareLoading ? 'Comparing...' : 'Compare Snapshots'}
                    </button>

                    {comparisonResult && (
                        <div className="mt-8">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
                                    <div className="text-2xl font-bold text-emerald-400">{comparisonResult.summary.stable}</div>
                                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Stable</div>
                                </div>
                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
                                    <div className="text-2xl font-bold text-amber-400">{comparisonResult.summary.drifted}</div>
                                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Drifted</div>
                                </div>
                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
                                    <div className="text-2xl font-bold text-rose-400">{comparisonResult.summary.dissolved}</div>
                                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Dissolved</div>
                                </div>
                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
                                    <div className="text-2xl font-bold text-sky-400">{comparisonResult.summary.new}</div>
                                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">New</div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {comparisonResult.comparisons.map((c, i) => (
                                    <div key={i} className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            {c.status === 'stable' && <AlertCircle className="w-4 h-4 text-emerald-500" />}
                                            {c.status === 'drifted' && <Activity className="w-4 h-4 text-amber-500" />}
                                            {c.status === 'dissolved' && <MinusCircle className="w-4 h-4 text-rose-500" />}
                                            {c.status === 'new' && <PlusCircle className="w-4 h-4 text-sky-500" />}

                                            <div className="flex items-center gap-2">
                                                {c.old_id !== null ? (
                                                    <span className="text-slate-400 font-mono text-sm">Cluster {c.old_id}</span>
                                                ) : (
                                                    <span className="text-slate-600 font-mono text-sm">-</span>
                                                )}
                                                <ArrowRight className="w-3 h-3 text-slate-600" />
                                                {c.new_id !== null ? (
                                                    <span className="text-white font-mono text-sm">Cluster {c.new_id}</span>
                                                ) : (
                                                    <span className="text-slate-600 font-mono text-sm">-</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {c.overlap_ratio !== undefined && (
                                                <div className="text-[10px] text-slate-500 uppercase font-bold">
                                                    Overlap: {(c.overlap_ratio * 100).toFixed(0)}%
                                                </div>
                                            )}
                                            {c.size_diff !== undefined && (
                                                <div className={`text-[10px] font-bold ${c.size_diff > 0 ? 'text-emerald-500' : c.size_diff < 0 ? 'text-rose-500' : 'text-slate-500'}`}>
                                                    {c.size_diff > 0 ? '+' : ''}{c.size_diff} files
                                                </div>
                                            )}
                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${c.status === 'stable' ? 'bg-emerald-500/10 text-emerald-500' :
                                                c.status === 'drifted' ? 'bg-amber-500/10 text-amber-500' :
                                                    c.status === 'dissolved' ? 'bg-rose-500/10 text-rose-500' :
                                                        'bg-sky-500/10 text-sky-500'
                                                }`}>
                                                {c.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {comparisonResult?.flows && comparisonResult.flows.length > 0 && (
                        <div className="mt-8 bg-slate-950 p-6 rounded-xl border border-slate-800 overflow-x-auto">
                            <h4 className="text-sm font-bold text-slate-400 mb-6 uppercase tracking-wider">Flow Visualization</h4>
                            <div className="min-w-[600px] h-[400px] relative">
                                <svg width="100%" height="100%" viewBox="0 0 800 400" preserveAspectRatio="none">
                                    <defs>
                                        <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#64748b" stopOpacity="0.2" />
                                            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.4" />
                                        </linearGradient>
                                    </defs>
                                    {/* Render flows here - Simplified version */}
                                    {(() => {
                                        // Simple layout calculation
                                        const oldNodes = comparisonResult.nodes.old.sort((a, b) => b.size - a.size);
                                        const newNodes = comparisonResult.nodes.new.sort((a, b) => b.size - a.size);

                                        const height = 400;
                                        const width = 800;
                                        const padding = 20;
                                        const nodeWidth = 20;

                                        // Calculate Y positions
                                        const oldTotal = oldNodes.reduce((sum, n) => sum + n.size, 0);
                                        const newTotal = newNodes.reduce((sum, n) => sum + n.size, 0);
                                        const maxTotal = Math.max(oldTotal, newTotal);

                                        const oldScale = (height - padding * 2) / maxTotal;
                                        const newScale = (height - padding * 2) / maxTotal;

                                        let currentY = padding;
                                        const oldNodePos = new Map<number, { y: number, height: number }>();

                                        const oldNodeEls = oldNodes.map((node) => {
                                            const nodeH = Math.max(2, node.size * oldScale); // Min height 2px
                                            const y = currentY;
                                            oldNodePos.set(node.id, { y, height: nodeH });
                                            currentY += nodeH + 5; // 5px gap
                                            return (
                                                <g key={`old-${node.id}`}>
                                                    <rect x={0} y={y} width={nodeWidth} height={nodeH} fill="#64748b" rx={2} />
                                                    <text x={nodeWidth + 5} y={y + nodeH / 2} fill="#94a3b8" fontSize="10" dominantBaseline="middle">
                                                        #{node.id} ({node.size})
                                                    </text>
                                                </g>
                                            );
                                        });

                                        currentY = padding;
                                        const newNodePos = new Map<number, { y: number, height: number }>();

                                        const newNodeEls = newNodes.map((node) => {
                                            const nodeH = Math.max(2, node.size * newScale);
                                            const y = currentY;
                                            newNodePos.set(node.id, { y, height: nodeH });
                                            currentY += nodeH + 5;
                                            return (
                                                <g key={`new-${node.id}`}>
                                                    <rect x={width - nodeWidth} y={y} width={nodeWidth} height={nodeH} fill="#38bdf8" rx={2} />
                                                    <text x={width - nodeWidth - 5} y={y + nodeH / 2} fill="#38bdf8" fontSize="10" textAnchor="end" dominantBaseline="middle">
                                                        #{node.id} ({node.size})
                                                    </text>
                                                </g>
                                            );
                                        });

                                        // Render Links
                                        const links = comparisonResult.flows.map((flow, i) => {
                                            const src = oldNodePos.get(flow.source);
                                            const dst = newNodePos.get(flow.target);

                                            if (!src || !dst) return null;

                                            // Ideally we'd calculate sub-offsets based on order, but center-to-center is okay for MVP
                                            const srcY = src.y + (src.height * 0.5);
                                            const dstY = dst.y + (dst.height * 0.5);

                                            // Thickness proportional to flow magnitude
                                            const flowHeight = Math.max(1, flow.value * oldScale);

                                            return (
                                                <path
                                                    key={i}
                                                    d={`M ${nodeWidth} ${srcY} C ${width * 0.4} ${srcY}, ${width * 0.6} ${dstY}, ${width - nodeWidth} ${dstY}`}
                                                    stroke="url(#flowGradient)"
                                                    strokeWidth={flowHeight}
                                                    fill="none"
                                                    className="hover:stroke-sky-400 hover:stroke-opacity-100 transition-all opacity-50"
                                                >
                                                    <title>{flow.value} files moved from Cluster {flow.source} to {flow.target}</title>
                                                </path>
                                            )
                                        });

                                        return (
                                            <>
                                                {links}
                                                <g>{oldNodeEls}</g>
                                                <g>{newNodeEls}</g>
                                            </>
                                        );
                                    })()}
                                </svg>
                                <div className="flex justify-between text-xs text-slate-500 font-bold uppercase mt-2 px-2">
                                    <span>Base Snapshot</span>
                                    <span>Target Snapshot</span>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            )}

            {results && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-4">
                            <h3 className="text-lg font-bold text-white">
                                {results.cluster_count} Clusters Found
                            </h3>
                            {results.metrics.modularity !== undefined && (
                                <span className="text-sm text-slate-400">
                                    Modularity: {results.metrics.modularity.toFixed(3)}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => exportToCSV()}
                            className="flex items-center gap-2 text-xs font-bold text-sky-400 hover:text-sky-300 transition-colors"
                        >
                            <Download className="w-3.5 h-3.5" />
                            EXPORT ALL (CSV)
                        </button>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4 flex gap-4 items-center">
                        <div className="flex-1">
                            <input
                                type="text"
                                placeholder="Snapshot name..."
                                value={snapshotName}
                                onChange={(e) => setSnapshotName(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                            />
                        </div>
                        <button
                            onClick={handleSaveSnapshot}
                            disabled={!snapshotName}
                            className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 text-slate-900 text-sm font-bold rounded-lg transition-all"
                        >
                            <Save className="w-4 h-4" />
                            Save Snapshot
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {results.clusters.map((cluster) => (
                            <div key={cluster.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 group transition-all hover:border-slate-700">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <div className="text-sky-400 font-bold text-lg">Cluster {cluster.id}</div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-400 font-medium">
                                                    {cluster.size} files
                                                </span>
                                                {cluster.total_churn !== undefined && (
                                                    <span className="flex items-center gap-1 text-xs text-slate-500">
                                                        <Activity className="w-3 h-3" />
                                                        {cluster.total_churn} commits
                                                    </span>
                                                )}
                                                {cluster.avg_coupling !== undefined && cluster.avg_coupling > 0 && (
                                                    <span className="flex items-center gap-1 text-xs text-slate-500">
                                                        <GitMerge className="w-3 h-3" />
                                                        {(cluster.avg_coupling * 100).toFixed(1)}% coupling
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => exportToCSV(cluster)}
                                            className="p-2 text-slate-500 hover:text-sky-400 hover:bg-slate-800 rounded-lg transition-all"
                                            title="Export cluster to CSV"
                                        >
                                            <FileDown className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setExpandedClusterId(expandedClusterId === cluster.id ? null : cluster.id)}
                                            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
                                        >
                                            {expandedClusterId === cluster.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                {expandedClusterId === cluster.id && (
                                    <div className="mt-6 border-t border-slate-800 pt-6 animate-in slide-in-from-top-2 duration-200">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                            {/* Hot Files */}
                                            <div>
                                                <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider mb-3">
                                                    <Flame className="w-3.5 h-3.5" />
                                                    Hot Files (Top Churn)
                                                </div>
                                                <div className="space-y-2">
                                                    {cluster.hot_files?.map((f, i) => (
                                                        <div key={i} className="text-[11px] bg-slate-950 p-2 rounded border border-slate-800/50">
                                                            <div className="text-slate-300 truncate font-mono mb-1" title={f.path}>{f.path.split('/').pop()}</div>
                                                            <div className="text-slate-500 flex justify-between">
                                                                <span>{f.path.substring(0, f.path.lastIndexOf('/'))}</span>
                                                                <span className="text-rose-500 font-bold">{f.churn}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Top Commits */}
                                            <div>
                                                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-3">
                                                    <GitCommit className="w-3.5 h-3.5" />
                                                    Top Impact Commits
                                                </div>
                                                <div className="space-y-2">
                                                    {cluster.top_commits?.map((c, i) => (
                                                        <div key={i} className="text-[11px] bg-slate-950 p-2 rounded border border-slate-800/50">
                                                            <div className="text-slate-300 truncate font-medium mb-1">{c.message}</div>
                                                            <div className="text-slate-500 flex justify-between italic">
                                                                <span>{c.author}</span>
                                                                <span className="text-amber-500 font-bold">+{c.file_count} files</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Common Authors */}
                                            <div>
                                                <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase tracking-wider mb-3">
                                                    <Users className="w-3.5 h-3.5" />
                                                    Key Contributors
                                                </div>
                                                <div className="space-y-2">
                                                    {cluster.common_authors?.map((a, i) => (
                                                        <div key={i} className="text-[11px] bg-slate-950 p-2 rounded border border-slate-800/50">
                                                            <div className="text-slate-300 font-medium mb-1">{a.name}</div>
                                                            <div className="text-slate-500 flex justify-between">
                                                                <span className="truncate max-w-[120px]">{a.email}</span>
                                                                <span className="text-sky-500 font-bold">{a.commit_count} commits</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-8">
                                            <div className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-3">All Files in Cluster</div>
                                            <div className="bg-slate-950 rounded-xl p-4 max-h-64 overflow-y-auto border border-slate-800">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                                                    {cluster.files.map((f, j) => (
                                                        <div key={j} className="text-[10px] text-slate-400 truncate font-mono hover:text-white transition-colors py-0.5 border-b border-slate-900/50 last:border-0">{f}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {!expandedClusterId && (
                                    <div className="mt-3 flex gap-2 overflow-hidden items-center">
                                        {cluster.files.slice(0, 5).map((f, j) => (
                                            <div key={j} className="text-[10px] text-slate-500 truncate font-mono px-2 py-0.5 bg-slate-950 rounded border border-slate-800/30">{f.split('/').pop()}</div>
                                        ))}
                                        {cluster.size > 5 && <span className="text-[10px] text-slate-600">+{cluster.size - 5} others</span>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <AlgorithmInfoModal
                isOpen={infoModalOpen}
                onClose={() => setInfoModalOpen(false)}
            />
        </div>
    );
}
