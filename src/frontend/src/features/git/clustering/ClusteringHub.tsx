import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { compareClusteringSnapshots } from '../../../api/git';
import useSnapshots from './hooks/useSnapshots';
import type { SnapshotSummary } from './types';
import { formatDateShort, formatNumber, formatPercent, relativeTime } from './utils';
import { Search, Star, Trash2, Pencil, GitCompare, Plus } from 'lucide-react';

interface ClusteringHubProps {
    repoId: string;
}

export default function ClusteringHub({ repoId }: ClusteringHubProps) {
    const navigate = useNavigate();
    const { snapshots, loading, rename, remove } = useSnapshots(repoId);
    const [query, setQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [compareResult, setCompareResult] = useState<any>(null);
    const [compareLoading, setCompareLoading] = useState(false);
    const [renameId, setRenameId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

    const filtered = useMemo(() => {
        if (!query.trim()) return snapshots;
        const lower = query.toLowerCase();
        return snapshots.filter((snap) =>
            snap.name.toLowerCase().includes(lower) ||
            snap.algorithm.toLowerCase().includes(lower)
        );
    }, [snapshots, query]);

    const recent = filtered.slice(0, 6);

    const handleSelect = (id: string) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-2)
        );
    };

    const handleCompare = async () => {
        if (selectedIds.length !== 2) return;
        setCompareLoading(true);
        try {
            const data = await compareClusteringSnapshots(repoId, selectedIds[0], selectedIds[1]);
            setCompareResult(data);
        } finally {
            setCompareLoading(false);
        }
    };

    const startRename = (snap: SnapshotSummary) => {
        setRenameId(snap.id);
        setRenameValue(snap.name);
    };

    const commitRename = async () => {
        if (!renameId) return;
        await rename(renameId, renameValue.trim() || 'Untitled Snapshot');
        setRenameId(null);
    };

    return (
        <div className="space-y-10">
            <section className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
                <div className="flex items-center gap-3 w-full lg:max-w-xl">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input data-testid="clustering-hub-input-input-1"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search snapshots..."
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button data-testid="clustering-hub-btn-btn-1"
                        onClick={handleCompare}
                        disabled={selectedIds.length !== 2 || compareLoading}
                        className="px-4 py-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-40 flex items-center gap-2 text-sm"
                    >
                        <GitCompare className="w-4 h-4" />
                        {compareLoading ? 'Comparing…' : 'Compare Selected'}
                    </button>
                    <button data-testid="clustering-hub-btn-btn-2"
                        onClick={() => navigate(`/repos/${repoId}/clustering/new`)}
                        className="px-4 py-2 rounded-lg bg-sky-500 text-slate-900 hover:bg-sky-400 flex items-center gap-2 text-sm font-semibold"
                    >
                        <Plus className="w-4 h-4" />
                        Run New Analysis
                    </button>
                </div>
            </section>

            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-slate-200">Recent Snapshots</h2>
                    <span className="text-xs text-slate-500">{snapshots.length} total</span>
                </div>
                {loading ? (
                    <div className="text-sm text-slate-500">Loading snapshots…</div>
                ) : recent.length === 0 ? (
                    <div className="text-sm text-slate-500">No snapshots yet.</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {recent.map((snap) => (
                            <div
                                key={snap.id}
                                className="border border-slate-800 bg-slate-900/80 rounded-2xl p-4 hover:border-sky-500/60 transition-colors"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    {renameId === snap.id ? (
                                        <input data-testid="clustering-hub-input-input-2"
                                            value={renameValue}
                                            onChange={(e) => setRenameValue(e.target.value)}
                                            onBlur={commitRename}
                                            onKeyDown={(e) => e.key === 'Enter' && commitRename()}
                                            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-sm text-slate-100 w-full"
                                            autoFocus
                                        />
                                    ) : (
                                        <button data-testid="clustering-hub-btn-btn-3"
                                            onClick={() => navigate(`${snap.id}`)}
                                            className="text-left"
                                        >
                                            <div className="text-base font-semibold text-slate-100 truncate">{snap.name}</div>
                                            <div className="text-xs text-slate-500 mt-1">{snap.algorithm}</div>
                                        </button>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <button data-testid="clustering-hub-btn-btn-4"
                                            onClick={() => startRename(snap)}
                                            className="text-slate-500 hover:text-slate-200"
                                            title="Rename"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button data-testid="clustering-hub-btn-btn-5"
                                            onClick={() => remove(snap.id)}
                                            className="text-slate-500 hover:text-rose-400"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 mt-4">
                                    <div className="flex items-center gap-1">
                                        <Star className="w-3 h-3 text-amber-400" />
                                        Avg Coupling: {formatPercent(snap.avg_coupling)}
                                    </div>
                                    <div>Clusters: {formatNumber(snap.cluster_count)}</div>
                                    <div>Files: {formatNumber(snap.file_count)}</div>
                                    <div>{relativeTime(snap.created_at)}</div>
                                </div>
                                <div className="flex items-center justify-between mt-4">
                                    <button data-testid="clustering-hub-btn-btn-6"
                                        onClick={() => navigate(`${snap.id}`)}
                                        className="text-xs text-sky-400 hover:text-sky-300"
                                    >
                                        Open snapshot
                                    </button>
                                    <label className="text-xs text-slate-400 flex items-center gap-2">
                                        <input data-testid="clustering-hub-input-input-3"
                                            type="checkbox"
                                            checked={selectedIds.includes(snap.id)}
                                            onChange={() => handleSelect(snap.id)}
                                            className="accent-sky-500"
                                        />
                                        Compare
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-slate-200">All Snapshots</h2>
                    <span className="text-xs text-slate-500">Sorted by newest</span>
                </div>
                <div className="border border-slate-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-sm text-slate-300">
                        <thead className="bg-slate-900">
                            <tr className="text-xs uppercase text-slate-500">
                                <th className="px-4 py-3 text-left">Name</th>
                                <th className="px-4 py-3 text-left">Algorithm</th>
                                <th className="px-4 py-3 text-left">Clusters</th>
                                <th className="px-4 py-3 text-left">Coupling</th>
                                <th className="px-4 py-3 text-left">Created</th>
                                <th className="px-4 py-3 text-left">Select</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((snap) => (
                                <tr
                                    key={snap.id}
                                    className="border-t border-slate-800 hover:bg-slate-900/70 cursor-pointer"
                                    onClick={() => navigate(`${snap.id}`)}
                                >
                                    <td className="px-4 py-3 text-slate-100 font-medium">{snap.name}</td>
                                    <td className="px-4 py-3">{snap.algorithm}</td>
                                    <td className="px-4 py-3">{formatNumber(snap.cluster_count)}</td>
                                    <td className="px-4 py-3">{formatPercent(snap.avg_coupling)}</td>
                                    <td className="px-4 py-3">{formatDateShort(snap.created_at)}</td>
                                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                        <input data-testid="clustering-hub-input-input-4"
                                            type="checkbox"
                                            checked={selectedIds.includes(snap.id)}
                                            onChange={() => handleSelect(snap.id)}
                                            className="accent-sky-500"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {compareResult && (
                <section className="border border-slate-800 rounded-2xl p-6 bg-slate-900/70">
                    <h3 className="text-lg font-semibold text-slate-100 mb-4">Snapshot Comparison</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                            <div className="text-2xl font-bold text-emerald-400">{compareResult.summary.stable}</div>
                            <div className="text-[10px] uppercase text-slate-500">Stable</div>
                        </div>
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                            <div className="text-2xl font-bold text-amber-400">{compareResult.summary.drifted}</div>
                            <div className="text-[10px] uppercase text-slate-500">Drifted</div>
                        </div>
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                            <div className="text-2xl font-bold text-rose-400">{compareResult.summary.dissolved}</div>
                            <div className="text-[10px] uppercase text-slate-500">Dissolved</div>
                        </div>
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                            <div className="text-2xl font-bold text-sky-400">{compareResult.summary.new}</div>
                            <div className="text-[10px] uppercase text-slate-500">New</div>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
