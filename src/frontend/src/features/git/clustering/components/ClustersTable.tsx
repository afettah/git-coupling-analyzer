/**
 * Clusters Table Component
 * 
 * Table view for displaying clusters in a compact format.
 */

import type { ClusterData } from '../types';
import { formatNumber, formatPercent } from '../utils';
import { ProgressBar } from '@/shared';

export interface ClustersTableProps {
    clusters: ClusterData[];
    onExplore: (cluster: ClusterData) => void;
}

// Get coupling color based on strength
const getCouplingColor = (coupling: number): 'success' | 'warning' | 'danger' => {
    if (coupling >= 0.8) return 'danger';
    if (coupling >= 0.6) return 'warning';
    return 'success';
};

export function ClustersTable({ clusters, onExplore }: ClustersTableProps) {
    return (
        <div className="border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
                <thead className="bg-slate-900 text-xs uppercase text-slate-500">
                    <tr>
                        <th className="px-4 py-3 text-left">Cluster</th>
                        <th className="px-4 py-3 text-left w-48">Coupling</th>
                        <th className="px-4 py-3 text-left">Files</th>
                        <th className="px-4 py-3 text-left">Churn</th>
                        <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {clusters.map(cluster => (
                        <tr
                            key={cluster.id}
                            className="border-t border-slate-800 hover:bg-slate-900/50 cursor-pointer"
                            onClick={() => onExplore(cluster)}
                        >
                            <td className="px-4 py-3 text-slate-200 font-medium">
                                {cluster.name}
                            </td>
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <ProgressBar
                                        value={(cluster.avg_coupling || 0) * 100}
                                        max={100}
                                        color={getCouplingColor(cluster.avg_coupling || 0)}
                                        size="sm"
                                        className="flex-1"
                                    />
                                    <span className="text-slate-400 text-xs w-10 text-right">
                                        {formatPercent(cluster.avg_coupling)}
                                    </span>
                                </div>
                            </td>
                            <td className="px-4 py-3 text-slate-400">
                                {formatNumber(cluster.files?.length || cluster.size || 0)}
                            </td>
                            <td className="px-4 py-3 text-slate-400">
                                {formatNumber(cluster.total_churn)}
                            </td>
                            <td className="px-4 py-3">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onExplore(cluster);
                                    }}
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
    );
}

export default ClustersTable;
