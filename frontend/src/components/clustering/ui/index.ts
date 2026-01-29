/**
 * UI Components Index
 * 
 * Re-exports shared components and clustering-specific UI.
 */

// Re-export from shared component library
export {
    Button,
    type ButtonProps,
    type ButtonVariant,
    type ButtonSize,
    Select,
    type SelectProps,
    type SelectOption,
    SearchInput,
    type SearchInputProps,
    NumberInput,
    type NumberInputProps,
    RangeSlider,
    type RangeSliderProps,
    ToggleButton,
    type ToggleButtonProps,
    StatCard,
    type StatCardProps,
    Modal,
    type ModalProps,
    Spinner,
    LoadingState,
    type SpinnerProps,
    type LoadingStateProps,
    EmptyState,
    type EmptyStateProps,
    CouplingLegend,
    type CouplingLegendProps,
} from '@/components/shared';

// Clustering-specific filter component
export { ClusterFilters, type ClusterFiltersProps } from './ClusterFilters';
