import { SlidersHorizontal, Search } from 'lucide-react';

export interface ClusterFilterState {
    minClusterSize: number;
    couplingRange: [number, number];
    fileRange: [number, number];
    search: string;
}

interface ClusterFiltersProps {
    filters: ClusterFilterState;
    onFiltersChange: (filters: ClusterFilterState) => void;
    maxFileCount: number;
    filteredCount: number;
    totalCount: number;
    /** Show file range filter (default: true) */
    showFileRange?: boolean;
    /** Custom label for the count display */
    countLabel?: string;
}

export default function ClusterFilters({
    filters,
    onFiltersChange,
    maxFileCount,
    filteredCount,
    totalCount,
    showFileRange = true,
    countLabel = 'clusters'
}: ClusterFiltersProps) {
    const updateFilter = <K extends keyof ClusterFilterState>(key: K, value: ClusterFilterState[K]) => {
        onFiltersChange({ ...filters, [key]: value });
    };

    return (
        <div className="border border-slate-800 rounded-2xl p-4 bg-slate-900/70 space-y-4">
            <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider">
                    <SlidersHorizontal className="w-4 h-4" />
                    Filters
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">Min files</label>
                    <input
                        type="number"
                        min={1}
                        max={100}
                        value={filters.minClusterSize}
                        onChange={(e) => updateFilter('minClusterSize', Number(e.target.value))}
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 w-16"
                    />
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
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

            <div className={`grid grid-cols-1 ${showFileRange ? 'md:grid-cols-2' : ''} gap-4`}>
                <div>
                    <label className="text-xs text-slate-500">
                        Coupling range ({Math.round(filters.couplingRange[0] * 100)}–{Math.round(filters.couplingRange[1] * 100)}%)
                    </label>
                    <div className="flex items-center gap-2">
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round(filters.couplingRange[0] * 100)}
                            onChange={(e) => updateFilter('couplingRange', [Number(e.target.value) / 100, filters.couplingRange[1]])}
                            className="w-full accent-sky-500"
                        />
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round(filters.couplingRange[1] * 100)}
                            onChange={(e) => updateFilter('couplingRange', [filters.couplingRange[0], Number(e.target.value) / 100])}
                            className="w-full accent-sky-500"
                        />
                    </div>
                </div>
                {showFileRange && (
                    <div>
                        <label className="text-xs text-slate-500">
                            File count range ({filters.fileRange[0]}–{filters.fileRange[1]})
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min={0}
                                max={maxFileCount}
                                value={filters.fileRange[0]}
                                onChange={(e) => updateFilter('fileRange', [Number(e.target.value), filters.fileRange[1]])}
                                className="w-full accent-sky-500"
                            />
                            <input
                                type="range"
                                min={0}
                                max={maxFileCount}
                                value={filters.fileRange[1]}
                                onChange={(e) => updateFilter('fileRange', [filters.fileRange[0], Number(e.target.value)])}
                                className="w-full accent-sky-500"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
