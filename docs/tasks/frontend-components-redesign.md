# Task: Frontend Components Redesign

**Status:** In Progress (Phase 2 Partially Complete)  
**Priority:** High  

---

## Overview

A comprehensive redesign of the frontend architecture to improve reusability, consistency, and developer experience. This task introduces a shared component library, unified design patterns, simplified APIs, and better customization support across the application.

---

## Current Progress

### ✅ Completed
- **UI Components Library** (`components/clustering/ui/`): Created reusable UI components including:
  - `Button` — Multiple variants and sizes
  - `Select` — Dropdown with options
  - `SearchInput` — Search input with icon
  - `NumberInput` — Numeric input with label
  - `RangeSlider` — Dual-handle range slider
  - `ToggleButton` — Toggle/switch button
  - `StatCard` — Statistics display card
  - `Modal` — Modal dialog
  - `Spinner` / `LoadingState` — Loading indicators
  - `EmptyState` — Empty state placeholder
  - `CouplingLegend` — Coupling color legend
  - Barrel exports via `ui/index.ts`

- **Constants Module** (`components/clustering/constants/`): Centralized constants including:
  - `CLUSTER_PALETTE` — Color palette for clusters
  - `COUPLING_COLORS` — Coupling strength colors with thresholds
  - `DISTRICT_COLORS` — Treemap visualization colors
  - `DEFAULT_FILTER_STATE` — Default filter values
  - `EXCALIDRAW_CONFIG` — Diagram configuration
  - `CITY_CONFIG` — ProjectCity visualization config
  - `getCouplingColor()` — Helper function for coupling colors

- **Refactored Components**: 
  - `ClusterFilterBar` — Uses `RangeSlider`, `Select`, `NumberInput`, `SearchInput` from `ui/`
  - `ClusterModal` — Uses `Modal`, `Select`, `Button` from `ui/`
  - `ExcalidrawView` — Uses `ClusterFilters`, `CouplingLegend`, `Button` from `ui/`
  - `ProjectCity` — Uses `Spinner` from `ui/`

- **Custom Hooks** (`components/clustering/hooks/`):
  - `useSnapshots` — Snapshot management
  - `useSelection` — Selection state management
  - `useClusterFilters` — Filter state management

### 🔄 In Progress
- Migration of remaining components to use shared UI components
- Legacy `ClusterFilters.tsx` still uses inline range inputs (not migrated to `RangeSlider`)

### ❌ Not Started
- `design-tokens/` folder structure (colors, spacing, typography as separate modules)
- `config/ui.config.ts` — Centralized UI configuration file
- `components/shared/` — Global shared components (outside clustering module)
- `styles/variables.css` — CSS custom properties for theming
- Storybook integration for component documentation
- Accessibility audit

---

## Problem Statement

The current frontend codebase has several issues affecting maintainability and consistency:

- **Scattered implementations**: Similar UI patterns (filters, sliders, modals, cards) are reimplemented in multiple places
- **Inconsistent styling**: Different components use slightly different colors, spacing, and interactions
- **Complex APIs**: Component props are verbose and expose internal implementation details
- **Duplicate range selectors**: Min/max ranges use two separate sliders instead of a unified dual-handle selector
- **Hard-coded values**: Colors, thresholds, and configuration values scattered throughout components
- **Poor customization**: Styling overrides require deep knowledge of component internals

---

## Goals

1. **Reusable Component Library** — Centralized, composable UI components
2. **Consistent Design System** — Unified colors, spacing, typography via tokens
3. **Simple Component APIs** — Hide implementation details, expose clean interfaces
4. **Customization Framework** — Constants, CSS variables, and theme support
5. **Unified Range Selector** — Single dual-handle slider for min/max ranges
6. **Improved Code Organization** — Clear folder structure with barrel exports

---

## Detailed Feature Specifications

### 1. Shared Component Library Structure

Create a centralized component library under `frontend/src/components/shared/`:

```
frontend/src/components/shared/
├── index.ts                    # Barrel exports
├── Button/
│   ├── Button.tsx
│   ├── Button.types.ts
│   └── index.ts
├── Card/
│   ├── Card.tsx
│   ├── Card.types.ts
│   └── index.ts
├── Input/
│   ├── TextInput.tsx
│   ├── NumberInput.tsx
│   ├── SearchInput.tsx
│   └── index.ts
├── RangeSlider/
│   ├── RangeSlider.tsx         # Dual-handle range selector
│   ├── RangeSlider.types.ts
│   └── index.ts
├── Modal/
│   ├── Modal.tsx
│   ├── ConfirmModal.tsx
│   └── index.ts
├── Filters/
│   ├── FilterPanel.tsx
│   ├── FilterChip.tsx
│   └── index.ts
├── DataDisplay/
│   ├── StatCard.tsx
│   ├── Badge.tsx
│   ├── ProgressBar.tsx
│   └── index.ts
├── Feedback/
│   ├── EmptyState.tsx
│   ├── LoadingSpinner.tsx
│   ├── ErrorBanner.tsx
│   └── index.ts
└── Layout/
    ├── PageHeader.tsx
    ├── Section.tsx
    ├── Grid.tsx
    └── index.ts
```

