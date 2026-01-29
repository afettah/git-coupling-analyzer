/**
 * Clusters Tab Component (Refactored)
 * 
 * Main view for browsing and exploring clusters.
 * Uses composition of smaller components and hooks.
 */

import { useState, useMemo, useCallback } from 'react';
import type { ClusterResult } from '../../../api';
import type { ClusterData, ClusterFilterState, SortField, SortOrder, ViewMode } from '../types';
import { enrichClustersWithNames, filterAndSortClusters, exportClusterToCsv, exportAllClustersToCsv } from '../utils';
import { DEFAULT_FILTER_STATE } from '../constants';
import { ClusterCard, ClustersTable, ClusterModal, ClusterFilterBar } from '../components';

export interface ClustersTabProps {
    snapshot: ClusterResult;
}

export function ClustersTab({ snapshot }: ClustersTabProps) {
    // View state
    const [viewMode, setViewMode] = useState<ViewMode>('cards');
    const [depth, setDepth] = useState(3);

    // Sort state
    const [sortBy, setSortBy] = useState<SortField>('rank');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    // Filter state
    const clusters = snapshot.clusters || [];
    const maxFiles = useMemo(
        () => Math.max(1, ...clusters.map(c => c.files?.length || c.size || 0)),
        [clusters]
    );

    const [filters, setFilters] = useState<ClusterFilterState>(() => ({
        ...DEFAULT_FILTER_STATE,
        fileRange: [0, maxFiles]
    }));

    const [directory, setDirectory] = useState('');

    // Modal state
    const [selectedCluster, setSelectedCluster] = useState<ClusterData | null>(null);

    // Enrich clusters with smart names
    const clustersWithNames = useMemo(
        () => enrichClustersWithNames(clusters) as ClusterData[],
        [clusters]
    );

    // Filter and sort clusters
    const filteredClusters = useMemo(
        () => filterAndSortClusters(
            clustersWithNames,
            filters,
            sortBy,
            sortOrder,
            { directory, depth }
        ),
        [clustersWithNames, filters, sortBy, sortOrder, directory, depth]
    );

    // Export handlers
    const handleExportCluster = useCallback((cluster: ClusterData) => {
        exportClusterToCsv(cluster);
    }, []);

    const handleExportAll = useCallback(() => {
        exportAllClustersToCsv(clustersWithNames);
    }, [clustersWithNames]);

    const handleExplore = useCallback((cluster: ClusterData) => {
        setSelectedCluster(cluster);
    }, []);

    const handleCloseModal = useCallback(() => {
        setSelectedCluster(null);
    }, []);

    return (
        <div className="space-y-6">
            {/* Filter Bar */}
            <ClusterFilterBar
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                sortBy={sortBy}
                onSortByChange={setSortBy}
                sortOrder={sortOrder}
                onSortOrderChange={setSortOrder}
                filters={filters}
                onFiltersChange={setFilters}
                depth={depth}
                onDepthChange={setDepth}
                maxFileCount={maxFiles}
                showDirectory
                directory={directory}
                onDirectoryChange={setDirectory}
            />

            {/* Summary Bar */}
            <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{filteredClusters.length} clusters shown</span>
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
                    clusters={filteredClusters}
                    onExplore={handleExplore}
                />
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {filteredClusters.map(cluster => (
                        <ClusterCard
                            key={cluster.id}
                            cluster={cluster}
                            folderDepth={depth}
                            onExplore={() => handleExplore(cluster)}
                            onExport={() => handleExportCluster(cluster)}
                        />
                    ))}
                </div>
            )}

            {/* Empty State */}
            {filteredClusters.length === 0 && (
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
                />
            )}
        </div>
    );
}

export default ClustersTab;
