/**
 * AdvancedFiltersPanel - Collapsible advanced filters UI
 */

import { useState } from 'react';
import { useFilters } from './useFilters';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function AdvancedFiltersPanel({ className = '' }: { className?: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { filters, updateFilter, resetFilters } = useFilters();

  return (
    <div className={`border border-slate-700 rounded-lg bg-slate-900 ${className}`}>
      <button data-testid="filters-btn-btn-1"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
      >
        <span>Advanced Filters</span>
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isExpanded && (
        <div className="px-4 py-3 space-y-4 border-t border-slate-700">
          {/* Risk Range */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Risk Score</label>
            <div className="flex gap-2 items-center">
              <input data-testid="filters-input-min"
                type="number"
                placeholder="Min"
                value={filters.riskRange?.min ?? ''}
                onChange={(e) => updateFilter('riskRange', {
                  min: e.target.value ? parseFloat(e.target.value) : null,
                  max: filters.riskRange?.max ?? null,
                })}
                className="w-24 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200 text-sm"
              />
              <span className="text-slate-500">—</span>
              <input data-testid="filters-input-max"
                type="number"
                placeholder="Max"
                value={filters.riskRange?.max ?? ''}
                onChange={(e) => updateFilter('riskRange', {
                  min: filters.riskRange?.min ?? null,
                  max: e.target.value ? parseFloat(e.target.value) : null,
                })}
                className="w-24 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200 text-sm"
              />
            </div>
          </div>

          {/* Churn Range */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Churn Rate</label>
            <div className="flex gap-2 items-center">
              <input data-testid="filters-input-min"
                type="number"
                placeholder="Min"
                value={filters.churnRange?.min ?? ''}
                onChange={(e) => updateFilter('churnRange', {
                  min: e.target.value ? parseFloat(e.target.value) : null,
                  max: filters.churnRange?.max ?? null,
                })}
                className="w-24 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200 text-sm"
              />
              <span className="text-slate-500">—</span>
              <input data-testid="filters-input-max"
                type="number"
                placeholder="Max"
                value={filters.churnRange?.max ?? ''}
                onChange={(e) => updateFilter('churnRange', {
                  min: filters.churnRange?.min ?? null,
                  max: e.target.value ? parseFloat(e.target.value) : null,
                })}
                className="w-24 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200 text-sm"
              />
            </div>
          </div>

          {/* Coupling Range */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Coupling Score</label>
            <div className="flex gap-2 items-center">
              <input data-testid="filters-input-min"
                type="number"
                step="0.1"
                min="0"
                max="1"
                placeholder="Min"
                value={filters.couplingRange?.min ?? ''}
                onChange={(e) => updateFilter('couplingRange', {
                  min: e.target.value ? parseFloat(e.target.value) : null,
                  max: filters.couplingRange?.max ?? null,
                })}
                className="w-24 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200 text-sm"
              />
              <span className="text-slate-500">—</span>
              <input data-testid="filters-input-max"
                type="number"
                step="0.1"
                min="0"
                max="1"
                placeholder="Max"
                value={filters.couplingRange?.max ?? ''}
                onChange={(e) => updateFilter('couplingRange', {
                  min: filters.couplingRange?.min ?? null,
                  max: e.target.value ? parseFloat(e.target.value) : null,
                })}
                className="w-24 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200 text-sm"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button data-testid="filters-btn-btn-2"
              onClick={resetFilters}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