#### Usage Example

```tsx
// Simple imports via barrel exports
import { 
    Button, 
    Card, 
    RangeSlider, 
    SearchInput, 
    EmptyState 
} from '@/components/shared';
```

---

### 2. Unified Range Selector Component

**Problem:** Current implementation uses two separate `<input type="range">` elements for min/max values (see `ClusterFilters.tsx` lines 70-92).

**Solution:** Create a single `RangeSlider` component with dual handles.

#### New Component: `RangeSlider.tsx`

```tsx
interface RangeSliderProps {
    /** Current range value [min, max] */
    value: [number, number];
    /** Callback when range changes */
    onChange: (value: [number, number]) => void;
    /** Minimum allowed value */
    min?: number;
    /** Maximum allowed value */
    max?: number;
    /** Step increment */
    step?: number;
    /** Format display value (e.g., percentage, count) */
    formatValue?: (value: number) => string;
    /** Label for the slider */
    label?: string;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Disable the slider */
    disabled?: boolean;
}

// Usage example
<RangeSlider
    label="Coupling Range"
    value={[0.2, 0.8]}
    onChange={setCouplingRange}
    min={0}
    max={1}
    step={0.01}
    formatValue={(v) => `${Math.round(v * 100)}%`}
/>
```

#### Files to Update

| File | Change |
|------|--------|
| `components/clustering/ClusterFilters.tsx` | Replace dual sliders with `RangeSlider` |
| `components/ImpactGraph.tsx` | Use `RangeSlider` for weight thresholds |
| `components/AnalysisDashboard.tsx` | Use `RangeSlider` for date/metric ranges |

---

### 3. Design Tokens & Constants

Centralize all design values in `frontend/src/design-tokens/`:

```
frontend/src/design-tokens/
├── index.ts              # Barrel export
├── colors.ts             # Color palette and semantic colors
├── spacing.ts            # Spacing scale (4, 8, 12, 16, 24, 32...)
├── typography.ts         # Font sizes, weights, line heights
├── borders.ts            # Border radii, widths
├── shadows.ts            # Shadow definitions
├── animations.ts         # Transition durations, easing
└── breakpoints.ts        # Responsive breakpoints
```

#### Example: `colors.ts`

```typescript
export const colors = {
    // Base palette
    slate: {
        50: '#f8fafc',
        100: '#f1f5f9',
        // ...
        900: '#0f172a',
        950: '#020617',
    },
    
    // Semantic colors
    primary: '#38bdf8',
    success: '#22c55e',
    warning: '#facc15',
    error: '#ef4444',
    info: '#60a5fa',
    
    // Component-specific
    coupling: {
        veryHigh: '#ef4444',
        high: '#f97316',
        medium: '#facc15',
        low: '#22c55e',
        veryLow: '#38bdf8',
    },
    
    // Cluster palette
    clusters: [
        '#38bdf8', '#22c55e', '#f97316', '#e879f9', '#facc15',
        '#60a5fa', '#34d399', '#fb7185', '#a78bfa', '#fbbf24',
    ],
} as const;

export type ColorToken = keyof typeof colors;
```

#### Example: `spacing.ts`

```typescript
export const spacing = {
    0: '0',
    1: '0.25rem',   // 4px
    2: '0.5rem',    // 8px
    3: '0.75rem',   // 12px
    4: '1rem',      // 16px
    5: '1.25rem',   // 20px
    6: '1.5rem',    // 24px
    8: '2rem',      // 32px
    10: '2.5rem',   // 40px
    12: '3rem',     // 48px
} as const;

export type SpacingToken = keyof typeof spacing;
```

---

### 4. Simplified Component APIs

Define clean, minimal APIs that hide implementation complexity.

#### Pattern: Props Interface with Sensible Defaults

