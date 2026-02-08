/**
 * Unified filter system types
 * Used across all views (files, clusters, etc.) with URL synchronization
 */

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export interface NumberRange {
  min: number | null;
  max: number | null;
}

export type QuickFilterType = 'hot' | 'stable' | 'recent' | 'coupled' | 'risky';

export interface FilterState {
  // Text search
  search: string;

  // Quick filters (toggles)
  quickFilters: Set<QuickFilterType>;

  // Date ranges
  lastChangedRange: DateRange | null;
  createdRange: DateRange | null;

  // Multi-select
  authors: string[];
  extensions: string[];
  folders: string[];

  // Numeric ranges
  commitsRange: NumberRange | null;
  churnRange: NumberRange | null;
  couplingRange: NumberRange | null;
  riskRange: NumberRange | null;
  locRange: NumberRange | null;

  // Sort
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export const DEFAULT_FILTER_STATE: FilterState = {
  search: '',
  quickFilters: new Set(),
  lastChangedRange: null,
  createdRange: null,
  authors: [],
  extensions: [],
  folders: [],
  commitsRange: null,
  churnRange: null,
  couplingRange: null,
  riskRange: null,
  locRange: null,
  sortBy: 'path',
  sortOrder: 'asc',
};

export interface FilterPreset {
  id: string;
  name: string;
  description?: string;
  filters: Partial<FilterState>;
}

export const BUILT_IN_PRESETS: FilterPreset[] = [
  {
    id: 'high-risk',
    name: 'High Risk Files',
    description: 'Files with risk score > 7',
    filters: {
      riskRange: { min: 7, max: null },
      sortBy: 'risk',
      sortOrder: 'desc',
    },
  },
  {
    id: 'active-last-month',
    name: 'Active Last Month',
    description: 'Files changed in the last 30 days',
    filters: {
      lastChangedRange: {
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        to: new Date(),
      },
      sortBy: 'lastChanged',
      sortOrder: 'desc',
    },
  },
  {
    id: 'highly-coupled',
    name: 'Highly Coupled',
    description: 'Files with coupling score > 0.7',
    filters: {
      couplingRange: { min: 0.7, max: null },
      sortBy: 'coupling',
      sortOrder: 'desc',
    },
  },
  {
    id: 'high-churn',
    name: 'High Churn',
    description: 'Files with churn rate > 5',
    filters: {
      churnRange: { min: 5, max: null },
      sortBy: 'churn',
      sortOrder: 'desc',
    },
  },
];

// URL serialization keys
export const URL_PARAM_KEYS = {
  search: 'q',
  quickFilters: 'quick',
  lastChangedFrom: 'changed_from',
  lastChangedTo: 'changed_to',
  createdFrom: 'created_from',
  createdTo: 'created_to',
  authors: 'authors',
  extensions: 'ext',
  folders: 'folders',
  commitsMin: 'commits_min',
  commitsMax: 'commits_max',
  churnMin: 'churn_min',
  churnMax: 'churn_max',
  couplingMin: 'coupling_min',
  couplingMax: 'coupling_max',
  riskMin: 'risk_min',
  riskMax: 'risk_max',
  locMin: 'loc_min',
  locMax: 'loc_max',
  sortBy: 'sort',
  sortOrder: 'order',
} as const;
