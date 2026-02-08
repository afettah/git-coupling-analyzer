/**
 * useFilters - Hook for reading and writing filters
 */

import { useMemo } from 'react';
import { useFilterContext } from './FilterContext';
import { countActiveFilters, isFiltering as checkIsFiltering } from './FilterEngine';

export function useFilters() {
  const { filters, setFilters, updateFilter, resetFilters } = useFilterContext();

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);
  const isFiltering = useMemo(() => checkIsFiltering(filters), [filters]);

  return {
    filters,
    setFilters,
    updateFilter,
    resetFilters,
    activeFilterCount,
    isFiltering,
  };
}
