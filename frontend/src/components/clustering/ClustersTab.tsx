import { useMemo, useState } from 'react';
import ClusterCard from './ClusterCard';
import ClusterModal from './ClusterModal';
import FilterBar from './FilterBar';
import { formatNumber, formatPercent, generateClusterName, calculateClusterRank } from './utils';

interface ClustersTabProps {
    snapshot: any;
}

export default function ClustersTab({ snapshot }: ClustersTabProps) {
    const [viewMode, setViewMode] = useState('cards');
    const [sortBy, setSortBy] = useState('rank'); // Default to smart ranking
    const [sortOrder, setSortOrder] = useState('desc');
    const [depth, setDepth] = useState(3);
    const [search, setSearch] = useState('');
    const clusters = snapshot.clusters || [];
    const maxFiles = Math.max(1, ...clusters.map((c: any) => c.files?.length || c.size || 0));
    const [couplingRange, setCouplingRange] = useState<[number, number]>([0.05, 1]);
    const [directory, setDirectory] = useState('');
    const [lastChangeFilter, setLastChangeFilter] = useState('all');
    const [changeCountRange, setChangeCountRange] = useState<[number, number]>([0, 1000]);
    const [fileRange, setFileRange] = useState<[number, number]>([0, maxFiles]);
    const [minClusterSize, setMinClusterSize] = useState(2); // Default: exclude clusters with 1 file
    const [selectedCluster, setSelectedCluster] = useState<any | null>(null);

    // Add smart names to clusters that don't have a name
    const clustersWithNames = useMemo(() => {
        return clusters.map((cluster: any) => ({
            ...cluster,
            name: cluster.name || generateClusterName(cluster.files || [])
        }));
    }, [clusters]);

    const filtered = useMemo(() => {
        const lower = search.toLowerCase();
        const dirLower = directory.toLowerCase();
        const rows = clustersWithNames.filter((cluster: any) => {
            const name = (cluster.name || `cluster-${cluster.id}`).toLowerCase();
            const files = cluster.files || [];
            const matchQuery = !search || name.includes(lower) || files.some((f: string) => f.toLowerCase().includes(lower));
            const coupling = cluster.avg_coupling ?? 0;
            const fileCount = files.length || cluster.size || 0;

            // Minimum cluster size filter (default: exclude single-file clusters)
            const matchMinSize = fileCount >= minClusterSize;

            const matchDirectory = !directory || files.some((f: string) => f.toLowerCase().includes(dirLower));

            const changeCount = cluster.total_changes || cluster.change_count || 0;
            const matchChangeCount = changeCount >= changeCountRange[0] && changeCount <= changeCountRange[1];

            return (
                matchQuery &&
                matchDirectory &&
                matchChangeCount &&
                matchMinSize &&
                coupling >= couplingRange[0] &&
                coupling <= couplingRange[1] &&
                fileCount >= fileRange[0] &&
                fileCount <= fileRange[1]
            );
        });

        const sorted = [...rows].sort((a, b) => {
            const dir = sortOrder === 'asc' ? 1 : -1;
            const getValue = (cluster: any) => {
                switch (sortBy) {
                    case 'rank':
                        return calculateClusterRank(cluster);
                    case 'files':
                        return cluster.files?.length || cluster.size || 0;
                    case 'folders':
                        return new Set((cluster.files || []).map((f: string) => f.split('/').slice(0, depth).join('/'))).size;
                    case 'churn':
                        return cluster.total_churn || 0;
                    case 'name':
                        return (cluster.name || '').toLowerCase();
                    case 'coupling':
                    default:
                        return cluster.avg_coupling || 0;
                }
            };
            const aVal = getValue(a);
            const bVal = getValue(b);
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return dir * aVal.localeCompare(bVal);
            }
            return dir * ((aVal as number) - (bVal as number));
        });

        return sorted;
    }, [clustersWithNames, search, couplingRange, fileRange, minClusterSize, sortBy, sortOrder, depth, directory, changeCountRange]);

    const exportCluster = (cluster: any) => {
        const rows = ['path'];
        (cluster.files || []).forEach((file: string) => rows.push(file));
        const csv = rows.join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `cluster_${cluster.id}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const exportAll = () => {
        const rows = ['cluster_id,path'];
        clusters.forEach((cluster: any) => {
            (cluster.files || []).forEach((file: string) => {
                rows.push(`${cluster.id},"${file}"`);
            });
        });
        const csv = rows.join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `all_clusters.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    return (
        <div className="space-y-6">
            <FilterBar
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                sortBy={sortBy}
                onSortByChange={setSortBy}
                sortOrder={sortOrder}
                onSortOrderChange={setSortOrder}
                depth={depth}
                onDepthChange={setDepth}
                couplingRange={couplingRange}
                onCouplingRangeChange={setCouplingRange}
                fileRange={fileRange}
                onFileRangeChange={setFileRange}
                search={search}
                onSearchChange={setSearch}
                directory={directory}
                onDirectoryChange={setDirectory}
                lastChangeFilter={lastChangeFilter}
                onLastChangeFilterChange={setLastChangeFilter}
                changeCountRange={changeCountRange}
                onChangeCountRangeChange={setChangeCountRange}
                minClusterSize={minClusterSize}
                onMinClusterSizeChange={setMinClusterSize}
            />

            <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{filtered.length} clusters shown</span>
                <button onClick={exportAll} className="text-sky-400 hover:text-sky-300">Export all CSV</button>
            </div>

            {viewMode === 'table' ? (
                <div className="border border-slate-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-900 text-xs uppercase text-slate-500">
                            <tr>
                                <th className="px-4 py-3 text-left">Cluster</th>
                                <th className="px-4 py-3 text-left">Coupling</th>
                                <th className="px-4 py-3 text-left">Files</th>
                                <th className="px-4 py-3 text-left">Churn</th>
                                <th className="px-4 py-3 text-left">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((cluster: any) => (
                                <tr key={cluster.id} className="border-t border-slate-800">
                                    <td className="px-4 py-3 text-slate-200">{cluster.name || `Cluster ${cluster.id}`}</td>
                                    <td className="px-4 py-3 text-slate-400">{formatPercent(cluster.avg_coupling)}</td>
                                    <td className="px-4 py-3 text-slate-400">{formatNumber(cluster.files?.length || cluster.size || 0)}</td>
                                    <td className="px-4 py-3 text-slate-400">{formatNumber(cluster.total_churn)}</td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => setSelectedCluster(cluster)}
                                            className="text-sky-400 hover:text-sky-300 text-xs"
                                        >
                                            Explore
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {filtered.map((cluster: any) => (
                        <ClusterCard
                            key={cluster.id}
                            cluster={cluster}
                            folderDepth={depth}
                            onExplore={() => setSelectedCluster(cluster)}
                            onExport={() => exportCluster(cluster)}
                        />
                    ))}
                </div>
            )}

            {selectedCluster && (
                <ClusterModal
                    cluster={selectedCluster}
                    onClose={() => setSelectedCluster(null)}
                    onExport={() => exportCluster(selectedCluster)}
                />
            )}
        </div>
    );
}
