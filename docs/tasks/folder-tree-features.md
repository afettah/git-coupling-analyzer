# Task: Folder Tree Enhancements

**Status:** Proposed  
**Priority:** High  
**Epic:** Repository Exploration & Insights  
**Last Updated:** January 28, 2026

---

## Problem Statement

The current folder tree view is purely structural—it displays files and directories but offers no contextual insights. Developers exploring a codebase cannot quickly identify:
- Which files/folders are frequently modified (hotspots)
- Which areas have been stable vs. volatile
- How files relate to each other through change patterns
- The history and evolution of specific paths

This limits the tool's utility for code reviews, onboarding, and architectural understanding.

---

## Current Implementation Review

### Issues with `FolderTree.tsx`

1. **No Virtualization** — Renders all expanded nodes, problematic for large repos
2. **Recursive Render Function** — `renderNode` creates deep call stacks; should use flat list
3. **No Memoization** — Sort operations run on every render
4. **No Keyboard Navigation** — Missing accessibility (arrow keys, Enter to select)
5. **Inline Styles** — Uses `style={{ paddingLeft }}` instead of CSS variables
6. **No Selection State** — Current selection not visually indicated
7. **No Error Boundary** — API failures silently logged, no user feedback
8. **Minimal Hints** — Only shows `commits` count, no color coding

### Recommended Refactors (Pre-requisite)

Before adding new features, refactor `FolderTree.tsx`:

```typescript
// 1. Flatten tree for virtualization
interface FlatNode {
  id: string;          // full path
  name: string;
  depth: number;
  isDir: boolean;
  isExpanded: boolean;
  isVisible: boolean;  // based on parent expansion
  hints?: FileHints;
}

// 2. Memoize sorted children
const sortedNodes = useMemo(() => flattenTree(tree, expanded), [tree, expanded]);

// 3. Use CSS custom properties for indentation
// .tree-node { padding-left: calc(var(--depth) * 16px + 8px); }

// 4. Add keyboard handler
const handleKeyDown = (e: KeyboardEvent, node: FlatNode) => {
  switch(e.key) {
    case 'ArrowRight': expand(node.id); break;
    case 'ArrowLeft': collapse(node.id); break;
    case 'ArrowDown': focusNext(); break;
    case 'ArrowUp': focusPrev(); break;
    case 'Enter': selectNode(node.id); break;
  }
};

// 5. Add selection visual state
className={cn(
  "tree-node",
  selectedPath === node.id && "bg-slate-700 ring-1 ring-blue-500"
)}
```

---

## Goals

1. **Visual Hints at Every Level** — Surface key metrics inline within the tree structure
2. **Powerful Filtering** — Enable discovery through quick filters and advanced search
3. **Deep File/Folder Insights** — Provide a rich details panel when selecting any node
4. **Correlation Analysis** — Show files that change together with filtering capabilities
5. **Temporal Visualization** — Graph changes over time with multiple view modes
6. **Git History Integration** — IDE-like commit browser with full context
7. **Azure DevOps Integration** — Link commits, work items, and diffs to external tool

---

## Design Decisions

### Data Strategy: Pre-Computed Hints

**Decision:** All hints and metadata are **pre-computed during analysis** and stored in SQLite/Parquet.

**Rationale:**
- Analysis runs are infrequent (on-demand or scheduled), not real-time
- Tree rendering must be instantaneous (<100ms for visible nodes)
- Enables offline/cached browsing without recomputing
- Large repositories (>50k files) require indexed access, not dynamic aggregation
- Folder aggregates can cascade during extraction in O(n) time

**Storage Extensions Required:**
- Add `file_hints` table for per-file pre-computed metrics
- Add `folder_hints` table for aggregated folder metrics
- Add `file_authors` table for author breakdowns per file
- Add `commits_detail` table for full commit metadata (message, refs, etc.)
- Extend `changes` parquet with lines_added/lines_deleted per file per commit

### External Integration

**Decision:** Azure DevOps integration only (configurable per repository).

**Configuration:**
- Store Azure DevOps organization URL and project in `repo_meta`
- Commit links: `{org_url}/{project}/_git/{repo}/commit/{sha}`
- Work item links: Parse `#1234` or `AB#1234` from commit messages
- Diff viewer: Link directly to Azure DevOps commit diff page

**No custom health score formulas** — Use fixed algorithm for consistency.

---

## Feature Specifications

### 1. Visual Hints System 🎯

Each file and folder node in the tree displays contextual visual hints without requiring selection.

#### 1.1 File-Level Hints

| Hint | Icon/Badge | Description | Color Coding |
|------|------------|-------------|--------------|
| **Churn Badge** | 🔥 / number | Total commits touching this file | 🟢 Low (<10), 🟡 Medium (10-50), 🔴 High (>50) |
| **Recency Indicator** | ● dot | Last modification time | 🟢 >6mo, 🟡 1-6mo, 🔴 <1mo, ⚪ >1yr |
| **Coupling Indicator** | 🔗 | Has strong coupling (>0.5 jaccard) | Purple intensity = coupling strength |
| **Author Count** | 👤×N | Number of unique contributors | Subtle gray badge |
| **Lines Changed** | ±N | Net lines added/removed (optional toggle) | Green/Red based on sign |

#### 1.2 Folder-Level Hints (Aggregated)

| Hint | Aggregation | Display |
|------|-------------|---------|
| **Folder Churn** | Sum of child file commits | Badge with total |
| **Active Files Ratio** | Files changed in last 30d / total | Mini progress bar |
| **Hottest File** | File with most commits in folder | Tooltip on hover |
| **Coupling Density** | Avg coupling between files in folder | Colored border |
| **Last Activity** | Most recent change in subtree | Relative date ("2d ago") |

#### 1.3 Visual Design