```typescript
// ❌ Current verbose API
interface ClusterFiltersProps {
    filters: ClusterFilterState;
    onFiltersChange: (filters: ClusterFilterState) => void;
    maxFileCount: number;
    filteredCount: number;
    totalCount: number;
    showFileRange?: boolean;
    countLabel?: string;
}

// ✅ Simplified API with render props for flexibility
interface FilterPanelProps<T> {
    /** Current filter values */
    value: T;
    /** Change handler */
    onChange: (value: T) => void;
    /** Filter configuration */
    config: FilterConfig[];
    /** Optional: summary text */
    summary?: string;
    /** Optional: preset filter buttons */
    presets?: FilterPreset<T>[];
}

// Usage
<FilterPanel
    value={filters}
    onChange={setFilters}
    config={[
        { type: 'search', key: 'search', placeholder: 'Search...' },
        { type: 'range', key: 'coupling', label: 'Coupling', min: 0, max: 1, format: 'percent' },
        { type: 'number', key: 'minSize', label: 'Min files', min: 1, max: 100 },
    ]}
    presets={[
        { label: 'High coupling', value: { coupling: [0.6, 1], minSize: 2 } },
        { label: 'Large clusters', value: { coupling: [0, 1], minSize: 10 } },
    ]}
/>
```

#### Pattern: Compound Components

```tsx
// Card with compound pattern
<Card>
    <Card.Header>
        <Card.Title>Cluster Analysis</Card.Title>
        <Card.Actions>
            <Button size="sm">Export</Button>
        </Card.Actions>
    </Card.Header>
    <Card.Body>
        {/* Content */}
    </Card.Body>
    <Card.Footer>
        <Card.Stats items={[{ label: 'Files', value: 24 }]} />
    </Card.Footer>
</Card>
```

---

### 5. Component Customization System

#### CSS Variables for Theming

```css
/* frontend/src/styles/variables.css */
:root {
    /* Colors */
    --color-bg-primary: #0f172a;
    --color-bg-secondary: #1e293b;
    --color-bg-card: #1e293b;
    --color-border: #334155;
    --color-text-primary: #f1f5f9;
    --color-text-secondary: #94a3b8;
    --color-accent: #38bdf8;
    
    /* Spacing */
    --spacing-xs: 0.25rem;
    --spacing-sm: 0.5rem;
    --spacing-md: 1rem;
    --spacing-lg: 1.5rem;
    --spacing-xl: 2rem;
    
    /* Border radius */
    --radius-sm: 0.375rem;
    --radius-md: 0.5rem;
    --radius-lg: 1rem;
    --radius-full: 9999px;
    
    /* Transitions */
    --transition-fast: 150ms ease;
    --transition-normal: 200ms ease;
    --transition-slow: 300ms ease;
}
```

#### TypeScript Configuration Object

```typescript
// frontend/src/config/ui.config.ts
export const uiConfig = {
    /** Default pagination size */
    defaultPageSize: 20,
    
    /** Max items before virtualization kicks in */
    virtualizationThreshold: 100,
    
    /** Debounce delay for search inputs (ms) */
    searchDebounceMs: 300,
    
    /** Default animation duration (ms) */
    animationDuration: 200,
    
    /** Graph visualization defaults */
    graph: {
        maxNodes: 100,
        defaultTopK: 25,
        minEdgeWeight: 0.1,
    },
    
    /** Clustering defaults */
    clustering: {
        defaultAlgorithm: 'louvain',
        defaultMetric: 'jaccard',
        minClusterSize: 2,
    },
} as const;
```

---

### 6. Refactored File Structure

```
frontend/src/
├── components/
│   ├── shared/                  # Reusable UI primitives
│   │   ├── index.ts
│   │   ├── Button/
│   │   ├── Card/
│   │   ├── RangeSlider/
│   │   └── ...
│   ├── features/                # Feature-specific components
│   │   ├── clustering/
│   │   ├── impact-graph/
│   │   └── analysis/
│   └── layout/                  # App layout components
│       ├── AppShell.tsx
│       ├── Sidebar.tsx
│       └── Header.tsx
├── design-tokens/               # Design system constants
│   ├── index.ts
│   ├── colors.ts
│   └── ...
├── config/                      # App configuration
│   ├── ui.config.ts
│   └── api.config.ts
├── hooks/                       # Shared custom hooks
│   ├── useDebounce.ts
│   ├── useLocalStorage.ts
│   └── useMediaQuery.ts
├── utils/                       # Utility functions
│   ├── format.ts
│   ├── validation.ts
│   └── colors.ts
├── types/                       # Shared TypeScript types
│   ├── index.ts
│   └── api.types.ts
└── styles/                      # Global styles
    ├── variables.css
    └── globals.css
```

---

## Migration Plan

