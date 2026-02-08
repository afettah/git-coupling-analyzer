import { ListTree, Table2, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { FilterBar, SearchInput, AdvancedFiltersPanel } from '@/shared/filters';
import { useFilesFilters } from './useFilesFilters';

interface FilesToolbarProps {
  totalFiles: number;
  visibleFiles: number;
  viewMode: 'tree' | 'table';
  onViewModeChange: (mode: 'tree' | 'table') => void;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
}

export default function FilesToolbar({
  totalFiles,
  visibleFiles,
  viewMode,
  onViewModeChange,
  showAdvanced,
  onToggleAdvanced,
}: FilesToolbarProps) {
  const { filters, updateFilter, isFiltering, resetFilters } = useFilesFilters();

  return (
    <div className="border-b border-slate-800 bg-slate-900/40 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={filters.search}
          onChange={(value) => updateFilter('search', value)}
          placeholder="Search files by path..."
          className="min-w-[260px] flex-1"
        />

        <div className="flex items-center rounded-lg border border-slate-700 bg-slate-900 p-1">
          <button
            onClick={() => onViewModeChange('tree')}
            className={`rounded-md px-2 py-1 text-xs transition-colors ${
              viewMode === 'tree' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Tree view"
          >
            <ListTree size={15} />
          </button>
          <button
            onClick={() => onViewModeChange('table')}
            className={`rounded-md px-2 py-1 text-xs transition-colors ${
              viewMode === 'table' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Table view"
          >
            <Table2 size={15} />
          </button>
        </div>

        <button
          onClick={onToggleAdvanced}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
            showAdvanced
              ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
              : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <SlidersHorizontal size={14} />
          Advanced
        </button>

        {isFiltering && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
          >
            <RotateCcw size={14} />
            Reset
          </button>
        )}

        <div className="ml-auto text-xs text-slate-400">
          {visibleFiles} / {totalFiles} files
        </div>
      </div>

      <FilterBar className="mt-3" />

      {showAdvanced && <AdvancedFiltersPanel className="mt-3" />}
    </div>
  );
}
