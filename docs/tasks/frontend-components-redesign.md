# Task: Frontend Components Redesign

**Status:** TODO  
**Priority:** High  

---

## Overview

A comprehensive redesign of the frontend architecture to improve reusability, consistency, and developer experience. This task introduces a **global shared component library**, unified design patterns, simplified APIs, and better customization support across **all application features**.

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

## TODO: Implementation Plan

### Phase 1: Foundation (Design System)
- [ ] Create `design-tokens/` folder with colors, spacing, typography modules
- [ ] Create `config/ui.config.ts` with default UI values
- [ ] Create `styles/variables.css` with CSS custom properties
- [ ] Set up path alias `@/` for cleaner imports

### Phase 2: Global Shared Components
- [ ] Create `components/shared/` folder structure
- [ ] Build core components:
  - [ ] `Button` — Multiple variants (primary, secondary, ghost, danger) and sizes
  - [ ] `Card` — With compound components (Header, Body, Footer)
  - [ ] `Modal` — Dialog with overlay and keyboard handling
  - [ ] `RangeSlider` — Dual-handle range selector (use @radix-ui/react-slider)
  - [ ] `Select` — Dropdown with options
  - [ ] `SearchInput` — Input with search icon and debounce
  - [ ] `NumberInput` — Numeric input with min/max/step
  - [ ] `StatCard` — Statistics display card
  - [ ] `EmptyState` — Empty state placeholder with icon and action
  - [ ] `LoadingSpinner` — Loading indicator
  - [ ] `ErrorBanner` — Error message display
  - [ ] `Badge` — Small label/tag component
  - [ ] `ProgressBar` — Progress indicator
- [ ] Create barrel exports (`index.ts`) for all shared components
- [ ] Add TypeScript types for all component props

### Phase 3: Global Migration
- [ ] Migrate all features to use `@/components/shared`:
  - [ ] `components/clustering/` — Replace local `ui/` with shared components
  - [ ] `components/ImpactGraph.tsx` — Use shared Button, RangeSlider, Card
  - [ ] `components/AnalysisDashboard.tsx` — Use shared StatCard, Button, Modal
  - [ ] `components/RepoList.tsx` — Use shared Card, Button, EmptyState
  - [ ] `components/FolderTree.tsx` — Use design tokens for colors/spacing
  - [ ] `components/CreateRepoModal.tsx` — Use shared Modal, Button, Input
  - [ ] `components/ErrorNotification.tsx` — Use shared ErrorBanner
- [ ] Replace all inline styles with design tokens
- [ ] Replace all dual sliders with single `RangeSlider` component
- [ ] Update imports to use barrel exports

### Phase 4: Shared Hooks
- [ ] Create `hooks/` folder at root level for shared hooks:
  - [ ] `useDebounce` — Debounced value
  - [ ] `useLocalStorage` — Persistent state
  - [ ] `useMediaQuery` — Responsive breakpoints
  - [ ] `useClickOutside` — Click outside detection
- [ ] Migrate feature-specific hooks that are reusable

### Phase 5: Polish
- [ ] Add component documentation (JSDoc comments)
- [ ] Set up Storybook for component catalog
- [ ] Write Storybook stories for all shared components
- [ ] Performance audit (bundle size, rendering)
- [ ] Accessibility audit (ARIA, keyboard navigation)

---

## Files to Create

| File/Folder | Description | Priority |
|-------------|-------------|----------|
| `design-tokens/index.ts` | Barrel export for design tokens | High |
| `design-tokens/colors.ts` | Color palette and semantic colors | High |
| `design-tokens/spacing.ts` | Spacing scale | High |
| `design-tokens/typography.ts` | Font sizes, weights, line heights | High |
| `design-tokens/borders.ts` | Border radii and widths | Medium |
| `design-tokens/shadows.ts` | Shadow definitions | Medium |
| `design-tokens/animations.ts` | Transitions and easing | Medium |
| `config/ui.config.ts` | UI configuration constants | High |
| `styles/variables.css` | CSS custom properties | High |
| `components/shared/index.ts` | Barrel export for shared components | High |
| `components/shared/Button/` | Button component | High |
| `components/shared/Card/` | Card component | High |
| `components/shared/Modal/` | Modal component | High |
| `components/shared/RangeSlider/` | Dual-handle range slider | High |
| `components/shared/Input/` | Input components (Text, Number, Search) | High |
| `components/shared/DataDisplay/` | StatCard, Badge, ProgressBar | Medium |
| `components/shared/Feedback/` | EmptyState, Spinner, ErrorBanner | Medium |
| `components/shared/Filters/` | FilterPanel, FilterChip | Medium |
| `components/shared/Layout/` | PageHeader, Section, Grid | Low |
| `hooks/useDebounce.ts` | Debounce hook | Medium |
| `hooks/useLocalStorage.ts` | LocalStorage hook | Medium |

---

## Files to Migrate

| File | Changes Required | Priority |
|------|------------------|----------|
| `components/clustering/` | Replace local `ui/` imports with `@/components/shared` | High |
| `components/ImpactGraph.tsx` | Use shared RangeSlider, Button, Card | High |
| `components/AnalysisDashboard.tsx` | Use shared StatCard, Button, Modal | High |
| `components/RepoList.tsx` | Use shared Card, Button, EmptyState | Medium |
| `components/FolderTree.tsx` | Use design tokens | Medium |
| `components/CreateRepoModal.tsx` | Use shared Modal, Button | Medium |
| `components/AlgorithmInfoModal.tsx` | Use shared Modal | Medium |
| `components/ErrorNotification.tsx` | Use shared ErrorBanner styles | Low |

---

## Success Criteria

- [ ] Global `components/shared/` library created with barrel exports
- [ ] Design tokens in dedicated `design-tokens/` folder
- [ ] CSS variables defined in `styles/variables.css`
- [ ] Component imports work via `@/components/shared`
- [ ] All features use shared components (no duplicate implementations)
- [ ] All range filters use single `RangeSlider` component
- [ ] Shared hooks available via `@/hooks`
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

- Design inspiration: shadcn/ui, Radix Themes, Tailwind UI
- Accessibility: @radix-ui/react-slider, @headlessui/react
- Storybook: https://storybook.js.org/
