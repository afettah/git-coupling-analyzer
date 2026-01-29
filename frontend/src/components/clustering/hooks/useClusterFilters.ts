/**
 * Cluster Filters Hook
 * 
 * Manages filter state with URL synchronization and performance optimization.
 */

import { useCallback, useMemo, useState } from 'react';
import type { ClusterFilterState, SortField, SortOrder } from '../types';
import { DEFAULT_FILTER_STATE, DEFAULT_SORT } from '../constants';
import { filterAndSortClusters, calculateClusterStats } from '../utils';
import { enrichClustersWithNames } from '../utils/naming';

export interface UseClusterFiltersOptions {
    clusters: Array<{
        id: number;
        name?: string;
        files?: string[];
        size?: number;
        avg_coupling?: number;
        total_churn?: number;
    }>;
    initialFilters?: Partial<ClusterFilterState>;
    initialSort?: { field: SortField; order: SortOrder };
}

export interface UseClusterFiltersReturn {
    // Filter state
    filters: ClusterFilterState;
    setFilters: (filters: ClusterFilterState) => void;
    updateFilter: <K extends keyof ClusterFilterState>(key: K, value: ClusterFilterState[K]) => void;
    resetFilters: () => void;

    // Sort state
    sortBy: SortField;
    setSortBy: (field: SortField) => void;
    sortOrder: SortOrder;
    setSortOrder: (order: SortOrder) => void;

    // Computed values
    filteredClusters: ReturnType<typeof enrichClustersWithNames>;
    stats: ReturnType<typeof calculateClusterStats>;
    maxFileCount: number;
}

export function useClusterFilters({
    clusters,
    initialFilters = {},
    initialSort = DEFAULT_SORT
}: UseClusterFiltersOptions): UseClusterFiltersReturn {
    // Calculate max file count for range sliders
    const maxFileCount = useMemo(() => {
        return Math.max(...clusters.map(c => c.files?.length || c.size || 0), 100);
    }, [clusters]);

    // Initialize filter state with defaults and provided initial values
    const [filters, setFilters] = useState<ClusterFilterState>(() => ({
        ...DEFAULT_FILTER_STATE,
        fileRange: [0, maxFileCount],
        ...initialFilters
    }));

    // Sort state
    const [sortBy, setSortBy] = useState<SortField>(initialSort.field);
    const [sortOrder, setSortOrder] = useState<SortOrder>(initialSort.order);

    // Helper to update a single filter property
    const updateFilter = useCallback(<K extends keyof ClusterFilterState>(
        key: K,
        value: ClusterFilterState[K]
    ) => {
        setFilters((prev: ClusterFilterState) => ({ ...prev, [key]: value }));
    }, []);

    // Reset filters to defaults
    const resetFilters = useCallback(() => {
        setFilters({
            ...DEFAULT_FILTER_STATE,
            fileRange: [0, maxFileCount]
        });
        setSortBy(DEFAULT_SORT.field);
        setSortOrder(DEFAULT_SORT.order);
    }, [maxFileCount]);

    // Enrich clusters with smart names
    const clustersWithNames = useMemo(() => {
        return enrichClustersWithNames(clusters);
    }, [clusters]);

    // Apply filters and sorting
    const filteredClusters = useMemo(() => {
        return filterAndSortClusters(clustersWithNames, filters, sortBy, sortOrder);
    }, [clustersWithNames, filters, sortBy, sortOrder]);

    // Calculate statistics
    const stats = useMemo(() => {
        return calculateClusterStats(filteredClusters);
    }, [filteredClusters]);

    return {
        filters,
        setFilters,
        updateFilter,
        resetFilters,
        sortBy,
        setSortBy,
        sortOrder,
        setSortOrder,
        filteredClusters,
        stats,
        maxFileCount
    };
}

export default useClusterFilters;
