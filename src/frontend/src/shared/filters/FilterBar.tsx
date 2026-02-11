/**
 * FilterBar - Quick filter chips UI
 */

import { useFilters } from './useFilters';
import { type QuickFilterType } from './types';
import { Flame, Anchor, Clock, Link2, AlertTriangle, X } from 'lucide-react';

const QUICK_FILTERS: Array<{ id: QuickFilterType; label: string; icon: any }> = [
  { id: 'hot', label: 'Hot', icon: Flame },
  { id: 'stable', label: 'Stable', icon: Anchor },
  { id: 'recent', label: 'Recent', icon: Clock },
  { id: 'coupled', label: 'Coupled', icon: Link2 },
  { id: 'risky', label: 'Risky', icon: AlertTriangle },
];

export default function FilterBar({ className = '' }: { className?: string }) {
  const { filters, updateFilter } = useFilters();

  const toggleQuickFilter = (filter: QuickFilterType) => {
    const newSet = new Set(filters.quickFilters);
    if (newSet.has(filter)) {
      newSet.delete(filter);
    } else {
      newSet.add(filter);
    }
    updateFilter('quickFilters', newSet);
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {QUICK_FILTERS.map(({ id, label, icon: Icon }) => {
        const isActive = filters.quickFilters.has(id);
        return (
          <button data-testid="filterbar-btn-btn-1"
            key={id}
            onClick={() => toggleQuickFilter(id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              isActive
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/50'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            <Icon size={14} />
            {label}
            {isActive && <X size={12} />}
          </button>
        );
      })}
    </div>
  );
}
