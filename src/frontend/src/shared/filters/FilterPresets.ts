/**
 * FilterPresets - Preset save/load logic
 */

import { type FilterState, type FilterPreset, BUILT_IN_PRESETS } from './types';

const STORAGE_KEY = 'git-analyzer-filter-presets';

export function savePreset(preset: FilterPreset): void {
  const presets = loadUserPresets();
  const existing = presets.findIndex(p => p.id === preset.id);
  
  if (existing >= 0) {
    presets[existing] = preset;
  } else {
    presets.push(preset);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function loadUserPresets(): FilterPreset[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function deletePreset(id: string): void {
  const presets = loadUserPresets().filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function getAllPresets(): FilterPreset[] {
  return [...BUILT_IN_PRESETS, ...loadUserPresets()];
}

export function applyPreset(preset: FilterPreset, currentFilters: FilterState): FilterState {
  return {
    ...currentFilters,
    ...preset.filters,
  };
}
