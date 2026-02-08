/**
 * useFilterURL - Bidirectional URL ↔ filter sync
 */

import { useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFilterContext } from './FilterContext';
import { type FilterState, URL_PARAM_KEYS, DEFAULT_FILTER_STATE } from './types';

export function useFilterURL() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, setFilters } = useFilterContext();

  // Serialize filters to URL params
  const serializeToURL = useCallback((filters: FilterState) => {
    const params = new URLSearchParams();

    if (filters.search) params.set(URL_PARAM_KEYS.search, filters.search);
    
    if (filters.quickFilters.size > 0) {
      params.set(URL_PARAM_KEYS.quickFilters, Array.from(filters.quickFilters).join(','));
    }

    if (filters.lastChangedRange?.from) {
      params.set(URL_PARAM_KEYS.lastChangedFrom, filters.lastChangedRange.from.toISOString());
    }
    if (filters.lastChangedRange?.to) {
      params.set(URL_PARAM_KEYS.lastChangedTo, filters.lastChangedRange.to.toISOString());
    }

    if (filters.createdRange?.from) {
      params.set(URL_PARAM_KEYS.createdFrom, filters.createdRange.from.toISOString());
    }
    if (filters.createdRange?.to) {
      params.set(URL_PARAM_KEYS.createdTo, filters.createdRange.to.toISOString());
    }

    if (filters.authors.length > 0) {
      params.set(URL_PARAM_KEYS.authors, filters.authors.join(','));
    }
    if (filters.extensions.length > 0) {
      params.set(URL_PARAM_KEYS.extensions, filters.extensions.join(','));
    }
    if (filters.folders.length > 0) {
      params.set(URL_PARAM_KEYS.folders, filters.folders.join(','));
    }

    if (filters.commitsRange?.min !== null && filters.commitsRange?.min !== undefined) {
      params.set(URL_PARAM_KEYS.commitsMin, filters.commitsRange.min.toString());
    }
    if (filters.commitsRange?.max !== null && filters.commitsRange?.max !== undefined) {
      params.set(URL_PARAM_KEYS.commitsMax, filters.commitsRange.max.toString());
    }

    if (filters.churnRange?.min !== null && filters.churnRange?.min !== undefined) {
      params.set(URL_PARAM_KEYS.churnMin, filters.churnRange.min.toString());
    }
    if (filters.churnRange?.max !== null && filters.churnRange?.max !== undefined) {
      params.set(URL_PARAM_KEYS.churnMax, filters.churnRange.max.toString());
    }

    if (filters.couplingRange?.min !== null && filters.couplingRange?.min !== undefined) {
      params.set(URL_PARAM_KEYS.couplingMin, filters.couplingRange.min.toString());
    }
    if (filters.couplingRange?.max !== null && filters.couplingRange?.max !== undefined) {
      params.set(URL_PARAM_KEYS.couplingMax, filters.couplingRange.max.toString());
    }

    if (filters.riskRange?.min !== null && filters.riskRange?.min !== undefined) {
      params.set(URL_PARAM_KEYS.riskMin, filters.riskRange.min.toString());
    }
    if (filters.riskRange?.max !== null && filters.riskRange?.max !== undefined) {
      params.set(URL_PARAM_KEYS.riskMax, filters.riskRange.max.toString());
    }

    if (filters.locRange?.min !== null && filters.locRange?.min !== undefined) {
      params.set(URL_PARAM_KEYS.locMin, filters.locRange.min.toString());
    }
    if (filters.locRange?.max !== null && filters.locRange?.max !== undefined) {
      params.set(URL_PARAM_KEYS.locMax, filters.locRange.max.toString());
    }

    if (filters.sortBy !== DEFAULT_FILTER_STATE.sortBy) {
      params.set(URL_PARAM_KEYS.sortBy, filters.sortBy);
    }
    if (filters.sortOrder !== DEFAULT_FILTER_STATE.sortOrder) {
      params.set(URL_PARAM_KEYS.sortOrder, filters.sortOrder);
    }

    return params;
  }, []);

  // Parse URL params to filters
  const parseFromURL = useCallback((params: URLSearchParams): FilterState => {
    const filters: FilterState = { ...DEFAULT_FILTER_STATE };

    const search = params.get(URL_PARAM_KEYS.search);
    if (search) filters.search = search;

    const quickFilters = params.get(URL_PARAM_KEYS.quickFilters);
    if (quickFilters) {
      filters.quickFilters = new Set(quickFilters.split(',') as any);
    }

    const changedFrom = params.get(URL_PARAM_KEYS.lastChangedFrom);
    const changedTo = params.get(URL_PARAM_KEYS.lastChangedTo);
    if (changedFrom || changedTo) {
      filters.lastChangedRange = {
        from: changedFrom ? new Date(changedFrom) : null,
        to: changedTo ? new Date(changedTo) : null,
      };
    }

    const createdFrom = params.get(URL_PARAM_KEYS.createdFrom);
    const createdTo = params.get(URL_PARAM_KEYS.createdTo);
    if (createdFrom || createdTo) {
      filters.createdRange = {
        from: createdFrom ? new Date(createdFrom) : null,
        to: createdTo ? new Date(createdTo) : null,
      };
    }

    const authors = params.get(URL_PARAM_KEYS.authors);
    if (authors) filters.authors = authors.split(',');

    const extensions = params.get(URL_PARAM_KEYS.extensions);
    if (extensions) filters.extensions = extensions.split(',');

    const folders = params.get(URL_PARAM_KEYS.folders);
    if (folders) filters.folders = folders.split(',');

    const commitsMin = params.get(URL_PARAM_KEYS.commitsMin);
    const commitsMax = params.get(URL_PARAM_KEYS.commitsMax);
    if (commitsMin || commitsMax) {
      filters.commitsRange = {
        min: commitsMin ? parseInt(commitsMin) : null,
        max: commitsMax ? parseInt(commitsMax) : null,
      };
    }

    const churnMin = params.get(URL_PARAM_KEYS.churnMin);
    const churnMax = params.get(URL_PARAM_KEYS.churnMax);
    if (churnMin || churnMax) {
      filters.churnRange = {
        min: churnMin ? parseFloat(churnMin) : null,
        max: churnMax ? parseFloat(churnMax) : null,
      };
    }

    const couplingMin = params.get(URL_PARAM_KEYS.couplingMin);
    const couplingMax = params.get(URL_PARAM_KEYS.couplingMax);
    if (couplingMin || couplingMax) {
      filters.couplingRange = {
        min: couplingMin ? parseFloat(couplingMin) : null,
        max: couplingMax ? parseFloat(couplingMax) : null,
      };
    }

    const riskMin = params.get(URL_PARAM_KEYS.riskMin);
    const riskMax = params.get(URL_PARAM_KEYS.riskMax);
    if (riskMin || riskMax) {
      filters.riskRange = {
        min: riskMin ? parseFloat(riskMin) : null,
        max: riskMax ? parseFloat(riskMax) : null,
      };
    }

    const locMin = params.get(URL_PARAM_KEYS.locMin);
    const locMax = params.get(URL_PARAM_KEYS.locMax);
    if (locMin || locMax) {
      filters.locRange = {
        min: locMin ? parseInt(locMin) : null,
        max: locMax ? parseInt(locMax) : null,
      };
    }

    const sortBy = params.get(URL_PARAM_KEYS.sortBy);
    if (sortBy) filters.sortBy = sortBy;

    const sortOrder = params.get(URL_PARAM_KEYS.sortOrder);
    if (sortOrder === 'asc' || sortOrder === 'desc') filters.sortOrder = sortOrder;

    return filters;
  }, []);

  // Initialize from URL on mount
  useEffect(() => {
    const parsed = parseFromURL(searchParams);
    setFilters(parsed);
  }, []); // Only run once on mount

  // Sync filters to URL
  useEffect(() => {
    const params = serializeToURL(filters);
    setSearchParams(params, { replace: true });
  }, [filters, serializeToURL, setSearchParams]);

  return {
    serializeToURL,
    parseFromURL,
  };
}
