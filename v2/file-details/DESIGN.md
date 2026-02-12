# File Details & Files View — Comprehensive Design

> **Status**: Target design — no backward compatibility required.  
> **Scope**: File Details panel, Files list page, shared filter system, time-aware charts.  
> **Goal**: Best-in-class UX for understanding large projects (10k+ files, 100k+ commits).

---

## Table of Contents

1. [Problems with Current Implementation](#1-problems-with-current-implementation)
2. [File Details Panel — Redesign](#2-file-details-panel--redesign)
3. [Time-Aware Charts System](#3-time-aware-charts-system)
4. [Files List Page — Redesign](#4-files-list-page--redesign)
5. [Unified Filter System](#5-unified-filter-system)
6. [Backend API Redesign](#6-backend-api-redesign)
7. [Layout & Scroll Fix](#7-layout--scroll-fix)
8. [Implementation File Map](#8-implementation-file-map)

---

## 1. Problems with Current Implementation

### 1.1 Double Scroll Bug
The main content wrapper in `AnalysisDashboard.tsx` uses `min-h-[calc(100vh-60px)]` which allows the body to scroll independently from the inner panel scroll (`FileDetailsPanel` and `FolderTree` both have `overflow-auto`), producing two nested scrollbars.

### 1.2 Charts Are Not Time-Aware
`FileActivityTab.tsx` renders bar charts bucketed by period (daily/weekly/monthly) but:
- The x-axis is categorical, not a continuous date scale — gaps with no activity are hidden.
- No zoom/pan interaction (no mouse-select range, no scroll-zoom).
- Default scale doesn't auto-adapt to the data range (e.g., shows empty "last month" when last activity was a year ago).

### 1.3 Filter Fragmentation
Three independent filter implementations exist:
- `stores/filterStore.tsx` — global filters (date range, coupling, churn, author, file, risk).
- `features/git/clustering/hooks/useClusterFilters.ts` — cluster-specific filters.
- `features/git/FolderTree.tsx` — inline quick-filter chips (`hot`, `stable`, `recent`, `coupled`, `risky`).

They don't share UI components, state shape, or URL sync. Filters reset on navigation.

### 1.4 Limited File Details Insights
- Risk score is a single number with no drill-down.
- No temporal context — you can't see *when* risk increased.
- Coupling tab shows a static mini-graph, no timeline of coupling evolution.
- No "bus factor" or knowledge-silo detection per file.

### 1.5 Files List Missing Advanced Filters
`FolderTree.tsx` quick-filters are hardcoded chips. No search bar, no date-range filter, no creation-date filter, no multi-select author filter. No way to combine filters with AND/OR logic.

---

## 2. File Details Panel — Redesign

### 2.1 New Tab Structure

Keep 5 tabs but restructure content:

| Tab | Current | Target |
|-----|---------|--------|
| **Activity** | Bar chart + heatmap + day/hour matrix | **Time-aware timeline** (continuous x-axis, zoom/pan) + sparkline heatmap + day/hour matrix |
| **Authors** | Donut + flat table | **Ownership timeline** (stacked area over time) + bus-factor indicator + knowledge-map |
| **Coupling** | Mini radial graph + table | **Coupling timeline** (when coupling appeared/grew) + interactive force graph + actionable recommendations |
| **Commits** | Searchable list | **Commit timeline** (visual density strip) + searchable list + diff-stat sparklines |
| **Insights** | Static risk card | **Dynamic risk breakdown** (risk-over-time chart, contributing factors with weights, trend arrows) |

### 2.2 Activity Tab — Detailed Design

**Replace**: The categorical bar chart in `FileActivityTab.tsx`.

**New component**: `<TimelineChart>` (reusable, see §3).

```
┌─────────────────────────────────────────────────────────┐
│  [Commits ▾]  [Lines Changed]  [Authors]    🔍 Zoom Reset│
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  ╭──╮       ╭╮    ╭───╮              ╭╮         │   │  ← Continuous time x-axis
│  │──╯  ╰───────╯╰────╯   ╰──────────────╯╰─────── │   │  ← Gaps shown proportionally
│  │ Jan    Mar     May    Jul    Sep    Nov    Jan   │   │
│  └──────────────────────────────────────────────────┘   │
│  ◄══════════════════[████████]══════════════════════►   │  ← Brush range selector
│                                                          │
│  ┌─ Heatmap Calendar ──────────────────────────────┐   │
│  │  Mon ░░▓▓░░░░▓░░▓▓▓░░░░░░▓▓░░░░░▓░░░▓▓░░░░░░ │   │
│  │  Wed ░░░▓░░░░░░▓▓░░░░░░░░░▓▓░░░░░░▓▓░░░░░░░░ │   │
│  │  Fri ░▓▓▓▓░░░░▓▓░▓▓░░░░░░▓░░░░░░▓▓▓░░░░░░░░ │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─ Day/Hour Matrix ───────────────────────────────┐   │
│  │       00  03  06  09  12  15  18  21            │   │
│  │  Mon  ░░  ░░  ░▓  ▓▓  ▓▓  ▓░  ░░  ░░          │   │
│  │  ...                                             │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Key behaviors**:
- X-axis: continuous `d3.scaleTime()` — empty periods show as flat line/gap, not hidden.
- Default scale: auto-detect to show last meaningful activity window. Logic: if activity in last 30 days → show 1 month. Else, zoom out to include last activity (last 3 months, 6 months, 1 year, all-time).
- Zoom: mouse wheel zoom on chart area, click-drag to select range.
- Brush: dedicated range-selector bar below chart for precise control.
- Metric toggle: switch y-axis between commits, lines changed, author count.
- The heatmap calendar and day/hour matrix should respect the selected time range.

### 2.3 Authors Tab — Detailed Design

**Replace**: Static donut + flat table in `FileAuthorsTab.tsx`.

```
┌─────────────────────────────────────────────────────────┐
│  ┌─ Ownership Timeline (stacked area) ─────────────┐   │
│  │  ████████████████████████████████████████████████ │   │  ← Each color = author
│  │  ████▓▓▓▓████████▓▓▓▓▓▓████████████████████████ │   │
│  │  Jan    Mar    May    Jul    Sep    Nov    Jan   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Bus Factor: ⚠️ 1  (alice owns 78% of recent changes)   │
│  Knowledge Silos: 2 authors have exclusive sections      │
│                                                          │
│  ┌─ Author Breakdown ──────────────────────────────┐   │
│  │  👤 alice    ████████████░░  234 commits  62%   │   │
│  │  👤 bob      ████░░░░░░░░░░   89 commits  24%   │   │
│  │  👤 charlie  ██░░░░░░░░░░░░   53 commits  14%   │   │
│  │  ──────────────────────────────────────────────── │   │
│  │  First: 2023-01-15  Last: 2026-02-01  Age: 3.1y │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**New**: Bus-factor indicator + knowledge-silo detection. Computed server-side.

### 2.4 Coupling Tab — Detailed Design

**Replace**: Static mini radial graph in `FileCouplingTab.tsx`.

```
┌─────────────────────────────────────────────────────────┐
│  ┌─ Coupling Evolution (line chart, time-aware) ───┐   │
│  │  ╭──╮       ╭──────────────╮                     │   │
│  │──╯  ╰───────╯              ╰─────────────────── │   │  ← # of coupled files over time
│  │ Q1'24   Q2'24   Q3'24   Q4'24   Q1'25   Q2'25  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─ Top Coupled Files ─────────────────────────────┐   │
│  │  src/api/auth.ts      ████████░░  0.82 (strong) │   │  ← Click to navigate
│  │  src/models/user.ts   █████░░░░░  0.61 (medium) │   │
│  │  src/utils/token.ts   ███░░░░░░░  0.43 (weak)   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  💡 Recommendation: auth.ts and user.ts changed         │
│     together 82% of the time. Consider merging or       │
│     extracting shared logic.                             │
└─────────────────────────────────────────────────────────┘
```

**New**: Coupling evolution over time + actionable AI-generated recommendations.

### 2.5 Insights Tab — Detailed Design

**Replace**: Static risk card in `FileInsightsTab.tsx`.

```
┌─────────────────────────────────────────────────────────┐
│  Risk Score: 7.2/10  ▲ +1.3 (last 90 days)             │
│                                                          │
│  ┌─ Risk Over Time ────────────────────────────────┐   │
│  │  ────────────╭──────────────╭──────────▶        │   │  ← Trend line
│  │  Jan   Mar   May   Jul   Sep   Nov   Jan        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─ Contributing Factors ──────────────────────────┐   │
│  │  Churn Rate     ████████████░  High    (×3.2)   │   │  ← Weight contribution
│  │  Coupling       ████████░░░░░  Medium  (×2.1)   │   │
│  │  Bus Factor     ██████░░░░░░░  Medium  (×1.8)   │   │
│  │  File Size      ███░░░░░░░░░░  Low     (×1.1)   │   │
│  │  Age            ██░░░░░░░░░░░  Low     (×0.9)   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  📋 Actionable Recommendations:                         │
│  1. Reduce coupling with auth.ts (changed together 82%) │
│  2. Increase bus factor — only 1 active contributor     │
│  3. Churn rate 3.2× average — consider stabilization   │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Time-Aware Charts System

### 3.1 Reusable `<TimelineChart>` Component

> **CREATE**: `src/frontend/src/shared/charts/TimelineChart.tsx`

A single, reusable time-series chart component used across all tabs and views.

**Props interface**:
```typescript
interface TimelineChartProps {
  data: TimeSeriesPoint[];          // { date: string; value: number; series?: string }
  chartType: 'area' | 'bar' | 'line' | 'stacked-area';
  xDomain?: [Date, Date];          // Override auto-detected range
  yLabel?: string;
  series?: SeriesConfig[];          // Multi-series (e.g., authors stacked area)
  brushEnabled?: boolean;           // Range selector below chart
  zoomEnabled?: boolean;            // Mouse wheel + drag-select zoom
  onRangeChange?: (range: [Date, Date]) => void;  // Callback for linked views
  height?: number;
  colorScheme?: string[];
}
```

**Implementation with D3** (project already uses D3 v7.9.0):
- `d3.scaleTime()` for continuous x-axis.
- `d3.brushX()` for range selection.
- `d3.zoom()` for wheel-zoom and drag-pan.
- Auto-scale: detect data range, pick default view window:
  - Last 30 days if active. Else expand to include last activity.
  - Minimum 7 days visible to prevent over-zoom.

**Auto-scale algorithm**:
```
1. Find lastActivityDate from data
2. If (now - lastActivityDate) < 30 days → show last 30 days
3. Else if < 90 days → show last 90 days
4. Else if < 365 days → show last 12 months
5. Else → show all time
6. Always include lastActivityDate in visible range
```

### 3.2 Reusable `<HeatmapCalendar>` Component

> **CREATE**: `src/frontend/src/shared/charts/HeatmapCalendar.tsx`

GitHub-contribution-style calendar. Already partially exists inline in `FileActivityTab.tsx` — extract and enhance.

### 3.3 Reusable `<DayHourMatrix>` Component

> **CREATE**: `src/frontend/src/shared/charts/DayHourMatrix.tsx`

Extract from `FileActivityTab.tsx`. Add: time-range filtering support (only show matrix for selected period).

### 3.4 Files to Delete / Rewrite

| Action | File | Reason |
|--------|------|--------|
| **REWRITE** | `src/frontend/src/features/git/file-details/FileActivityTab.tsx` | Replace inline chart code with `<TimelineChart>` + `<HeatmapCalendar>` + `<DayHourMatrix>` |
| **REWRITE** | `src/frontend/src/features/git/file-details/FileAuthorsTab.tsx` | Replace static donut with stacked `<TimelineChart>` + bus-factor card |
| **REWRITE** | `src/frontend/src/features/git/file-details/FileCouplingTab.tsx` | Replace mini radial with coupling evolution `<TimelineChart>` + interactive list |
| **REWRITE** | `src/frontend/src/features/git/file-details/FileInsightsTab.tsx` | Replace static card with risk-over-time `<TimelineChart>` + factor breakdown |
| **REWRITE** | `src/frontend/src/features/git/file-details/FileCommitsTab.tsx` | Add commit-density timeline strip above existing list |

---

## 4. Files List Page — Redesign

### 4.1 Current State

`FolderTree.tsx` (~1000+ lines) is a monolith: tree rendering, quick filters, context menu, hover info, settings — all in one file.

### 4.2 Target Architecture

Split into composable components:

```
/features/git/files/
├── FilesPage.tsx              ← Page container (layout, data fetching)
├── FilesToolbar.tsx           ← Search bar + filter chips + view toggle
├── FilesTree.tsx              ← Tree/list rendering (extracted from FolderTree)
├── FilesTable.tsx             ← Table view (sortable columns, NEW)
├── FileRow.tsx                ← Single file row (shared between tree/table)
├── FileContextMenu.tsx        ← Right-click menu (extracted)
└── hooks/
    └── useFilesFilters.ts     ← Filter state (uses shared filter system §5)
```

### 4.3 Advanced Search & Filters

```
┌─────────────────────────────────────────────────────────────────────┐
│  🔍 [Search files by path, name, extension...          ]  [⚙ Advanced] │
│                                                                      │
│  Quick: [🔥 Hot] [📌 Stable] [🕐 Recent] [🔗 Coupled] [⚠ Risky]  │
│                                                                      │
│  Active filters: [ext:.ts ×] [authors≥3 ×] [changed:last 90d ×]    │
│  ─────────────────────────────────────────────────────────────────── │
│  ┌─ Advanced Filters (collapsible) ────────────────────────────┐    │
│  │                                                              │    │
│  │  Date Range        [Last changed ▾] [2025-01-01] → [now]   │    │
│  │  Creation Date     [Created after ▾] [________]             │    │
│  │  Authors           [🔍 alice, bob    ▾] (multi-select)      │    │
│  │  Extension         [.ts, .tsx, .py   ▾] (multi-select)      │    │
│  │  Folder            [src/features/    ▾] (path autocomplete) │    │
│  │  Commits           [min: 5] [max: ___]                      │    │
│  │  Churn Rate        [──●────────────] 0 — 10                 │    │
│  │  Coupling Score    [────●──────────] 0.0 — 1.0              │    │
│  │  Risk Score        [──────────●────] 0 — 10                 │    │
│  │  File Size (LOC)   [min: ___] [max: ___]                    │    │
│  │                                                              │    │
│  │  [Apply]  [Reset]  [Save as preset ▾]                       │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  View: [🌲 Tree] [📋 Table]     Sort: [Risk ▾] [↓]    532 files   │
│  ═══════════════════════════════════════════════════════════════════ │
│  📁 src/features/                                                    │
│    📄 auth.ts        234 commits  3 authors  risk: 7.2  ▲ +1.3     │
│    📄 user.ts        189 commits  5 authors  risk: 5.1  ─          │
│    ...                                                               │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.4 Key UX Improvements

1. **Full-text search**: Fuzzy match on file path. Instant results (client-side filter on already-loaded tree).
2. **Filter chips**: Active filters shown as removable badges. Click to edit.
3. **URL sync**: All filters serialized to URL query params. Shareable links, back/forward navigation preserves filters.
4. **Table view**: Alternative to tree — sortable columns (name, commits, churn, risk, last changed, authors). Better for scanning large result sets.
5. **Pagination/virtualization**: For repos with 10k+ files, use `react-window` or virtual scrolling. Don't render 10k DOM nodes.
6. **Sticky toolbar**: Search bar and quick-filters stay visible while scrolling results.

### 4.5 Files to Delete / Rewrite

| Action | File | Reason |
|--------|------|--------|
| **DELETE** | `src/frontend/src/features/git/FolderTree.tsx` | Monolith (1000+ lines). Replace with modular `files/` directory above. |
| **REWRITE** | `src/frontend/src/features/git/FileDetailsPanel.tsx` | Extract panel chrome, tab routing into smaller files. Content tabs already separate. |

---

## 5. Unified Filter System

### 5.1 Problem

Three separate filter systems (global, cluster, folder-tree) with different state shapes, different UIs, no URL sync, no composition.

### 5.2 Target: Single Filter Engine

> **CREATE**: `src/frontend/src/shared/filters/`

```
shared/filters/
├── FilterEngine.ts            ← Core filter logic (pure functions, no UI)
├── FilterContext.tsx           ← React context + provider
├── useFilters.ts              ← Hook: read/write filters, derived state
├── useFilterURL.ts            ← Hook: bidirectional URL ↔ filter sync
├── FilterBar.tsx              ← Quick filter chips (reusable)
├── AdvancedFiltersPanel.tsx   ← Collapsible advanced filters (reusable)
├── FilterPresets.ts           ← Preset definitions + save/load
├── SearchInput.tsx            ← Full-text search with debounce
└── types.ts                   ← Shared filter types
```

### 5.3 Filter Types (unified)

```typescript
// shared/filters/types.ts

interface FilterState {
  // Text search
  search: string;

  // Quick filters (toggles)
  quickFilters: Set<'hot' | 'stable' | 'recent' | 'coupled' | 'risky'>;

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

interface DateRange { from: Date | null; to: Date | null; }
interface NumberRange { min: number | null; max: number | null; }
```

### 5.4 URL Serialization

Every filter maps to a URL query param:
```
/repos/myproject/git/files?q=auth&quick=hot,risky&ext=.ts,.tsx&risk=5-10&sort=risk&order=desc
```

The `useFilterURL` hook reads/writes URL params bidirectionally, enabling:
- Shareable filtered views via URL.
- Browser back/forward preserves filter state.
- Deep-links from other pages (e.g., "show me all risky TypeScript files").

### 5.5 Files to Delete

| Action | File | Reason |
|--------|------|--------|
| **DELETE** | `src/frontend/src/stores/filterStore.tsx` | Replace with `shared/filters/FilterContext.tsx`. Old store has no URL sync, no composition, different types. |
| **DELETE** | `src/frontend/src/shared/GlobalFiltersPanel.tsx` | Replace with `shared/filters/AdvancedFiltersPanel.tsx`. |
| **DELETE** | `src/frontend/src/features/git/clustering/hooks/useClusterFilters.ts` | Cluster views should use the unified filter system with cluster-specific filter keys. |
| **DELETE** | `src/frontend/src/features/git/clustering/ui/ClusterFilters.tsx` | Replace with shared `FilterBar` + `AdvancedFiltersPanel`. |

---

## 6. Backend API Redesign

### 6.1 Current Issues

- `get_file_details()` in `src/git-analyzer/git_analyzer/api.py` returns a flat dict with 18 fields. No temporal data, no risk breakdown, no bus factor.
- Activity/authors/commits are separate endpoints with no time-range filtering — the frontend fetches everything and filters client-side.
- No endpoint for coupling evolution over time.
- No endpoint for risk breakdown (contributing factors).

### 6.2 New/Modified Endpoints

#### 6.2.1 Enhanced File Details

> **REWRITE**: `GET /repos/{repo_id}/git/files/{path}/details`

**New response schema** (replaces old flat dict):

```python
# src/platform/code_intel/routers/git.py — new Pydantic model

class FileDetailsResponse(BaseModel):
    file_id: int
    path: str
    exists_at_head: bool

    # Summary stats
    total_commits: int
    total_authors: int
    first_commit_date: str
    last_commit_date: str
    age_days: int
    lines_added: int
    lines_deleted: int

    # Churn
    churn_rate: float            # relative to repo average
    churn_trend: str             # "increasing" | "decreasing" | "stable"

    # Coupling
    coupled_files_count: int
    max_coupling_score: float
    avg_coupling_score: float

    # Risk (NEW: breakdown)
    risk_score: float
    risk_trend: float            # delta over last 90 days
    risk_factors: list[RiskFactor]

    # Bus factor (NEW)
    bus_factor: int              # number of authors owning >80% recent changes
    knowledge_silos: list[str]   # authors with exclusive file sections

class RiskFactor(BaseModel):
    name: str                    # "churn_rate" | "coupling" | "bus_factor" | "file_size" | "age"
    score: float                 # 0-10
    weight: float                # contribution to total risk
    label: str                   # "High" | "Medium" | "Low"
    description: str             # human-readable explanation
```

> **REWRITE**: `src/git-analyzer/git_analyzer/api.py` → `get_file_details()` to compute risk factors, bus factor, knowledge silos, churn trend.

#### 6.2.2 Time-Range Filtered Activity

> **MODIFY**: `GET /repos/{repo_id}/git/files/{path}/activity`

Add query params:
```
?from=2025-01-01&to=2026-01-01&granularity=weekly
```

Current implementation loads all data. New: filter at the Parquet/SQL level for performance on large repos.

> **REWRITE**: `src/git-analyzer/git_analyzer/api.py` → `get_file_activity()` to accept `from_date`, `to_date`, `granularity` params and push filtering to query level.

#### 6.2.3 Coupling Evolution (NEW)

> **CREATE**: `GET /repos/{repo_id}/git/files/{path}/coupling/timeline`

```python
class CouplingTimelineResponse(BaseModel):
    periods: list[CouplingPeriod]

class CouplingPeriod(BaseModel):
    date: str
    coupled_files_count: int
    max_coupling_score: float
    avg_coupling_score: float
    new_couplings: int           # files that became coupled in this period
    removed_couplings: int       # files that decoupled
```

> **CREATE**: New method in `src/git-analyzer/git_analyzer/api.py` → `get_coupling_timeline()`.

#### 6.2.4 Risk Timeline (NEW)

> **CREATE**: `GET /repos/{repo_id}/git/files/{path}/risk/timeline`

```python
class RiskTimelineResponse(BaseModel):
    points: list[RiskTimelinePoint]

class RiskTimelinePoint(BaseModel):
    date: str
    risk_score: float
    factors: dict[str, float]    # factor_name → score at that point
```

> **CREATE**: New method in `src/git-analyzer/git_analyzer/api.py` → `get_risk_timeline()`.

#### 6.2.5 Enhanced Authors with Bus Factor

> **MODIFY**: `GET /repos/{repo_id}/git/files/{path}/authors`

Add to response:
```python
class FileAuthorsResponse(BaseModel):
    authors: list[FileAuthor]
    bus_factor: int
    ownership_timeline: list[OwnershipPeriod]  # for stacked area chart

class OwnershipPeriod(BaseModel):
    date: str
    contributions: dict[str, int]  # author_name → commit_count in period
```

### 6.3 Frontend Type Updates

> **REWRITE**: `src/frontend/src/api/git.ts`

Update all TypeScript interfaces to match new backend schemas. Remove old transformation hacks (e.g., the field-mapping in `getDashboardSummary()`). Backend should return the exact shape the frontend needs.

### 6.4 Interface Updates

> **REWRITE**: `src/code-intel-interfaces/code_intel_interfaces/git_analyzer.py`

Update abstract method signatures to include new parameters and return types.

---

## 7. Layout & Scroll Fix

### 7.1 Root Cause

In `src/frontend/src/features/git/AnalysisDashboard.tsx` (or equivalent layout wrapper):

```tsx
// CURRENT (broken):
<div className="min-h-[calc(100vh-60px)]">
  {renderContent()}
</div>

// TARGET (fixed):
<div className="h-[calc(100vh-60px)] overflow-hidden flex flex-col">
  {renderContent()}  {/* Each view manages its own scroll */}
</div>
```

### 7.2 Scroll Ownership Rules

| Component | Scroll behavior |
|-----------|----------------|
| **AnalysisDashboard** (main wrapper) | `overflow: hidden` — never scrolls |
| **FilesPage** | `overflow-y: auto` on the file list area only. Toolbar is sticky. |
| **FileDetailsPanel** | `overflow-y: auto` on tab content area only. Header + tabs are sticky. |
| **Each tab content** | Natural document flow inside the scrollable tab area. No inner scroll. |

> **EDIT**: `src/frontend/src/features/git/AnalysisDashboard.tsx` — change `min-h-` to `h-` + `overflow-hidden`.

---

## 8. Implementation File Map

### 8.1 Files to CREATE

| Path | Purpose |
|------|---------|
| `src/frontend/src/shared/charts/TimelineChart.tsx` | Reusable D3 time-aware chart with zoom/pan/brush |
| `src/frontend/src/shared/charts/HeatmapCalendar.tsx` | GitHub-style contribution calendar |
| `src/frontend/src/shared/charts/DayHourMatrix.tsx` | Day × Hour activity matrix |
| `src/frontend/src/shared/charts/types.ts` | Shared chart types (TimeSeriesPoint, SeriesConfig, etc.) |
| `src/frontend/src/shared/filters/FilterEngine.ts` | Pure filter logic |
| `src/frontend/src/shared/filters/FilterContext.tsx` | React context + provider |
| `src/frontend/src/shared/filters/useFilters.ts` | Filter read/write hook |
| `src/frontend/src/shared/filters/useFilterURL.ts` | URL ↔ filter bidirectional sync |
| `src/frontend/src/shared/filters/FilterBar.tsx` | Quick filter chips UI |
| `src/frontend/src/shared/filters/AdvancedFiltersPanel.tsx` | Collapsible advanced filters UI |
| `src/frontend/src/shared/filters/FilterPresets.ts` | Preset save/load logic |
| `src/frontend/src/shared/filters/SearchInput.tsx` | Debounced search input |
| `src/frontend/src/shared/filters/types.ts` | Filter type definitions |
| `src/frontend/src/features/git/files/FilesPage.tsx` | Files page container |
| `src/frontend/src/features/git/files/FilesToolbar.tsx` | Search + filter bar |
| `src/frontend/src/features/git/files/FilesTree.tsx` | Tree view |
| `src/frontend/src/features/git/files/FilesTable.tsx` | Table view (NEW) |
| `src/frontend/src/features/git/files/FileRow.tsx` | Shared file row component |
| `src/frontend/src/features/git/files/FileContextMenu.tsx` | Context menu |
| `src/frontend/src/features/git/files/hooks/useFilesFilters.ts` | Files-specific filter config |

### 8.2 Files to REWRITE (full replacement)

| Path | What changes |
|------|-------------|
| `src/frontend/src/features/git/file-details/FileActivityTab.tsx` | Use `<TimelineChart>`, `<HeatmapCalendar>`, `<DayHourMatrix>` |
| `src/frontend/src/features/git/file-details/FileAuthorsTab.tsx` | Stacked area `<TimelineChart>` + bus factor |
| `src/frontend/src/features/git/file-details/FileCouplingTab.tsx` | Coupling evolution `<TimelineChart>` + interactive list |
| `src/frontend/src/features/git/file-details/FileInsightsTab.tsx` | Risk timeline + factor breakdown |
| `src/frontend/src/features/git/file-details/FileCommitsTab.tsx` | Add density strip, keep searchable list |
| `src/frontend/src/features/git/FileDetailsPanel.tsx` | Simplify, fix scroll, use new tab components |
| `src/frontend/src/api/git.ts` | New TypeScript interfaces matching new backend schemas |
| `src/git-analyzer/git_analyzer/api.py` | New methods + enhanced `get_file_details()` |
| `src/platform/code_intel/routers/git.py` | New endpoints + Pydantic models |
| `src/code-intel-interfaces/code_intel_interfaces/git_analyzer.py` | Updated abstract methods |

### 8.3 Files to DELETE

| Path | Reason |
|------|--------|
| `src/frontend/src/features/git/FolderTree.tsx` | Replaced by modular `files/` directory |
| `src/frontend/src/stores/filterStore.tsx` | Replaced by `shared/filters/FilterContext.tsx` |
| `src/frontend/src/shared/GlobalFiltersPanel.tsx` | Replaced by `shared/filters/AdvancedFiltersPanel.tsx` |
| `src/frontend/src/features/git/clustering/hooks/useClusterFilters.ts` | Use unified filter system |
| `src/frontend/src/features/git/clustering/ui/ClusterFilters.tsx` | Use unified filter components |

### 8.4 Suggested Implementation Order

1. **Shared charts** (`TimelineChart`, `HeatmapCalendar`, `DayHourMatrix`) — foundation for all tabs.
2. **Layout scroll fix** — quick win, fixes double-scroll immediately.
3. **Unified filter system** (`shared/filters/`) — foundation for files page and all views.
4. **Backend API enhancements** — new endpoints, enhanced schemas.
5. **File Details tabs rewrite** — use new charts + new API data.
6. **Files page rewrite** — use new filter system + modular components.
7. **Migrate cluster views** — adopt unified filter system.

---

*This design prioritizes understanding big projects through time-aware visualizations, actionable insights (bus factor, risk factors), and powerful filtering. All components are reusable, URL-synced, and optimized for 10k+ file repositories.*