```
📁 src/                          [142 commits] [85% active] 2d ago
├── 📁 components/               [89 commits] [🔥 hot]
│   ├── 📄 Button.tsx           🔥32  ●  🔗
│   ├── 📄 Modal.tsx            🔥18  ●  
│   └── 📄 Table.tsx            🔥45  ●  🔗🔗
├── 📁 utils/                    [12 commits] [stable]
│   └── 📄 helpers.ts           🔥5   ○
```

**Hint Visibility Options:**
- Toggle hints on/off globally
- Choose which hints to display (user preference panel)
- Density mode: Compact (icons only) | Normal | Detailed (with numbers)

#### 1.4 Implementation Details

**Frontend Component:** `TreeNodeHints.tsx`

```typescript
// Component library: Use Lucide React icons (already in deps)
// Flame, Circle, Link, Users, TrendingUp/TrendingDown icons

interface TreeNodeHintsProps {
  hints: FileHints | FolderHints;
  density: 'compact' | 'normal' | 'detailed';
  visibleHints: Set<HintType>;
}

// Color utility using Tailwind classes:
const churnColor = (count: number) => 
  count > 50 ? 'text-red-400' : count > 10 ? 'text-amber-400' : 'text-emerald-400';

const recencyColor = (daysAgo: number) =>
  daysAgo > 365 ? 'text-slate-600' : daysAgo > 180 ? 'text-emerald-400' : 
  daysAgo > 30 ? 'text-amber-400' : 'text-red-400';
```

**State Management:** Use React Context (`TreePreferencesContext`) for hint visibility settings, persisted to localStorage.

---

### 2. Filtering System 🔍

#### 2.1 Quick Filters (One-Click Toolbar)

Positioned above the tree as pill-shaped toggle buttons:

| Filter | Behavior | Icon |
|--------|----------|------|
| **🔥 Hot Files** | Files with >X commits (configurable threshold) | Fire emoji |
| **❄️ Stable** | Files unchanged in >6 months | Snowflake |
| **🆕 Recently Changed** | Modified in last 7/30/90 days | Clock |
| **🔗 High Coupling** | Files with coupling score >0.3 | Link |
| **👤 My Changes** | Files I (current git user) have touched | Person |
| **⚠️ Risk Files** | High churn + many authors = potential conflicts | Warning |

Quick filters are **additive** (AND logic) and show count badges: `🔥 Hot (47)`

#### 2.2 Advanced Filters Panel

Expandable panel with comprehensive filtering options:

```
┌─────────────────────────────────────────────────────────────┐
│ 🔧 Advanced Filters                              [Clear All]│
├─────────────────────────────────────────────────────────────┤
│ 📅 Time Window                                              │
│   ○ All time  ○ Last year  ○ Last 6mo  ○ Last 30d          │
│   ○ Custom: [____] to [____]                               │
├─────────────────────────────────────────────────────────────┤
│ 👤 Author Filter                                            │
│   [Search authors...              ▼]                        │
│   ☑ Include  ○ Exclude                                      │
├─────────────────────────────────────────────────────────────┤
│ 📄 File Types                                               │
│   [x] .ts  [x] .tsx  [ ] .css  [x] .py  [ ] .json          │
│   [+ Add extension...]                                      │
├─────────────────────────────────────────────────────────────┤
│ 📊 Churn Thresholds                                         │
│   Min commits: [___5__]  Max commits: [__100_]             │
├─────────────────────────────────────────────────────────────┤
│ 🔗 Coupling Criteria                                        │
│   Min coupling score: [===●========] 0.25                   │
│   Coupled with file: [Search file...              ]         │
├─────────────────────────────────────────────────────────────┤
│ 🏷️ Path Pattern                                             │
│   Include: [src/**/*.ts                    ]                │
│   Exclude: [**/*.test.ts, **/__mocks__/**  ]                │
├─────────────────────────────────────────────────────────────┤
│ 🚫 Change Status                                            │
│   ○ Any  ○ Changed since [date]  ○ NOT changed since [date]│
├─────────────────────────────────────────────────────────────┤
│                              [Apply Filters] [Save as Preset]│
└─────────────────────────────────────────────────────────────┘
```

#### 2.3 Filter Presets

Users can save and share filter configurations:
- `🔖 My Team's Files` — Author filter for team members
- `🔖 Frontend Hot Spots` — .tsx files with high churn
- `🔖 Stale Code` — Not changed in >1 year
- Built-in presets + user-defined

#### 2.4 Search Integration

- **Fuzzy path search**: `btn` matches `Button.tsx`, `btn-group.css`
- **Regex support**: `/.*\.test\.(ts|tsx)$/`
- **Recent searches**: Quick access to previous queries (localStorage)

#### 2.5 Implementation Details

**Frontend Components:**

```typescript
// TreeFilters.tsx - Quick filter toolbar
// Use Lucide icons: Flame, Snowflake, Clock, Link, User, AlertTriangle

interface QuickFilterProps {
  activeFilters: Set<QuickFilterType>;
  filterCounts: Record<QuickFilterType, number>; // Pre-computed from backend
  onToggle: (filter: QuickFilterType) => void;
}

// AdvancedFiltersPanel.tsx - Collapsible panel
// Layout: Use CSS Grid for responsive form layout
// Slider component: HTML5 range input with Tailwind styling (no external lib needed)
// Multi-select: Custom dropdown with checkboxes using Lucide ChevronDown
```

**Filtering Logic:**
- Quick filters use **pre-computed file flags** stored in `file_hints` table
- When quick filter active, API returns only matching file_ids
- Tree component filters visible nodes client-side using the file_id set
- Advanced filters POST to `/repos/{id}/files/filter` → returns filtered file_ids
- Filter application is debounced (300ms) to avoid rapid re-renders

