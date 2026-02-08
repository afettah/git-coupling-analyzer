import { useMemo, useCallback } from 'react';
import { useFilters } from '@/shared/filters/useFilters';
import { useFilterContext } from '@/shared/filters/FilterContext';
import type { FilterState, QuickFilterType } from '@/shared/filters/types';
import { applyFilters, sortItems, type FilterableItem } from '@/shared/filters/FilterEngine';

export { useFilters } from '@/shared/filters/useFilters';
export { useFilterContext } from '@/shared/filters/FilterContext';
export type { FilterState, QuickFilterType } from '@/shared/filters/types';
export { applyFilters, sortItems, type FilterableItem } from '@/shared/filters/FilterEngine';

interface TreeNode {
  __type?: 'file' | 'dir';
  __children?: Record<string, TreeNode>;
  file_id?: number;
  commits?: number;
  lines_added?: number;
  lines_deleted?: number;
  authors?: number;
  last_modified?: string;
  last_author?: string;
  coupled_count?: number;
  max_coupling?: number;
  avg_coupling?: number;
  strong_coupling_count?: number;
}

function treeNodeToFilterableItem(node: TreeNode, path: string): FilterableItem {
  const extension = path.includes('.') ? path.split('.').pop() : undefined;
  const folder = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : undefined;
  const churn =
    node.lines_added !== undefined && node.lines_deleted !== undefined
      ? node.lines_added + node.lines_deleted
      : undefined;
  const commits = node.commits ?? 0;
  const coupling = node.max_coupling ?? 0;
  const contributors = node.authors ?? 0;
  const risk = Math.min(10, commits / 5 + coupling * 4 + Math.max(0, 3 - Math.min(contributors, 3)));

  return {
    path,
    commits,
    coupling,
    lastChanged: node.last_modified,
    authors: node.last_author ? [node.last_author] : undefined,
    extension,
    folder,
    churn,
    risk,
  };
}

export function useFilesFilters() {
  const filtersHook = useFilters();
  const { filters } = filtersHook;

  const hasActiveFilters = useMemo(() => filtersHook.isFiltering, [filtersHook.isFiltering]);
  const activeFilterCount = useMemo(() => filtersHook.activeFilterCount, [filtersHook.activeFilterCount]);

  const filterTreeNode = useCallback(
    (node: TreeNode, path: string): boolean => {
      const item = treeNodeToFilterableItem(node, path);
      return applyFilters(item, filters);
    },
    [filters],
  );

  const filterAndSortFiles = useCallback(
    <T extends FilterableItem>(files: T[]): T[] => {
      const filtered = files.filter(file => applyFilters(file, filters));
      return sortItems(filtered, filters.sortBy, filters.sortOrder);
    },
    [filters],
  );

  return {
    ...filtersHook,
    hasActiveFilters,
    activeFilterCount,
    filterTreeNode,
    filterAndSortFiles,
  };
}
