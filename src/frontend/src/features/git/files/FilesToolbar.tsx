import { ListTree, Table2, SlidersHorizontal, RotateCcw, ChevronsUpDown, ChevronsDownUp, ArrowUpDown } from 'lucide-react';
import { FilterBar, SearchInput, AdvancedFiltersPanel } from '@/shared/filters';
import { useFilesFilters } from './useFilesFilters';

const SORT_OPTIONS = [
  { value: 'path', label: 'Name' },
  { value: 'commits', label: 'Commits' },
  { value: 'churn', label: 'Churn' },
  { value: 'risk', label: 'Risk' },
  { value: 'coupling', label: 'Coupling' },
  { value: 'lastChanged', label: 'Last changed' },
] as const;

interface FilesToolbarProps {
  totalFiles: number;
  visibleFiles: number;
  viewMode: 'tree' | 'table';
  onViewModeChange: (mode: 'tree' | 'table') => void;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
}

export default function FilesToolbar({
  totalFiles,
  visibleFiles,
  viewMode,
  onViewModeChange,
  showAdvanced,
  onToggleAdvanced,
  onExpandAll,
  onCollapseAll,
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
          <button data-testid="files-toolbar-btn-btn-1"
            onClick={() => onViewModeChange('tree')}
            className={`rounded-md px-2 py-1 text-xs transition-colors ${
              viewMode === 'tree' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Tree view"
          >
            <ListTree size={15} />
          </button>
          <button data-testid="files-toolbar-btn-btn-2"
            onClick={() => onViewModeChange('table')}
            className={`rounded-md px-2 py-1 text-xs transition-colors ${
              viewMode === 'table' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Table view"
          >
            <Table2 size={15} />
          </button>
        </div>

        <button data-testid="files-toolbar-btn-btn-3"
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

        <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5">
          <label htmlFor="files-sort-by" className="text-xs text-slate-500">
            Sort
          </label>
          <select data-testid="files-toolbar-select-select-1"
            id="files-sort-by"
            value={filters.sortBy}
            onChange={(event) => updateFilter('sortBy', event.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button data-testid="files-toolbar-btn-btn-4"
            onClick={() => updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
            className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100"
            title={`Sort ${filters.sortOrder === 'asc' ? 'descending' : 'ascending'}`}
          >
            <ArrowUpDown size={12} />
            {filters.sortOrder.toUpperCase()}
          </button>
        </div>

        {viewMode === 'tree' && (
          <div className="flex items-center rounded-lg border border-slate-700 bg-slate-900 p-1">
            <button data-testid="files-toolbar-btn-expand-all-folders"
              onClick={onExpandAll}
              className="rounded-md p-1 text-slate-400 transition-colors hover:text-slate-200"
              title="Expand all folders"
            >
              <ChevronsUpDown size={15} />
            </button>
            <button data-testid="files-toolbar-btn-collapse-all-folders"
              onClick={onCollapseAll}
              className="rounded-md p-1 text-slate-400 transition-colors hover:text-slate-200"
              title="Collapse all folders"
            >
              <ChevronsDownUp size={15} />
            </button>
          </div>
        )}

        {isFiltering && (
          <button data-testid="files-toolbar-btn-btn-7"
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