**Performance for Large Repos:**
- Quick filter counts are pre-computed and cached in `repo_meta`
- Filtering returns file_ids only (not full file data)
- Tree virtualization handles rendering (see Section 8)

---

### 3. File/Folder Details Panel 📋

When a file or folder is selected, a slide-out panel (or split view) shows comprehensive information.

#### 3.1 Panel Layout

```
┌─────────────────────────────────────────────────────────────┐
│  📄 src/components/DataTable.tsx                    [✕]     │
│  ─────────────────────────────────────────────────────────  │
│  [Overview] [Correlations] [History] [Graph] [Stats]        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  (Tab content here)                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 3.2 Overview Tab

**Quick Stats Cards:**
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 📝 Commits   │ │ 👥 Authors   │ │ 📅 Last Edit │ │ 📏 Size      │
│    127       │ │    8         │ │    3d ago    │ │  342 LOC     │
│ +12 (30d)    │ │ Top: @smith  │ │ by @jones    │ │ +45 / -12    │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

**File Health Score (Fixed Algorithm):**
```
Health Score: ████████░░ 78/100                    [?]
  ├─ Stability: ████████████ 95%  (low recent churn)
  ├─ Ownership: ██████░░░░░ 60%   (multiple authors)
  ├─ Coupling:  ████████░░░ 80%   (reasonable dependencies)
  └─ Size:      ██████████░ 90%   (within guidelines)
```

**Health Score Algorithm (pre-computed):**
- **Stability (25%)**: `100 - min(100, recent_commits_30d * 10)` — fewer recent changes = higher stability
- **Ownership (25%)**: `100 * (top_author_commits / total_commits)` — single owner = higher clarity
- **Coupling (25%)**: `100 - min(100, strong_coupling_count * 5)` — fewer strong couplings = more isolated
- **Size (25%)**: `100` if LOC < 500, `80` if < 1000, `50` if < 2000, `20` otherwise

**Quick Actions:**
- `📂 Open in Azure DevOps` — Link to file in Azure DevOps (if configured)
- `🔗 Copy Path`
- `📊 Export Stats` — Download JSON/CSV

---

### 4. Correlations Tab (Files That Change Together) 🔗

#### 4.1 Correlated Files List

```
┌─────────────────────────────────────────────────────────────┐
│  🔗 Files Correlated with DataTable.tsx                     │
│  ──────────────────────────────────────────────────────────│
│  Showing files that frequently change together              │
│                                                             │
│  ┌─ Filter Commits ──────────────────────────────────────┐ │
│  │ 📅 Time: [All Time ▼]  👤 Author: [Any ▼]             │ │
│  │ 🏷️ Message contains: [____________]                   │ │
│  │ ☐ Exclude merge commits  ☐ Exclude bot commits        │ │
│  │ 🚫 Exclude commits: [comma-separated SHAs...]         │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  📊 Sorted by: [Coupling Score ▼]  Showing: 25 of 89       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ████████████████████░░░░ 0.85 │ 📄 TableRow.tsx     │   │
│  │   Changed together: 47 times  │  in src/components/ │   │
│  │   Evidence: [View 47 commits]                       │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ ██████████████░░░░░░░░ 0.72 │ 📄 TableHeader.tsx  │   │
│  │   Changed together: 38 times  │  in src/components/ │   │
│  │   Evidence: [View 38 commits]                       │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ ██████████████░░░░░░░░░░ 0.65 │ 📄 useTableData.ts  │   │
│  │   Changed together: 31 times  │  in src/hooks/      │   │
│  │   Evidence: [View 31 commits]                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  💡 Insight: These files likely form a cohesive module.    │
│     Consider grouping them or creating explicit imports.    │
└─────────────────────────────────────────────────────────────┘
```

#### 4.2 Correlation Evidence View

Clicking "View N commits" shows the shared commit history:

```
┌─────────────────────────────────────────────────────────────┐
│  📜 Commits changing both DataTable.tsx and TableRow.tsx    │
│  ──────────────────────────────────────────────────────────│
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 🔵 a1b2c3d  feat: Add sorting to data table           │ │
│  │   📅 2025-01-15  👤 @developer1                       │ │
│  │   Changed: DataTable.tsx (+45/-12), TableRow.tsx (+8) │ │
│  │   [View in Azure DevOps]                              │ │
│  ├───────────────────────────────────────────────────────┤ │
│  │ 🔵 e5f6g7h  fix: Row selection state                  │ │
│  │   📅 2025-01-10  👤 @developer2                       │ │
│  │   Changed: DataTable.tsx (+12/-8), TableRow.tsx (+5)  │ │
│  │   [View in Azure DevOps]                              │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### 4.3 Folder Correlations

For folders, show aggregated correlations (from `component_edges` table):

```
Files in src/components/ are most coupled with:
  📁 src/hooks/           (42% of changes overlap)
  📁 src/types/           (35% of changes overlap)
  📁 src/utils/           (28% of changes overlap)
  
🔗 Cross-folder coupling map: [View Visualization]
```

#### 4.4 Implementation Details

**Data Source:** Coupling data is pre-computed in `edges` table. Evidence commits require joining with `changes` parquet.

**Frontend Component:** `CorrelationsTab.tsx`

```typescript
// Progress bar visualization using inline CSS/Tailwind
// No external charting library needed for simple horizontal bars

const CouplingBar = ({ score }: { score: number }) => (
  <div className="h-2 w-32 bg-slate-700 rounded">
    <div 
      className="h-full bg-purple-500 rounded" 
      style={{ width: `${score * 100}%` }}
    />
  </div>
);
```

**Pagination:** Evidence commits list uses cursor-based pagination (50 per page).

---

### 5. Change Graph Tab 📈

Interactive temporal visualization of file/folder activity.

#### 5.1 Graph Controls

