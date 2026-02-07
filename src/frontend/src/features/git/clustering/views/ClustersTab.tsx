/**
 * Clusters Tab Component (Refactored)
 * 
 * Main view for browsing and exploring clusters.
 * Receives pre-filtered clusters from parent.
 */

import { useState, useCallback } from 'react';
import type { ClusterData, ViewMode } from '../types';
import { exportClusterToCsv, exportAllClustersToCsv } from '../utils';
import { ClusterCard, ClustersTable, ClusterModal } from '../components';

export interface ClustersTabProps {
    clusters: ClusterData[];
    viewMode: ViewMode;
    depth: number;
    onFileSelect?: (path: string) => void;
}

export function ClustersTab({ clusters, viewMode, depth, onFileSelect }: ClustersTabProps) {
    // Modal state
    const [selectedCluster, setSelectedCluster] = useState<ClusterData | null>(null);

    // Export handlers
    const handleExportCluster = useCallback((cluster: ClusterData) => {
        exportClusterToCsv(cluster);
    }, []);

    const handleExportAll = useCallback(() => {
        exportAllClustersToCsv(clusters);
    }, [clusters]);

    const handleExplore = useCallback((cluster: ClusterData) => {
        setSelectedCluster(cluster);
    }, []);

    const handleCloseModal = useCallback(() => {
        setSelectedCluster(null);
    }, []);

    return (
        <div className="space-y-4">
            {/* Summary Bar */}
            <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{clusters.length} clusters shown</span>
                <button
                    onClick={handleExportAll}
                    className="text-sky-400 hover:text-sky-300"
                >
                    Export all CSV
                </button>
            </div>

            {/* Clusters View */}
            {viewMode === 'table' ? (
                <ClustersTable
                    clusters={clusters}
                    onExplore={handleExplore}
                />
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {clusters.map(cluster => (
                        <ClusterCard
                            key={cluster.id}
                            cluster={cluster}
                            folderDepth={depth}
                            onExplore={() => handleExplore(cluster)}
                            onExport={() => handleExportCluster(cluster)}
                            onFileSelect={onFileSelect}
                        />
                    ))}
                </div>
            )}

            {/* Empty State */}
            {clusters.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                    No clusters match the current filters
                </div>
            )}

            {/* Cluster Detail Modal */}
            {selectedCluster && (
                <ClusterModal
                    cluster={selectedCluster}
                    onClose={handleCloseModal}
                    onExport={() => handleExportCluster(selectedCluster)}
                    onFileSelect={onFileSelect}
                />
            )}
        </div>
    );
}

export default ClustersTab;
