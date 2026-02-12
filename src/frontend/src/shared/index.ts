/**
 * Shared Components Library
 * 
 * Centralized, reusable UI components with consistent styling.
 */

// Core components
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button';
export { Card } from './Card';
export { Modal, type ModalProps } from './Modal';

// Form components
export { RangeSlider, type RangeSliderProps } from './RangeSlider';
export { Select, type SelectProps, type SelectOption } from './Select';
export { TextInput, NumberInput, SearchInput, type TextInputProps, type NumberInputProps, type SearchInputProps } from './Input';
export { ToggleButton, type ToggleButtonProps } from './ToggleButton';

// Display components
export { StatCard, type StatCardProps } from './StatCard';
export { Badge, type BadgeProps } from './Badge';
export { ProgressBar, type ProgressBarProps } from './ProgressBar';
export { CouplingLegend, type CouplingLegendProps, COUPLING_THRESHOLDS } from './CouplingLegend';

// Feedback components
export { Spinner, LoadingState, EmptyState, ErrorBanner, type SpinnerProps, type LoadingStateProps, type EmptyStateProps, type ErrorBannerProps } from './Feedback';

// Context menu
export { ContextMenu, type ContextMenuProps, type ContextMenuItem } from './ContextMenu';
export { FileTree } from './FileTree';