```
┌─────────────────────────────────────────────────────────────┐
│  📈 Change Activity Over Time                               │
│  ──────────────────────────────────────────────────────────│
│  Metric: [● Commit Count ○ Lines Changed ○ Files Touched]   │
│  Granularity: [○ Daily  ● Weekly  ○ Monthly  ○ Quarterly]  │
│  Time Range: [==========●==================] All Time       │
│              Jan 2024              →              Jan 2026  │
└─────────────────────────────────────────────────────────────┘
```

#### 5.2 Graph Visualization

```
Commits │
   50   │                    ▄▄
   40   │              ▄▄    ██  ▄▄
   30   │        ▄▄    ██    ██  ██    ▄▄
   20   │  ▄▄    ██    ██    ██  ██    ██    ▄▄
   10   │  ██    ██    ██    ██  ██    ██    ██    ▄▄
    0   └──────────────────────────────────────────────
          Q1'24  Q2'24  Q3'24  Q4'24  Q1'25  Q2'25  Q3'25
        
        [Click bar for details]  📍 Spike: Q4'24 - Major refactor
```

#### 5.3 Graph Overlays & Comparisons

- **Author breakdown**: Stacked bars by contributor
- **Change type**: Additions vs. deletions (dual-axis)
- **Compare with**: Overlay another file's activity
- **Trend line**: Moving average for pattern detection

#### 5.4 Lines Changed View

```
Lines │ ── Additions  ── Deletions  ── Net
+200  │     ╱╲
+100  │ ──╱  ╲────────────╱╲──────
   0  │─────────────────────────╲───────────────
-100  │                           ╲╱
        Jan     Feb     Mar     Apr     May
```

#### 5.5 Implementation Details

**Charting Library:** **D3.js** (already in dependencies)

D3 is the right choice because:
- Already installed and used in the project
- Full control over SVG rendering for custom visualizations
- Excellent performance with large datasets
- No additional bundle size

**Component Structure:**

```typescript
// GraphTab.tsx
interface GraphTabProps {
  repoId: string;
  path: string;
}

// Use D3 with React refs pattern
const svgRef = useRef<SVGSVGElement>(null);

useEffect(() => {
  if (!data || !svgRef.current) return;
  
  const svg = d3.select(svgRef.current);
  // D3 bar chart implementation
  const xScale = d3.scaleBand().domain(data.map(d => d.period))...
  const yScale = d3.scaleLinear().domain([0, d3.max(data, d => d.value)])...
}, [data]);
```

**Data Source:** Time-series data aggregated from `changes` parquet file during analysis.
Pre-aggregate weekly/monthly buckets into `file_time_series` parquet for instant loading.

---

### 6. Git History Tab 📜

IDE-like commit browser with full context. **Diff viewing links to Azure DevOps**.

#### 6.1 Commit List

```
┌─────────────────────────────────────────────────────────────┐
│  📜 Git History for DataTable.tsx                           │
│  ──────────────────────────────────────────────────────────│
│  🔍 [Search commits...        ]  📅 [Date range ▼]          │
│  👤 [All authors ▼]  🏷️ [Message filter...]                 │
│                                                             │
│  Showing 127 commits                                        │
│                                                             │
│  ┌ Today ────────────────────────────────────────────────┐ │
│  │ 🔵 a1b2c3d  fix: Resolve pagination edge case         │ │
│  │   👤 Sarah Chen  📅 2h ago  📊 +12/-5 lines           │ │
│  ├───────────────────────────────────────────────────────┤ │
│  │ 🔵 f4e5d6c  feat: Add column resize support           │ │
│  │   👤 John Doe    📅 5h ago  📊 +145/-23 lines         │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌ Yesterday ────────────────────────────────────────────┐ │
│  │ 🟢 b7c8d9e  chore: Update dependencies                │ │
│  │   👤 CI Bot      📅 1d ago  📊 +3/-3 lines            │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌ Last Week ────────────────────────────────────────────┐ │
│  │ 🟡 merge!  Merge branch 'feature/tables' into main    │ │
│  │   👤 Tech Lead   📅 5d ago  📊 +892/-124 lines        │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│                    [Load More...]                           │
└─────────────────────────────────────────────────────────────┘
```

#### 6.2 Commit Detail Modal

Clicking a commit opens a detailed view:

```
┌─────────────────────────────────────────────────────────────┐
│  Commit a1b2c3d4e5f6g7h8i9j0                          [✕]  │
├─────────────────────────────────────────────────────────────┤
│  fix: Resolve pagination edge case when data is empty      │
│  ──────────────────────────────────────────────────────────│
│  👤 Author:    Sarah Chen <sarah@example.com>              │
│  📅 Date:      Jan 28, 2026 at 10:32 AM (+01:00)           │
│  🔖 SHA:       a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6           │
│  🏷️ Refs:      HEAD -> main, origin/main                   │
│  🔗 Work Item: AB#1234 (link to Azure DevOps)              │
│                                                             │
│  ──────────────────────────────────────────────────────────│
│  📝 Full Message:                                          │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ fix: Resolve pagination edge case when data is empty  │ │
│  │                                                       │ │
│  │ When the table receives an empty dataset after having │ │
│  │ data, the pagination component would crash due to     │ │
│  │ attempting to access page 1 of 0 pages.              │ │
│  │                                                       │ │
│  │ - Added null check before pagination calculation      │ │
│  │ - Reset to page 0 when data becomes empty            │ │
│  │ - Added unit test for edge case                      │ │
│  │                                                       │ │
│  │ Fixes #1234                                          │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ──────────────────────────────────────────────────────────│
│  📁 Changed Files (4):                                     │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 📄 M  src/components/DataTable.tsx      +12 / -5      │ │
│  │ 📄 M  src/components/Pagination.tsx     +8 / -2       │ │
│  │ 📄 A  src/components/__tests__/DataTable.test.tsx  +45│ │
│  │ 📄 M  CHANGELOG.md                      +3 / -0       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  [View in Azure DevOps] [Copy SHA]                         │
└─────────────────────────────────────────────────────────────┘
```

