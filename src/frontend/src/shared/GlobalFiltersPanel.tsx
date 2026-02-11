import { X, Filter } from 'lucide-react';
import { useFilters } from '@/shared/filters/useFilters';
import SearchInput from '@/shared/filters/SearchInput';
import FilterBar from '@/shared/filters/FilterBar';
import AdvancedFiltersPanel from '@/shared/filters/AdvancedFiltersPanel';

interface GlobalFiltersPanelProps {
  isOpen: boolean;
  onClose: () => void;
  availableAuthors?: string[];
}

export function GlobalFiltersPanel({ isOpen, onClose }: GlobalFiltersPanelProps) {
  const { filters, updateFilter, resetFilters, activeFilterCount } = useFilters();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative ml-auto h-full w-[460px] border-l border-slate-800 bg-slate-900 p-4 overflow-y-auto">
        <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-slate-200">
            <Filter size={16} className="text-sky-400" />
            <span className="text-sm font-semibold">Filters</span>
            {activeFilterCount > 0 && (
              <span className="rounded bg-sky-500/20 px-2 py-0.5 text-xs text-sky-300">{activeFilterCount}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button data-testid="globalfilterspanel-btn-btn-1"
              onClick={resetFilters}
              className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              Reset
            </button>
            <button data-testid="globalfilterspanel-btn-btn-2"
              onClick={onClose}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <SearchInput
          value={filters.search}
          onChange={(value) => updateFilter('search', value)}
          placeholder="Search by path, folder, extension..."
        />

        <FilterBar className="mt-4" />
        <AdvancedFiltersPanel className="mt-4" />
      </div>
    </div>
  );
}

export default GlobalFiltersPanel;