### Phase 1: Foundation ✅ COMPLETE
1. ~~Create `design-tokens/` with colors, spacing, typography~~ → Created as `constants/index.ts`
2. ~~Create `config/ui.config.ts` with default values~~ → Defaults in `constants/index.ts`
3. ~~Set up `components/shared/` folder structure~~ → Created as `clustering/ui/`
4. ~~Create barrel exports (`index.ts` files)~~ → Done in `ui/index.ts`

### Phase 2: Core Components ✅ MOSTLY COMPLETE
1. ~~Build `RangeSlider` component with dual handles~~ → Done
2. ~~Build `Button`, `Card`, `Input` components~~ → Done (Button, NumberInput, SearchInput, Select)
3. ~~Build `EmptyState`, `LoadingSpinner` components~~ → Done (EmptyState, Spinner, LoadingState)
4. ❌ Write Storybook stories for each component → Not started

### Phase 3: Migration 🔄 IN PROGRESS
1. ❌ Replace inline styles with design tokens → Partially done in refactored components
2. Swap dual sliders → `RangeSlider` in:
   - ~~`ClusterFilterBar.tsx`~~ ✅ Done
   - `ClusterFilters.tsx` ❌ Still uses inline inputs
   - `ImpactGraph.tsx` ❌ Not migrated
3. ~~Extract repeated patterns into shared components~~ → Done for clustering module
4. ~~Update imports to use barrel exports~~ → Done for `ui/` components

### Phase 4: Polish ❌ NOT STARTED
1. Add component documentation
2. Create usage examples
3. Performance audit (bundle size, rendering)
4. Accessibility audit (ARIA, keyboard navigation)

---

## Files Impacted

| File | Action | Priority | Status |
|------|--------|----------|--------|
| `components/clustering/ui/` | Create component library | High | ✅ Done |
| `components/clustering/constants/` | Create design constants | High | ✅ Done |
| `components/clustering/hooks/` | Create custom hooks | High | ✅ Done |
| `components/clustering/components/ClusterFilterBar.tsx` | Use shared components | High | ✅ Done |
| `components/clustering/components/ClusterModal.tsx` | Use shared components | High | ✅ Done |
| `components/clustering/views/ExcalidrawView.tsx` | Use shared components | High | ✅ Done |
| `components/clustering/views/ProjectCity.tsx` | Use shared components | Medium | ✅ Done |
| `components/clustering/ClusterFilters.tsx` | Refactor to use RangeSlider | High | ❌ Pending |
| `design-tokens/` (new) | Create design system | Medium | ❌ Not started |
| `config/ui.config.ts` (new) | Create configuration | Medium | ❌ Not started |
| `components/shared/` (new) | Global shared components | Medium | ❌ Not started |
| `components/ImpactGraph.tsx` | Use shared components | Medium | ❌ Not started |
| `components/AnalysisDashboard.tsx` | Use shared components | Medium | ❌ Not started |
| `components/RepoList.tsx` | Use shared Card, Button | Low | ❌ Not started |
| `components/FolderTree.tsx` | Use design tokens | Low | ❌ Not started |

---

## Success Criteria

- [x] UI component library created with barrel exports (`clustering/ui/`)
- [x] Design constants centralized (`clustering/constants/`)
- [x] Custom hooks for state management (`clustering/hooks/`)
- [x] `ClusterFilterBar` uses `RangeSlider` component
- [ ] All range filters use single `RangeSlider` component (ClusterFilters.tsx pending)
- [ ] Design tokens migrated to dedicated `design-tokens/` folder
- [ ] Component import from `@/components/shared` works (global shared components)
- [ ] No duplicate UI implementations across features
- [ ] Storybook coverage for all shared components
- [ ] Bundle size impact < 5% increase
- [ ] Accessibility score maintained or improved

---

## Technical Notes

### RangeSlider Implementation Options

1. **Custom implementation**: Full control, more work
2. **react-slider**: Lightweight, customizable
3. **@radix-ui/react-slider**: Accessible, headless
4. **rc-slider**: Feature-rich, larger bundle

**Recommendation**: Use `@radix-ui/react-slider` for accessibility + style flexibility.

### Design Token Consumption

```tsx
// Option A: Direct import
import { colors, spacing } from '@/design-tokens';
const style = { color: colors.primary, padding: spacing[4] };

// Option B: Tailwind with CSS variables
<div className="text-[var(--color-accent)] p-[var(--spacing-md)]">

// Option C: Custom utility (recommended)
import { cn, tokens } from '@/utils/styles';
<div className={cn('rounded-lg', tokens.bg.card, tokens.p.md)}>
```

---

## References

- Current constants: `components/clustering/constants/index.ts`
- Current types: `components/clustering/types.ts`
- Existing hooks: `components/clustering/hooks/useSnapshots.ts`
- Design inspiration: shadcn/ui, Radix Themes