**Status indicators:**
- `M` = Modified (yellow)
- `A` = Added (green)
- `D` = Deleted (red)
- `R` = Renamed (blue)

#### 6.3 Diff Viewer

**Decision:** No inline diff viewer. All diffs link to **Azure DevOps**.

When Azure DevOps is configured:
- "View in Azure DevOps" button opens: `{org_url}/{project}/_git/{repo}/commit/{sha}`
- Work item links (e.g., `AB#1234`, `#1234`) are clickable: `{org_url}/{project}/_workitems/edit/{id}`

When not configured:
- Show SHA only with copy button
- Display message: "Configure Azure DevOps in repository settings to view diffs"

#### 6.4 Implementation Details

**Data Source:** `commits` parquet + join with `changes` for file list.

**Component:** `HistoryTab.tsx`, `CommitDetailModal.tsx`

```typescript
// Azure DevOps URL builder (utility)
export const buildAzureDevOpsUrl = (
  config: AzureDevOpsConfig | null,
  type: 'commit' | 'workitem' | 'file',
  params: { sha?: string; workItemId?: string; path?: string }
): string | null => {
  if (!config) return null;
  const { orgUrl, project, repo } = config;
  
  switch (type) {
    case 'commit':
      return `${orgUrl}/${project}/_git/${repo}/commit/${params.sha}`;
    case 'workitem':
      return `${orgUrl}/${project}/_workitems/edit/${params.workItemId}`;
    case 'file':
      return `${orgUrl}/${project}/_git/${repo}?path=${encodeURIComponent(params.path || '')}`;
  }
};

// Work item extraction from commit message
const WORK_ITEM_PATTERNS = [
  /AB#(\d+)/g,           // Azure Boards format
  /#(\d+)/g,             // Generic format
  /\[(\d+)\]/g,          // Bracketed format
];
```

**Pagination:** Cursor-based, 50 commits per page with "Load More" button.

---

### 7. Stats Tab 📊

Comprehensive statistics for the selected file/folder (all pre-computed).

#### 7.1 Activity Statistics

```
┌─────────────────────────────────────────────────────────────┐
│  📊 Statistics for DataTable.tsx                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📈 Activity Summary                                        │
│  ├─ Total Commits:        127                              │
│  ├─ First Commit:         Mar 15, 2023                     │
│  ├─ Last Commit:          Jan 28, 2026 (today)             │
│  ├─ Active Days:          89 days                          │
│  └─ Avg Commits/Month:    4.2                              │
│                                                             │
│  📏 Size Metrics                                            │
│  ├─ Current LOC:          342 lines                        │
│  ├─ Peak LOC:             398 lines (Sep 2025)             │
│  ├─ Lines Added (total):  +2,847                           │
│  ├─ Lines Deleted (total): -2,505                          │
│  └─ Net Change:           +342 lines                       │
│                                                             │
│  👥 Contributor Breakdown                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │ @sarah.chen    ████████████████████░░░░  45 (35%)  │    │
│  │ @john.doe      ████████████░░░░░░░░░░░░  32 (25%)  │    │
│  │ @jane.smith    ████████░░░░░░░░░░░░░░░░  21 (17%)  │    │
│  │ @tech.lead     ██████░░░░░░░░░░░░░░░░░░  15 (12%)  │    │
│  │ Others (4)     ██████░░░░░░░░░░░░░░░░░░  14 (11%)  │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  🕐 Activity by Time                                        │
│  ├─ Most Active Day:      Tuesday                          │
│  ├─ Most Active Hour:     10:00-11:00                      │
│  └─ Busiest Month:        October 2025 (18 commits)        │
│                                                             │
│  🔗 Coupling Summary                                        │
│  ├─ Strongly Coupled:     8 files (score > 0.5)            │
│  ├─ Moderately Coupled:   15 files (score 0.2-0.5)         │
│  └─ Isolation Score:      0.32 (lower = more coupled)      │
│                                                             │
│  📋 Export: [CSV] [JSON] [PDF Report]                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Technical Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                             │
├─────────────────────────────────────────────────────────────┤
│  FolderTree.tsx ←→ TreeFilters.tsx ←→ DetailsPanel.tsx     │
│       ↓                   ↓                  ↓              │
│  TreeNodeHints.tsx   FilterPresets.tsx   [Tab Components]   │
│                                                             │
│  Context: TreePreferencesContext (hints visibility)         │
│  Context: TreeFilterContext (active filters)                │
│  Context: AzureDevOpsContext (external links config)        │
└───────────────────────────┬─────────────────────────────────┘
                            │ API Calls (axios)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                        Backend                              │
├─────────────────────────────────────────────────────────────┤
│  GET /repos/{id}/files/tree                                 │
│      → includes pre-computed hints per node                 │
│                                                             │
│  GET /repos/{id}/files/filter-counts                        │
│      → quick filter counts (hot, stable, recent, etc.)      │
│                                                             │
│  POST /repos/{id}/files/filter                              │
│      → returns file_ids matching complex filters            │
│                                                             │
│  GET /repos/{id}/path/{path}/insights                       │
│      → overview tab data (pre-computed)                     │
│                                                             │
│  GET /repos/{id}/path/{path}/correlations                   │
│      → correlated files from edges table                    │
│                                                             │
│  GET /repos/{id}/path/{path}/history                        │
│      → paginated commit history from parquet                │
│                                                             │
│  GET /repos/{id}/path/{path}/graph                          │
│      → time-series from pre-aggregated parquet              │
│                                                             │
│  GET /repos/{id}/path/{path}/stats                          │
│      → comprehensive statistics (pre-computed)              │
│                                                             │
│  GET /repos/{id}/config/azure-devops                        │
│      → Azure DevOps configuration                           │
│                                                             │
│  PUT /repos/{id}/config/azure-devops                        │
│      → Save Azure DevOps configuration                      │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema Extensions

```sql
-- Pre-computed file hints (populated during analysis)
CREATE TABLE IF NOT EXISTS file_hints (
    file_id INTEGER PRIMARY KEY REFERENCES files(file_id),
    commit_count INTEGER NOT NULL DEFAULT 0,
    author_count INTEGER NOT NULL DEFAULT 0,
    first_commit_at TEXT,
    last_commit_at TEXT,
    last_author TEXT,
    lines_added_total INTEGER DEFAULT 0,
    lines_deleted_total INTEGER DEFAULT 0,
    current_loc INTEGER DEFAULT 0,
    max_coupling_score REAL DEFAULT 0,
    strong_coupling_count INTEGER DEFAULT 0,  -- score > 0.5
    recent_commits_30d INTEGER DEFAULT 0,
    recent_commits_90d INTEGER DEFAULT 0,
    health_score INTEGER DEFAULT 0,           -- 0-100
    -- Quick filter flags (for instant filtering)
    is_hot BOOLEAN DEFAULT FALSE,             -- commit_count > threshold
    is_stable BOOLEAN DEFAULT FALSE,          -- no changes > 6 months
    is_recent BOOLEAN DEFAULT FALSE,          -- changed in last 30d
    is_high_coupling BOOLEAN DEFAULT FALSE,   -- max_coupling > 0.3
    is_risky BOOLEAN DEFAULT FALSE            -- high churn + many authors
);

