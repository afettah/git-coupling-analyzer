/**
 * FilterEngine - Pure filter logic (no UI)
 * Handles all filter operations on data arrays
 */

import { type FilterState, type DateRange, type NumberRange } from './types';

export interface FilterableItem {
  path: string;
  lastChanged?: Date | string;
  created?: Date | string;
  authors?: string[];
  extension?: string;
  folder?: string;
  commits?: number;
  churn?: number;
  coupling?: number;
  risk?: number;
  loc?: number;
  [key: string]: any;
}

// Date range matching
function matchesDateRange(date: Date | string | undefined, range: DateRange | null): boolean {
  if (!range) return true;
  if (!date) return false;

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (range.from && dateObj < range.from) return false;
  if (range.to && dateObj > range.to) return false;
  
  return true;
}

// Number range matching
function matchesNumberRange(value: number | undefined, range: NumberRange | null): boolean {
  if (!range) return true;
  if (value === undefined) return false;

  if (range.min !== null && value < range.min) return false;
  if (range.max !== null && value > range.max) return false;

  return true;
}

// Text search matching (fuzzy match on path)
function matchesSearch(item: FilterableItem, search: string): boolean {
  if (!search) return true;
  
  const searchLower = search.toLowerCase();
  const pathLower = item.path.toLowerCase();
  
  // Simple substring match - can be enhanced with fuzzy matching
  return pathLower.includes(searchLower);
}

// Quick filter matching
export function matchesQuickFilter(item: FilterableItem, filter: string): boolean {
  switch (filter) {
    case 'hot':
      // High churn rate (> 5) or recent activity (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const lastChanged = item.lastChanged ? new Date(item.lastChanged) : null;
      return (item.churn !== undefined && item.churn > 5) || 
             (lastChanged !== null && lastChanged > thirtyDaysAgo);
    
    case 'stable':
      // Low churn (< 2) and old (> 180 days since last change)
      const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
      const lastChangedStable = item.lastChanged ? new Date(item.lastChanged) : null;
      return (item.churn !== undefined && item.churn < 2) &&
             (lastChangedStable !== null && lastChangedStable < sixMonthsAgo);
    
    case 'recent':
      // Changed in last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const lastChangedRecent = item.lastChanged ? new Date(item.lastChanged) : null;
      return lastChangedRecent !== null && lastChangedRecent > sevenDaysAgo;
    
    case 'coupled':
      // High coupling score (> 0.6)
      return item.coupling !== undefined && item.coupling > 0.6;
    
    case 'risky':
      // High risk score (> 7)
      return item.risk !== undefined && item.risk > 7;
    
    default:
      return true;
  }
}

// Apply all filters to an item
export function applyFilters(item: FilterableItem, filters: FilterState): boolean {
  // Text search
  if (!matchesSearch(item, filters.search)) return false;

  // Quick filters
  if (filters.quickFilters.size > 0) {
    const matchesAny = Array.from(filters.quickFilters).some(filter => 
      matchesQuickFilter(item, filter)
    );
    if (!matchesAny) return false;
  }

  // Date ranges
  if (!matchesDateRange(item.lastChanged, filters.lastChangedRange)) return false;
  if (!matchesDateRange(item.created, filters.createdRange)) return false;

  // Multi-select filters
  if (filters.authors.length > 0) {
    if (!item.authors || !item.authors.some(a => filters.authors.includes(a))) {
      return false;
    }
  }

  if (filters.extensions.length > 0) {
    if (!item.extension || !filters.extensions.includes(item.extension)) {
      return false;
    }
  }

  if (filters.folders.length > 0) {
    if (!item.folder || !filters.folders.some(f => item.path.startsWith(f))) {
      return false;
    }
  }

  // Numeric ranges
  if (!matchesNumberRange(item.commits, filters.commitsRange)) return false;
  if (!matchesNumberRange(item.churn, filters.churnRange)) return false;
  if (!matchesNumberRange(item.coupling, filters.couplingRange)) return false;
  if (!matchesNumberRange(item.risk, filters.riskRange)) return false;
  if (!matchesNumberRange(item.loc, filters.locRange)) return false;

  return true;
}

// Filter an array of items
export function filterItems<T extends FilterableItem>(
  items: T[],
  filters: FilterState
): T[] {
  return items.filter(item => applyFilters(item, filters));
}

// Sort items
export function sortItems<T extends FilterableItem>(
  items: T[],
  sortBy: string,
  sortOrder: 'asc' | 'desc'
): T[] {
  const sorted = [...items].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];

    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal);
    }

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return aVal - bVal;
    }

    if (aVal instanceof Date && bVal instanceof Date) {
      return aVal.getTime() - bVal.getTime();
    }

    return 0;
  });

  return sortOrder === 'desc' ? sorted.reverse() : sorted;
}

// Count active filters
export function countActiveFilters(filters: FilterState): number {
  let count = 0;

  if (filters.search) count++;
  count += filters.quickFilters.size;
  if (filters.lastChangedRange) count++;
  if (filters.createdRange) count++;
  count += filters.authors.length;
  count += filters.extensions.length;
  count += filters.folders.length;
  if (filters.commitsRange) count++;
  if (filters.churnRange) count++;
  if (filters.couplingRange) count++;
  if (filters.riskRange) count++;
  if (filters.locRange) count++;

  return count;
}

// Check if any filters are active
export function isFiltering(filters: FilterState): boolean {
  return countActiveFilters(filters) > 0;
}
