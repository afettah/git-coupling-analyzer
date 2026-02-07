/**
 * ViewFiltersBar Component
 * 
 * Unified filter bar that appears consistently across all views
 * (Clusters, Excalidraw, ProjectCity). Supports view-specific options.
 */

import { memo } from 'react';
import { SlidersHorizontal, Grid3X3, Table2 } from 'lucide-react';
import type { ClusterFilterState, ViewMode, SortField, SortOrder } from '../types';
import { Select, NumberInput, SearchInput, RangeSlider } from '@/shared';

// ============================================================
// Types
// ============================================================

export type ActiveView = 'clusters' | 'excalidraw' | 'city';

export interface ViewFiltersBarProps {
    // Common filter state (shared across all views)
    filters: ClusterFilterState;
    onFiltersChange: (filters: ClusterFilterState) => void;
    maxFileCount: number;
    maxChurn?: number;
    maxAuthorCount?: number;
    filteredCount: number;
    totalCount: number;

    // Clusters-specific (optional)
    viewMode?: ViewMode;
    onViewModeChange?: (mode: ViewMode) => void;
    sortBy?: SortField;
    onSortByChange?: (field: SortField) => void;
    sortOrder?: SortOrder;
    onSortOrderChange?: (order: SortOrder) => void;
    depth?: number;
    onDepthChange?: (depth: number) => void;
    directory?: string;
    onDirectoryChange?: (dir: string) => void;

    // City-specific options (optional)
    colorBy?: 'cluster' | 'coupling';
    onColorByChange?: (value: 'cluster' | 'coupling') => void;

    // Current view indicator for conditional rendering
    activeView?: ActiveView;

    // Additional action buttons slot
    actions?: React.ReactNode;
}

// ============================================================
// Constants
// ============================================================

const VIEW_OPTIONS = [
    { value: 'cards' as const, label: 'Cards', icon: <Grid3X3 className="w-3 h-3" /> },
    { value: 'table' as const, label: 'Table', icon: <Table2 className="w-3 h-3" /> }
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

const COLOR_BY_OPTIONS = [
    { value: 'cluster' as const, label: 'Cluster' },
    { value: 'coupling' as const, label: 'Coupling' }
];

// ============================================================
// Component
// ============================================================

export const ViewFiltersBar = memo(function ViewFiltersBar({
    filters,
    onFiltersChange,
    maxFileCount,
    maxChurn = 10000,
    maxAuthorCount = 50,
    filteredCount,
    totalCount,
    viewMode,
    onViewModeChange,
    sortBy,
    onSortByChange,
    sortOrder,
    onSortOrderChange,
    depth,
    onDepthChange,
    directory,
    onDirectoryChange,
    colorBy,
    onColorByChange,
    activeView = 'clusters',
    actions
}: ViewFiltersBarProps) {
    const updateFilter = <K extends keyof ClusterFilterState>(
        key: K,
        value: ClusterFilterState[K]
    ) => {
        onFiltersChange({ ...filters, [key]: value });
    };

    const showClusterViewOptions = activeView === 'clusters' && viewMode !== undefined && onViewModeChange;
    const showSortOptions = (activeView === 'clusters' || activeView === 'excalidraw') && sortBy !== undefined && onSortByChange;
    const showDepthOption = activeView === 'clusters' && depth !== undefined && onDepthChange;
    const showDirectoryFilter = activeView === 'clusters' && onDirectoryChange !== undefined;
    const showColorByOption = activeView === 'city' && colorBy !== undefined && onColorByChange;

    return (
        <div className="border border-slate-800 rounded-2xl p-4 bg-slate-900/70 space-y-4">
            {/* Top Row: Controls */}
            <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider">
                    <SlidersHorizontal className="w-4 h-4" />
                    Filters
                </div>

                {/* View mode toggle (Clusters only) */}
                {showClusterViewOptions && (
                    <div className="flex items-center gap-1.5 bg-slate-800/50 rounded-lg p-1">
                        {VIEW_OPTIONS.map(option => (
                            <button
                                key={option.value}
                                onClick={() => onViewModeChange(option.value)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === option.value
                                    ? 'bg-sky-500/20 text-sky-400'
                                    : 'text-slate-400 hover:text-slate-200'
                                    }`}
                            >
                                {option.icon}
                                {option.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Color by option (City only) */}
                {showColorByOption && (
                    <Select
                        value={colorBy}
                        onChange={onColorByChange}
                        options={COLOR_BY_OPTIONS}
                        label="Color by"
                    />
                )}

                {/* Sort options (Clusters and Excalidraw) */}
                {showSortOptions && sortOrder !== undefined && onSortOrderChange && (
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
                )}

                {/* Depth (Clusters only) */}
                {showDepthOption && (
                    <NumberInput
                        value={depth}
                        onChange={onDepthChange}
                        label="Depth"
                        min={1}
                        max={10}
                        width="w-16"
                    />
                )}

                {/* Search */}
                <SearchInput
                    value={filters.search}
                    onChange={(v) => updateFilter('search', v)}
                    placeholder="Filter clusters..."
                    className="flex-1 min-w-[180px]"
                />

                {/* Count display */}
                <div className="text-xs text-slate-400 whitespace-nowrap">
                    {filteredCount} / {totalCount} clusters
                </div>

                {/* Actions slot */}
                {actions && (
                    <div className="flex items-center gap-2">
                        {actions}
                    </div>
                )}
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

            {/* Directory Filter (Clusters only) */}
            {showDirectoryFilter && (
                <div className="pt-2 border-t border-slate-800">
                    <div className="flex items-center gap-4">
                        <label className="text-xs text-slate-500 shrink-0">Directory filter</label>
                        <input
                            value={directory || ''}
                            onChange={(e) => onDirectoryChange(e.target.value)}
                            placeholder="e.g. src/components"
                            className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                        />
                    </div>
                </div>
            )}
        </div>
    );
});

export default ViewFiltersBar;