-- Pre-computed folder aggregates
CREATE TABLE IF NOT EXISTS folder_hints (
    path TEXT PRIMARY KEY,
    file_count INTEGER NOT NULL DEFAULT 0,
    commit_count_sum INTEGER NOT NULL DEFAULT 0,
    author_count_distinct INTEGER NOT NULL DEFAULT 0,
    last_change_at TEXT,
    last_author TEXT,
    hottest_file_path TEXT,
    hottest_file_commits INTEGER DEFAULT 0,
    active_file_count_30d INTEGER DEFAULT 0,  -- files changed in 30d
    avg_coupling_score REAL DEFAULT 0
);

-- Author contributions per file
CREATE TABLE IF NOT EXISTS file_authors (
    file_id INTEGER NOT NULL REFERENCES files(file_id),
    author_name TEXT NOT NULL,
    author_email TEXT NOT NULL,
    commit_count INTEGER NOT NULL DEFAULT 0,
    lines_added INTEGER DEFAULT 0,
    lines_deleted INTEGER DEFAULT 0,
    first_commit_at TEXT,
    last_commit_at TEXT,
    PRIMARY KEY (file_id, author_email)
);

CREATE INDEX IF NOT EXISTS idx_file_authors_file ON file_authors(file_id);

-- Quick filter counts (cached, refreshed during analysis)
-- Stored in repo_meta as JSON: filter_counts = {"hot": 47, "stable": 123, ...}

-- Azure DevOps configuration (stored in repo_meta)
-- Keys: azure_devops_org_url, azure_devops_project, azure_devops_repo
```

### Parquet Schema Extensions

**commits.parquet** (existing, add fields):
```
commit_oid: string
author_name: string
author_email: string
authored_ts: timestamp
committer_ts: timestamp
is_merge: bool
parent_count: int
message_subject: string
message_body: string (NEW)
refs: string (NEW - comma-separated)
```

**changes.parquet** (existing, add fields):
```
commit_oid: string
file_id: int
path: string
status: string
old_path: string
commit_ts: timestamp
lines_added: int (NEW)
lines_deleted: int (NEW)
```

**file_time_series.parquet** (NEW - pre-aggregated for Graph tab):
```
file_id: int
period_start: date
granularity: string  # 'weekly' | 'monthly'
commit_count: int
lines_added: int
lines_deleted: int
author_count: int
authors_json: string  # {"author1": 5, "author2": 3}
```

### Frontend Component Library

**No additional dependencies required.** Use existing:
- **D3.js** for charts (already installed)
- **Lucide React** for icons (already installed)
- **Tailwind CSS** for styling (already installed)

### Component Specifications

#### TreeNodeHints.tsx
```typescript
interface HintType = 'churn' | 'recency' | 'coupling' | 'authors' | 'lines';

interface TreeNodeHintsProps {
  hints: FileHints;
  density: 'compact' | 'normal' | 'detailed';
  visibleHints: Set<HintType>;
}

// Render inline badges using Lucide icons
// Flame, Circle, Link2, Users, TrendingUp
```

#### VirtualizedTree.tsx (for large repos)
```typescript
// For repositories with >5000 files
// Use CSS transform-based virtualization
// Render only visible nodes + buffer (20 above/below)
// Expand/collapse updates virtual list bounds

interface VirtualizedTreeProps {
  nodes: FlattenedTreeNode[];  // Pre-flattened for performance
  expandedPaths: Set<string>;
  itemHeight: number;         // Fixed 32px per row
  containerHeight: number;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}
```

#### DetailsPanel.tsx
```typescript
// Slide-out panel from right side
// Width: 480px (fixed) or 40% viewport on large screens
// Tabs: Overview | Correlations | History | Graph | Stats

