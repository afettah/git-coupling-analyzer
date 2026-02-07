/**
 * Cluster Filters Component
 * 
 * Compact filter panel for cluster visualization views.
 */

import { memo, useCallback } from 'react';
import { SlidersHorizontal, Search } from 'lucide-react';
import type { ClusterFilterState } from '../types/index';
import { RangeSlider } from '@/shared';

export interface ClusterFiltersProps {
    filters: ClusterFilterState;
    onFiltersChange: (filters: ClusterFilterState) => void;
    maxFileCount: number;
    maxChurn?: number;
    maxAuthorCount?: number;
    filteredCount: number;
    totalCount: number;
    /** Show additional range filters (churn, authors) (default: false) */
    showAdvancedFilters?: boolean;
    /** Show file range filter (default: true) */
    showFileRange?: boolean;
    /** Custom label for the count display */
    countLabel?: string;
}

export const ClusterFilters = memo(function ClusterFilters({
    filters,
    onFiltersChange,
    maxFileCount,
    maxChurn = 10000,
    maxAuthorCount = 50,
    filteredCount,
    totalCount,
    showAdvancedFilters = false,
    showFileRange = true,
    countLabel = 'clusters'
}: ClusterFiltersProps) {
    const updateFilter = useCallback(<K extends keyof ClusterFilterState>(
        key: K,
        value: ClusterFilterState[K]
    ) => {
        onFiltersChange({ ...filters, [key]: value });
    }, [filters, onFiltersChange]);

    return (
        <div className="border border-slate-800 rounded-2xl p-4 bg-slate-900/70 space-y-4">
            <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider">
                    <SlidersHorizontal className="w-4 h-4" />
                    Filters
                </div>

                <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                    <Search className="w-3.5 h-3.5 text-slate-500" />
                    <input
                        value={filters.search}
                        onChange={(e) => updateFilter('search', e.target.value)}
                        placeholder="Search clusters or files..."
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200"
                    />
                </div>
                <div className="text-xs text-slate-400">
                    Showing {filteredCount} of {totalCount} {countLabel}
                </div>
            </div>

            <div className={`grid grid-cols-1 ${showFileRange || showAdvancedFilters ? 'md:grid-cols-2 lg:grid-cols-3' : ''} gap-6`}>
                <RangeSlider
                    label="Coupling range"
                    min={0}
                    max={100}
                    value={[
                        Math.round(filters.couplingRange[0] * 100),
                        Math.round(filters.couplingRange[1] * 100)
                    ]}
                    onChange={([min, max]) => updateFilter('couplingRange', [min / 100, max / 100])}
                    formatValue={(v) => `${v}%`}
                />

                {showFileRange && (
                    <RangeSlider
                        label="File count range"
                        min={0}
                        max={maxFileCount}
                        value={filters.fileRange}
                        onChange={(range) => updateFilter('fileRange', range)}
                    />
                )}

                {showAdvancedFilters && (
                    <>
                        <RangeSlider
                            label="Churn range"
                            min={0}
                            max={maxChurn}
                            value={filters.churnRange}
                            onChange={(range) => updateFilter('churnRange', range)}
                        />
                        <RangeSlider
                            label="Authors range"
                            min={0}
                            max={maxAuthorCount}
                            value={filters.authorRange}
                            onChange={(range) => updateFilter('authorRange', range)}
                        />
                    </>
                )}
            </div>
        </div>
    );
});

export default ClusterFilters;
