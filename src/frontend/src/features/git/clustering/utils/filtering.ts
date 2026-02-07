/**
 * Cluster Filtering Utilities
 * 
 * Pure functions for filtering and sorting clusters.
 */

import type { ClusterFilterState, SortField, SortOrder } from '../types';
import { calculateClusterRank } from './naming';

// ============================================================
// Filtering
// ============================================================

export interface FilterableCluster {
    id: number;
    name?: string;
    files?: string[];
    size?: number;
    avg_coupling?: number;
    total_churn?: number;
    total_changes?: number;
    change_count?: number;
    common_authors?: any[];
}

/** Filter clusters based on filter state */
export function filterClusters<T extends FilterableCluster>(
    clusters: T[],
    filters: ClusterFilterState,
    options?: { directory?: string }
): T[] {
    const searchLower = filters.search.toLowerCase();
    const dirLower = options?.directory?.toLowerCase() || '';

    return clusters.filter(cluster => {
        const name = (cluster.name || `cluster-${cluster.id}`).toLowerCase();
        const files = cluster.files || [];
        const coupling = cluster.avg_coupling ?? 0;
        const fileCount = files.length || cluster.size || 0;
        const churn = cluster.total_churn || 0;
        const authorCount = cluster.common_authors?.length || 0;

        // Search match
        const matchesSearch = !filters.search ||
            name.includes(searchLower) ||
            files.some(f => f.toLowerCase().includes(searchLower));

        // Coupling range
        const matchesCoupling = coupling >= filters.couplingRange[0] &&
            coupling <= filters.couplingRange[1];

        // File count range
        const matchesFileCount = fileCount >= filters.fileRange[0] &&
            fileCount <= filters.fileRange[1];

        // Churn range
        const matchesChurn = churn >= (filters.churnRange?.[0] ?? 0) &&
            churn <= (filters.churnRange?.[1] ?? Infinity);

        // Author count range
        const matchesAuthors = authorCount >= (filters.authorRange?.[0] ?? 0) &&
            authorCount <= (filters.authorRange?.[1] ?? Infinity);

        // Directory filter
        const matchesDirectory = !dirLower ||
            files.some(f => f.toLowerCase().includes(dirLower));

        return matchesSearch && matchesCoupling &&
            matchesFileCount && matchesChurn &&
            matchesAuthors && matchesDirectory;
    });
}

// ============================================================
// Sorting
// ============================================================

/** Get a sort value for a cluster based on sort field */
function getSortValue(cluster: FilterableCluster, sortBy: SortField, depth: number = 3): string | number {
    switch (sortBy) {
        case 'rank':
            return calculateClusterRank(cluster);
        case 'files':
            return cluster.files?.length || cluster.size || 0;
        case 'folders': {
            const files = cluster.files || [];
            const folders = new Set(files.map(f =>
                f.split('/').slice(0, depth).join('/')
            ));
            return folders.size;
        }
        case 'churn':
            return cluster.total_churn || 0;
        case 'name':
            return (cluster.name || '').toLowerCase();
        case 'coupling':
        default:
            return cluster.avg_coupling || 0;
    }
}

/** Sort clusters by a given field and order */
export function sortClusters<T extends FilterableCluster>(
    clusters: T[],
    sortBy: SortField,
    sortOrder: SortOrder,
    depth: number = 3
): T[] {
    const direction = sortOrder === 'asc' ? 1 : -1;

    return [...clusters].sort((a, b) => {
        const aVal = getSortValue(a, sortBy, depth);
        const bVal = getSortValue(b, sortBy, depth);

        if (typeof aVal === 'string' && typeof bVal === 'string') {
            return direction * aVal.localeCompare(bVal);
        }

        return direction * ((aVal as number) - (bVal as number));
    });
}

/** Combined filter and sort operation */
export function filterAndSortClusters<T extends FilterableCluster>(
    clusters: T[],
    filters: ClusterFilterState,
    sortBy: SortField,
    sortOrder: SortOrder,
    options?: { directory?: string; depth?: number }
): T[] {
    const filtered = filterClusters(clusters, filters, options);
    return sortClusters(filtered, sortBy, sortOrder, options?.depth);
}

// ============================================================
// Statistics
// ============================================================

/** Calculate statistics for a list of clusters */
export function calculateClusterStats(clusters: FilterableCluster[]): {
    totalClusters: number;
    totalFiles: number;
    avgCoupling: number;
    maxFileCount: number;
    minCoupling: number;
    maxCoupling: number;
} {
    if (clusters.length === 0) {
        return {
            totalClusters: 0,
            totalFiles: 0,
            avgCoupling: 0,
            maxFileCount: 0,
            minCoupling: 0,
            maxCoupling: 0
        };
    }

    let totalFiles = 0;
    let couplingSum = 0;
    let maxFileCount = 0;
    let minCoupling = 1;
    let maxCoupling = 0;

    clusters.forEach(cluster => {
        const fileCount = cluster.files?.length || cluster.size || 0;
        const coupling = cluster.avg_coupling ?? 0;

        totalFiles += fileCount;
        couplingSum += coupling;
        maxFileCount = Math.max(maxFileCount, fileCount);
        minCoupling = Math.min(minCoupling, coupling);
        maxCoupling = Math.max(maxCoupling, coupling);
    });

    return {
        totalClusters: clusters.length,
        totalFiles,
        avgCoupling: couplingSum / clusters.length,
        maxFileCount,
        minCoupling,
        maxCoupling
    };
}
