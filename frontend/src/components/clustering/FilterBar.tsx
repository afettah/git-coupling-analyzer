import { SlidersHorizontal } from 'lucide-react';

interface FilterBarProps {
    viewMode: string;
    onViewModeChange: (value: string) => void;
    sortBy: string;
    onSortByChange: (value: string) => void;
    sortOrder: string;
    onSortOrderChange: (value: string) => void;
    depth: number;
    onDepthChange: (value: number) => void;
    couplingRange: [number, number];
    onCouplingRangeChange: (range: [number, number]) => void;
    fileRange: [number, number];
    onFileRangeChange: (range: [number, number]) => void;
    search: string;
    onSearchChange: (value: string) => void;
    directory?: string;
    onDirectoryChange?: (value: string) => void;
    lastChangeFilter?: string;
    onLastChangeFilterChange?: (value: string) => void;
    changeCountRange?: [number, number];
    onChangeCountRangeChange?: (range: [number, number]) => void;
    minClusterSize?: number;
    onMinClusterSizeChange?: (value: number) => void;
}

export default function FilterBar({
    viewMode,
    onViewModeChange,
    sortBy,
    onSortByChange,
    sortOrder,
    onSortOrderChange,
    depth,
    onDepthChange,
    couplingRange,
    onCouplingRangeChange,
    fileRange,
    onFileRangeChange,
    search,
    onSearchChange,
    directory,
    onDirectoryChange,
    lastChangeFilter,
    onLastChangeFilterChange,
    changeCountRange,
    onChangeCountRangeChange,
    minClusterSize,
    onMinClusterSizeChange
}: FilterBarProps) {
    return (
        <div className="border border-slate-800 rounded-2xl p-4 bg-slate-900/70 space-y-4">
            <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider">
                    <SlidersHorizontal className="w-4 h-4" />
                    Controls
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">View</label>
                    <select
                        value={viewMode}
                        onChange={(e) => onViewModeChange(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                    >
                        <option value="cards">Cards</option>
                        <option value="table">Table</option>
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">Sort</label>
                    <select
                        value={sortBy}
                        onChange={(e) => onSortByChange(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                    >
                        <option value="rank">Rank (Smart)</option>
                        <option value="coupling">Coupling</option>
                        <option value="files">File Count</option>
                        <option value="folders">Folder Count</option>
                        <option value="churn">Churn</option>
                        <option value="name">Name</option>
                    </select>
                    <select
                        value={sortOrder}
                        onChange={(e) => onSortOrderChange(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                    >
                        <option value="desc">Desc</option>
                        <option value="asc">Asc</option>
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">Depth</label>
                    <input
                        type="number"
                        min={1}
                        max={10}
                        value={depth}
                        onChange={(e) => onDepthChange(Number(e.target.value))}
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 w-20"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">Min files</label>
                    <input
                        type="number"
                        min={1}
                        max={100}
                        value={minClusterSize ?? 2}
                        onChange={(e) => onMinClusterSizeChange?.(Number(e.target.value))}
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 w-16"
                    />
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <input
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Filter clusters..."
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="text-xs text-slate-500">Coupling range ({Math.round(couplingRange[0] * 100)}–{Math.round(couplingRange[1] * 100)}%)</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round(couplingRange[0] * 100)}
                            onChange={(e) => onCouplingRangeChange([Number(e.target.value) / 100, couplingRange[1]])}
                            className="w-full accent-sky-500"
                        />
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round(couplingRange[1] * 100)}
                            onChange={(e) => onCouplingRangeChange([couplingRange[0], Number(e.target.value) / 100])}
                            className="w-full accent-sky-500"
                        />
                    </div>
                </div>
                <div>
                    <label className="text-xs text-slate-500">File count range ({fileRange[0]}–{fileRange[1]})</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="range"
                            min={0}
                            max={fileRange[1]}
                            value={fileRange[0]}
                            onChange={(e) => onFileRangeChange([Number(e.target.value), fileRange[1]])}
                            className="w-full accent-sky-500"
                        />
                        <input
                            type="range"
                            min={0}
                            max={fileRange[1]}
                            value={fileRange[1]}
                            onChange={(e) => onFileRangeChange([fileRange[0], Number(e.target.value)])}
                            className="w-full accent-sky-500"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {onDirectoryChange && (
                    <div>
                        <label className="text-xs text-slate-500">Directory filter</label>
                        <input
                            value={directory || ''}
                            onChange={(e) => onDirectoryChange(e.target.value)}
                            placeholder="e.g. src/components"
                            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 mt-1"
                        />
                    </div>
                )}
                {onLastChangeFilterChange && (
                    <div>
                        <label className="text-xs text-slate-500">Last change</label>
                        <select
                            value={lastChangeFilter || 'all'}
                            onChange={(e) => onLastChangeFilterChange(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 mt-1"
                        >
                            <option value="all">All time</option>
                            <option value="week">Last week</option>
                            <option value="month">Last month</option>
                            <option value="3months">Last 3 months</option>
                        </select>
                    </div>
                )}
                {onChangeCountRangeChange && changeCountRange && (
                    <div>
                        <label className="text-xs text-slate-500">Change count ({changeCountRange[0]}–{changeCountRange[1]})</label>
                        <div className="flex items-center gap-2 mt-1">
                            <input
                                type="range"
                                min={0}
                                max={1000}
                                value={changeCountRange[0]}
                                onChange={(e) => onChangeCountRangeChange([Number(e.target.value), changeCountRange[1]])}
                                className="w-full accent-sky-500"
                            />
                            <input
                                type="range"
                                min={0}
                                max={1000}
                                value={changeCountRange[1]}
                                onChange={(e) => onChangeCountRangeChange([changeCountRange[0], Number(e.target.value)])}
                                className="w-full accent-sky-500"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