interface DetailsPanelProps {
  repoId: string;
  selectedPath: string | null;
  onClose: () => void;
}
```

### API Endpoints Detail

#### GET /repos/{id}/files/tree
Returns tree with embedded hints:
```json
{
  "src": {
    "__type": "dir",
    "__hints": {
      "commit_count_sum": 142,
      "file_count": 45,
      "active_file_ratio": 0.85,
      "last_change_at": "2026-01-26T10:30:00Z"
    },
    "__children": {
      "App.tsx": {
        "__type": "file",
        "file_id": 123,
        "__hints": {
          "commit_count": 32,
          "last_change_at": "2026-01-25T14:22:00Z",
          "author_count": 5,
          "max_coupling_score": 0.72,
          "health_score": 78
        }
      }
    }
  }
}
```

#### GET /repos/{id}/files/filter-counts
```json
{
  "hot": 47,
  "stable": 234,
  "recent": 89,
  "high_coupling": 156,
  "risky": 23,
  "total": 1250
}
```

#### POST /repos/{id}/files/filter
Request:
```json
{
  "quick_filters": ["hot", "recent"],
  "extensions": [".tsx", ".ts"],
  "churn": { "min": 10 },
  "authors": { "include": ["sarah@example.com"] }
}
```
Response:
```json
{
  "file_ids": [123, 456, 789],
  "count": 3
}
```

### Performance Strategies for Large Repositories (>50k files)

1. **Tree Virtualization**
   - Only render visible nodes + 20-item buffer
   - Use `transform: translateY()` for smooth scrolling
   - Pre-flatten tree structure for O(1) index access

2. **Lazy Loading**
   - Initial load: top 2 levels only
   - Load children on expand (cached after first load)
   - Folder hints aggregated from pre-computed `folder_hints` table

3. **Filter Execution**
   - Quick filters use pre-computed boolean flags (instant SQL WHERE)
   - Complex filters run SQL query, return file_ids only
   - Client applies file_id filter to cached tree

4. **Pagination Everywhere**
   - History: 50 commits per page, cursor-based
   - Correlations: 25 files per page
   - Graph data: max 100 data points (aggregate if more periods)

5. **Background Pre-computation**
   During analysis, compute and store:
   - All file hints
   - All folder aggregates
   - Quick filter flags
   - Time-series buckets (weekly, monthly)

### Data Contracts

```typescript
// === Configuration ===
interface AzureDevOpsConfig {
  org_url: string;           // e.g., "https://dev.azure.com/myorg"
  project: string;           // e.g., "MyProject"
  repo: string;              // e.g., "my-repo"
}

// === Hints ===
interface FileHints {
  commit_count: number;
  last_change_at: string | null;
  last_author: string | null;
  author_count: number;
  max_coupling_score: number;
  lines_added_total: number;
  lines_deleted_total: number;
  health_score: number;
  // Quick filter flags
  is_hot: boolean;
  is_stable: boolean;
  is_recent: boolean;
  is_high_coupling: boolean;
  is_risky: boolean;
}

interface FolderHints {
  file_count: number;
  commit_count_sum: number;
  author_count_distinct: number;
  last_change_at: string | null;
  hottest_file_path: string | null;
  active_file_ratio: number;
  avg_coupling_score: number;
}

// === Filters ===
interface TreeFilterRequest {
  quick_filters?: ('hot' | 'stable' | 'recent' | 'coupled' | 'risky')[];
  time_window?: { from: string; to: string };
  authors?: { include?: string[]; exclude?: string[] };
  extensions?: string[];
  churn?: { min?: number; max?: number };
  coupling?: { min_score?: number; with_file?: string };
  path_patterns?: { include?: string[]; exclude?: string[] };
}

// === Insights ===
interface PathInsights {
  path: string;
  is_directory: boolean;
  hints: FileHints | FolderHints;
  health_breakdown: {
    stability: number;
    ownership: number;
    coupling: number;
    size: number;
  };
  top_authors: Array<{
    name: string;
    email: string;
    commit_count: number;
    percentage: number;
  }>;
  recent_activity: {
    commits_7d: number;
    commits_30d: number;
    commits_90d: number;
  };
}

// === Correlations ===
interface CorrelatedFile {
  file_id: number;
  path: string;
  coupling_score: number;
  pair_count: number;
  last_together_at: string;
}

// === History ===
interface CommitListItem {
  sha: string;
  message_subject: string;
  author_name: string;
  author_email: string;
  authored_at: string;
  lines_added: number;
  lines_deleted: number;
  is_merge: boolean;
  work_items: string[];  // Extracted from message
}

interface CommitDetail extends CommitListItem {
  message_body: string;
  committer_name: string;
  committer_email: string;
  committed_at: string;
  parent_shas: string[];
  changed_files: Array<{
    path: string;
    status: 'A' | 'M' | 'D' | 'R';
    old_path?: string;
    lines_added: number;
    lines_deleted: number;
  }>;
}

// === Graph ===
interface GraphDataPoint {
  period: string;
  value: number;
  breakdown?: Record<string, number>;
}

