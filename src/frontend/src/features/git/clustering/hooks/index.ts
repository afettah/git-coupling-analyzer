/**
 * Hooks Module Index
 * 
 * Re-exports all custom hooks for convenient imports.
 */

export { useSnapshots, type UseSnapshotsReturn } from './useSnapshots';
export { useClusterFilters, type UseClusterFiltersOptions, type UseClusterFiltersReturn } from './useClusterFilters';
export { useSelection, type UseSelectionOptions, type UseSelectionReturn } from './useSelection';
export {
    useCitySettings,
    type UseCitySettingsReturn,
    type CitySettings,
    type CityColorSettings,
    type ColorPalette,
    DEFAULT_CLUSTER_PALETTES,
    DEFAULT_COLOR_SETTINGS,
    DEFAULT_CITY_SETTINGS
} from './useCitySettings';
