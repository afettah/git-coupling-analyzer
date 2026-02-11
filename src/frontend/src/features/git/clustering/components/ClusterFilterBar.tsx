/**
 * Cluster Filter Bar Component
 * 
 * Composable filter controls for cluster views.
 */

import { SlidersHorizontal } from 'lucide-react';
import type { ClusterFilterState, ViewMode, SortField, SortOrder } from '../types';
import { Select, NumberInput, SearchInput, RangeSlider } from '@/shared';

export interface ClusterFilterBarProps {
    // View and sort controls
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
    sortBy: SortField;
    onSortByChange: (field: SortField) => void;
    sortOrder: SortOrder;
    onSortOrderChange: (order: SortOrder) => void;

    // Filter state
    filters: ClusterFilterState;
    onFiltersChange: (filters: ClusterFilterState) => void;

    // Configuration
    depth: number;
    onDepthChange: (depth: number) => void;
    maxFileCount: number;
    maxChurn?: number;
    maxAuthorCount?: number;

    // Optional additional filters
    showDirectory?: boolean;
    directory?: string;
    onDirectoryChange?: (dir: string) => void;
}

const VIEW_OPTIONS = [
    { value: 'cards' as const, label: 'Cards' },
    { value: 'table' as const, label: 'Table' }
];

const SORT_OPTIONS = [
    { value: 'rank' as const, label: 'Rank (Smart)' },
    { value: 'coupling' as const, label: 'Coupling' },
    { value: 'files' as const, label: 'File Count' },
    { value: 'folders' as const, label: 'Folder Count' },
    { value: 'churn' as const, label: 'Churn' },
    { value: 'name' as const, label: 'Name' }
];

const SORT_ORDER_OPTIONS = [
    { value: 'desc' as const, label: 'Desc' },
    { value: 'asc' as const, label: 'Asc' }
];

export function ClusterFilterBar({
    viewMode,
    onViewModeChange,
    sortBy,
    onSortByChange,
    sortOrder,
    onSortOrderChange,
    filters,
    onFiltersChange,
    depth,
    onDepthChange,
    maxFileCount, maxChurn = 10000,
    maxAuthorCount = 50, showDirectory = false,
    directory,
    onDirectoryChange
}: ClusterFilterBarProps) {
    const updateFilter = <K extends keyof ClusterFilterState>(
        key: K,
        value: ClusterFilterState[K]
    ) => {
        onFiltersChange({ ...filters, [key]: value });
    };

    return (
        <div className="border border-slate-800 rounded-2xl p-4 bg-slate-900/70 space-y-4">
            {/* Top Row: Controls */}
            <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider">
                    <SlidersHorizontal className="w-4 h-4" />
                    Controls
                </div>

                <Select
                    value={viewMode}
                    onChange={onViewModeChange}
                    options={VIEW_OPTIONS}
                    label="View"
                />

                <div className="flex items-center gap-2">
                    <Select
                        value={sortBy}
                        onChange={onSortByChange}
                        options={SORT_OPTIONS}
                        label="Sort"
                    />
                    <Select
                        value={sortOrder}
                        onChange={onSortOrderChange}
                        options={SORT_ORDER_OPTIONS}
                    />
                </div>

                <NumberInput
                    value={depth}
                    onChange={onDepthChange}
                    label="Depth"
                    min={1}
                    max={10}
                    width="w-16"
                />

                <SearchInput
                    value={filters.search}
                    onChange={(v) => updateFilter('search', v)}
                    placeholder="Filter clusters..."
                    className="flex-1 min-w-[200px]"
                />
            </div>

            {/* Bottom Row: Range Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

                <RangeSlider
                    label="Files range"
                    min={0}
                    max={maxFileCount}
                    value={filters.fileRange}
                    onChange={(v) => updateFilter('fileRange', v)}
                />

                <RangeSlider
                    label="Churn range"
                    min={0}
                    max={maxChurn}
                    value={filters.churnRange}
                    onChange={(v) => updateFilter('churnRange', v)}
                />

                <RangeSlider
                    label="Authors range"
                    min={0}
                    max={maxAuthorCount}
                    value={filters.authorRange}
                    onChange={(v) => updateFilter('authorRange', v)}
                />
            </div>

            {/* Optional: Directory Filter */}
            {showDirectory && onDirectoryChange && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">Directory filter</label>
                        <input data-testid="cluster-filter-input-input-1"
                            value={directory || ''}
                            onChange={(e) => onDirectoryChange(e.target.value)}
                            placeholder="e.g. src/components"
                            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default ClusterFilterBar;