// === Stats ===
interface PathStats {
  path: string;
  is_directory: boolean;
  activity: {
    total_commits: number;
    first_commit_at: string;
    last_commit_at: string;
    active_days: number;
    avg_commits_per_month: number;
  };
  size: {
    current_loc: number;
    total_lines_added: number;
    total_lines_deleted: number;
  };
  contributors: Array<{
    name: string;
    email: string;
    commit_count: number;
    percentage: number;
  }>;
  activity_patterns: {
    busiest_day: string;
    busiest_hour: number;
    busiest_month: string;
  };
  coupling: {
    strongly_coupled_count: number;
    moderately_coupled_count: number;
    isolation_score: number;
  };
}
```

---

## Implementation Phases

### Phase 1: Schema & Pre-computation (Backend)
**Effort:** 3 days

1. Extend `lfca/schema.py` with new tables
2. Modify `lfca/extract.py` to capture lines_added/deleted per change
3. Create `lfca/hints.py` to compute and store all hints during analysis
4. Add `folder_hints` aggregation after file hints computed
5. Store quick filter counts in `repo_meta`

### Phase 2: Visual Hints (Frontend)
**Effort:** 2 days

1. Create `TreeNodeHints.tsx` component
2. Create `TreePreferencesContext` for hint visibility
3. Update `FolderTree.tsx` to render hints
4. Add hint toggle controls in toolbar
5. Update `/repos/{id}/files/tree` API to include hints

### Phase 3: Quick Filters
**Effort:** 2 days

1. Create `TreeFilters.tsx` with pill buttons
2. Add `/repos/{id}/files/filter-counts` endpoint
3. Implement client-side filtering by file_id set
4. Add filter count badges

### Phase 4: Tree Virtualization (Large Repos)
**Effort:** 3 days

1. Create `VirtualizedTree.tsx` component
2. Implement scroll-based rendering
3. Add lazy-loading for deep folders
4. Performance testing with 50k+ file repos

### Phase 5: Details Panel - Overview & Stats
**Effort:** 3 days

1. Create `DetailsPanel.tsx` slide-out
2. Implement `OverviewTab.tsx` with stats cards
3. Implement `StatsTab.tsx` with full statistics
4. Add `/repos/{id}/path/{path}/insights` endpoint
5. Add `/repos/{id}/path/{path}/stats` endpoint

### Phase 6: Correlations Tab
**Effort:** 2 days

1. Create `CorrelationsTab.tsx`
2. Add coupling bar visualization
3. Implement evidence commit modal
4. Add `/repos/{id}/path/{path}/correlations` endpoint

### Phase 7: History Tab + Azure DevOps
**Effort:** 3 days

1. Create `HistoryTab.tsx` with commit list
2. Create `CommitDetailModal.tsx`
3. Implement Azure DevOps URL builder
4. Add work item extraction from commit messages
5. Add Azure DevOps configuration endpoints
6. Add `/repos/{id}/path/{path}/history` endpoint

### Phase 8: Graph Tab
**Effort:** 2 days

1. Create `GraphTab.tsx` with D3 bar chart
2. Implement metric/granularity controls
3. Pre-aggregate time-series during analysis
4. Add `/repos/{id}/path/{path}/graph` endpoint

### Phase 9: Advanced Filters
**Effort:** 2 days

1. Create `AdvancedFiltersPanel.tsx`
2. Implement filter preset save/load
3. Add `POST /repos/{id}/files/filter` endpoint

**Total Estimated Effort:** 22 days

---

## Relevant Files

### Frontend (New)
```
frontend/src/
├── components/
│   ├── FolderTree/
│   │   ├── FolderTree.tsx          (refactor existing)
│   │   ├── VirtualizedTree.tsx     (new)
│   │   ├── TreeNodeHints.tsx       (new)
│   │   ├── TreeFilters.tsx         (new)
│   │   └── AdvancedFiltersPanel.tsx (new)
│   ├── DetailsPanel/
│   │   ├── DetailsPanel.tsx        (new)
│   │   ├── OverviewTab.tsx         (new)
│   │   ├── CorrelationsTab.tsx     (new)
│   │   ├── HistoryTab.tsx          (new)
│   │   ├── GraphTab.tsx            (new)
│   │   └── StatsTab.tsx            (new)
│   └── CommitDetailModal.tsx       (new)
├── contexts/
│   ├── TreePreferencesContext.tsx  (new)
│   ├── TreeFilterContext.tsx       (new)
│   └── AzureDevOpsContext.tsx      (new)
├── hooks/
│   ├── useTreeFilters.ts           (new)
│   └── useVirtualScroll.ts         (new)
├── utils/
│   └── azureDevOps.ts              (new)
└── api.ts                          (extend)
```

### Backend (New/Modified)
```
lfca/
├── schema.py           (extend with new tables)
├── extract.py          (add lines_added/deleted capture)
├── hints.py            (new - hints computation)
├── api.py              (add new endpoints)
├── storage.py          (add hints methods)
└── services/
    ├── __init__.py     (new)
    ├── insights.py     (new)
    ├── correlations.py (new)
    └── history.py      (new)
```

---

## Answered Questions

### 1. Should hints be computed on-demand or pre-aggregated during analysis?
**Answer:** **Pre-aggregated during analysis.**

All hints are computed once during the analysis phase and stored in dedicated tables (`file_hints`, `folder_hints`). This ensures:
- Instant tree rendering (<100ms for visible nodes)
- No repeated expensive aggregations
- Offline/cached browsing capability
- Consistent values across views

### 2. How to handle very large repositories (>50k files)?
**Answer:** Multiple strategies combined:

- **Tree Virtualization:** Only render visible nodes + buffer
- **Lazy Loading:** Load folder children on-demand
- **Pre-computation:** All metrics computed during analysis
- **Pagination:** All list views paginated (50 items)
- **Index Optimization:** Boolean flags for quick filters enable instant WHERE clauses

### 3. Should we support custom health score formulas?
**Answer:** **No.**

Fixed algorithm provides consistency:
- Stability (25%): Low recent churn = better
- Ownership (25%): Single dominant author = clearer ownership
- Coupling (25%): Fewer strong couplings = more isolated
- Size (25%): Smaller files = more maintainable

### 4. Integration with external issue trackers?
**Answer:** **Azure DevOps only.**

Configuration stored in `repo_meta`:
- `azure_devops_org_url`
- `azure_devops_project`
- `azure_devops_repo`

Features:
- Commit links to Azure DevOps commit page
- Work item extraction from commit messages (`AB#1234`, `#1234`)
- Work item links to Azure DevOps work item page

### 5. Diff viewer: inline implementation or link to external tool?
**Answer:** **Link to Azure DevOps.**

No inline diff viewer. All "View Diff" actions open the corresponding commit in Azure DevOps. This:
- Reduces implementation complexity
- Leverages Azure DevOps' rich diff capabilities
- Maintains single source of truth for code review
