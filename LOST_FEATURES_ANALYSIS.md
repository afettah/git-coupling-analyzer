# Lost Features Analysis - File Details Page Frontend Changes

**Analysis Date**: 2026-02-08  
**Scope**: Frontend source code changes (uncommitted) - File Details Page components

---

## Executive Summary

This document enumerates features that have been removed, simplified, or are missing from the File Details page frontend components during the recent refactoring. The analysis compares the current uncommitted changes against the HEAD commit.

**Files Analyzed**:
- `src/frontend/src/features/git/file-details/FileActivityTab.tsx` (Modified)
- `src/frontend/src/features/git/file-details/FileAuthorsTab.tsx` (Modified)
- `src/frontend/src/features/git/file-details/FileCommitsTab.tsx` (Modified)
- `src/frontend/src/stores/filterStore.tsx` (Deleted)
- `src/frontend/src/features/git/FolderTree.tsx` (Deleted)

---

## 1. FileActivityTab.tsx - Lost Features

### 1.1 Custom Interactive Chart Implementations
**File**: `FileActivityTab.tsx`  
**Severity**: 🟡 Medium  
**Description**: Replaced custom-built interactive chart implementations with shared chart components (`TimelineChart`, `HeatmapCalendar`, `DayHourMatrix`).

**Value Lost**:
- **Custom tooltips with inline positioning**: Original implementation had group-hover tooltips with precise positioning and custom content formatting
- **Direct DOM manipulation for fine-tuned interactions**: Allowed for specific hover states and transitions tailored to each chart type
- **Inline bar chart rendering**: Custom flex-based bar chart with precise height calculations and color management

**Impact**: 
- Reduced customization flexibility if shared components don't support specific UX requirements
- Potential loss of fine-grained control over chart interactions
- May affect performance if shared components are less optimized for specific use cases

---

### 1.2 Year Filter for Heatmap
**File**: `FileActivityTab.tsx`  
**Severity**: 🔴 High  
**Description**: Removed the year selection filter that allowed users to filter the contribution heatmap by specific years or view "All Time".

**Original Code**:
```tsx
const [selectedYear, setSelectedYear] = useState<string>('all');

// Year selector UI
<button onClick={() => setSelectedYear('all')}>All Time</button>
{availableYears.slice(0, 3).map(year => (
  <button onClick={() => setSelectedYear(year)}>{year}</button>
))}

// Filter logic
const filteredHeatmapData = useMemo(() => {
    if (!data?.heatmap_data) return [];
    if (selectedYear === 'all') return data.heatmap_data;
    return data.heatmap_data.filter(d => d.date.startsWith(selectedYear));
}, [data, selectedYear]);
```

**Value Lost**:
- **Temporal filtering**: Users could focus on specific years to analyze patterns
- **Large dataset handling**: Viewing all years at once can be overwhelming; filtering improved usability
- **Comparative analysis**: Ability to compare year-over-year contribution patterns

**Business Impact**: Users analyzing long-lived repositories lose the ability to isolate specific time periods for heatmap analysis

---

### 1.3 Velocity Chart with Peak Detection
**File**: `FileActivityTab.tsx`  
**Severity**: 🟠 Medium-High  
**Description**: Simplified velocity chart removed advanced peak detection visualization and moving average calculation.

**Original Features**:
- **Moving average calculation**: 3-period simple moving average to smooth data
- **Peak period detection**: Automatic identification of periods with >1.5× average activity
- **Visual peak indicators**: Triangle markers (`▲`) on peak periods
- **Average line overlay**: Dashed horizontal line showing average velocity
- **Color-coded bars**: Different colors for normal (blue) vs peak (amber) periods
- **Detailed legend**: Explained normal vs peak activity thresholds

**Original Code**:
```tsx
const velocityData = data.commits_by_period.map((item, i, arr) => {
    const windowSize = 3;
    const start = Math.max(0, i - windowSize + 1);
    const window = arr.slice(start, i + 1);
    const avg = window.reduce((sum, w) => sum + w.count, 0) / window.length;
    return { ...item, avg };
});

const avgVelocity = velocityData.reduce((sum, d) => sum + d.count, 0) / velocityData.length;
const threshold = avgVelocity * 1.5;
const peaks = velocityData.filter(d => d.count > threshold);

// Peak indicator rendering
{isPeak && (
    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 
                   border-l-[4px] border-l-transparent 
                   border-r-[4px] border-r-transparent 
                   border-b-[6px] border-b-amber-400" />
)}
```

**New Implementation**:
```tsx
// Simplified to basic stats
const velocityStats = useMemo(() => {
    const counts = data.commits_by_period.map(d => d.count);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const threshold = avg * 1.5;
    const peaks = counts.filter(c => c > threshold).length;
    return { avg, peaks };
}, [data]);
```

**Value Lost**:
- **Visual analytics**: No more inline peak markers or average line overlay
- **Pattern recognition**: Moving average smoothing helped identify trends
- **Actionable insights**: Peak periods indicated sprint completions, releases, or critical bug fixes
- **Interactive feedback**: Tooltips no longer distinguish peak vs normal activity

**Business Impact**: Product managers and team leads lose visual cues for identifying high-activity periods, making it harder to correlate code velocity with project milestones.

---

### 1.4 Lines Changed Stacked Chart Visualization
**File**: `FileActivityTab.tsx`  
**Severity**: 🟡 Medium  
**Description**: Replaced detailed stacked area chart showing additions/deletions ratio with simplified timeline chart.

**Original Features**:
- **Dual-color stacked bars**: Green (additions) stacked on top of red (deletions) in single bar
- **Proportional visualization**: Bar segments sized by ratio of additions to deletions
- **Total height scaling**: Overall bar height represented total change volume
- **Detailed tooltips**: Showed both `+additions` and `-deletions` with color coding

**Original Code**:
```tsx
<div className="flex-1 min-w-[4px] max-w-[24px] flex flex-col gap-px group relative"
     style={{ height: `${((item.added + item.deleted) / maxLinesChanged) * 100}%` }}>
    <div className="bg-emerald-500/80 hover:bg-emerald-400 rounded-t"
         style={{ height: `${(item.added / (item.added + item.deleted || 1)) * 100}%` }} />
    <div className="bg-red-500/80 hover:bg-red-400 rounded-b"
         style={{ height: `${(item.deleted / (item.added + item.deleted || 1)) * 100}%` }} />
    <div className="tooltip">
        {item.period}: <span className="text-emerald-400">+{item.added}</span> / 
                        <span className="text-red-400">-{item.deleted}</span>
    </div>
</div>
```

**New Implementation**: Separate timeline charts for additions and deletions (no stacked visualization)

**Value Lost**:
- **Ratio visualization**: At-a-glance understanding of code addition vs deletion balance
- **Refactoring detection**: High deletion ratios often indicate refactoring or cleanup
- **Compact representation**: Single bar showed both metrics simultaneously

**Business Impact**: Technical debt analysis becomes harder as the visual relationship between additions and deletions is no longer immediate.

---

### 1.5 Day/Hour Activity Matrix Custom Implementation
**File**: `FileActivityTab.tsx`  
**Severity**: 🟢 Low  
**Description**: Replaced custom day/hour matrix with shared `DayHourMatrix` component.

**Original Features**:
- **Custom day labels**: 3-letter day abbreviations (Mon, Tue, Wed, etc.)
- **Hour label positioning**: Positioned at specific intervals (0, 6, 12, 18, 23)
- **Custom color intensity scaling**: 4-level intensity mapping (slate-800 → sky-500)
- **Inline tooltip formatting**: `"Mon 14:00 - 5 commits"`

**Value Lost**: Minimal - mostly implementation details rather than user-facing features

---

### 1.6 Timeline X-Axis Labels
**File**: `FileActivityTab.tsx`  
**Severity**: 🟢 Low  
**Description**: Removed manual X-axis labels showing first and last period dates.

**Original Code**:
```tsx
{data.commits_by_period.length > 0 && (
    <div className="flex justify-between mt-2 text-[10px] text-slate-600">
        <span>{data.commits_by_period[0]?.period}</span>
        <span>{data.commits_by_period[data.commits_by_period.length - 1]?.period}</span>
    </div>
)}
```

**Value Lost**: Quick reference to date range without hovering over chart

---

## 2. FileAuthorsTab.tsx - Lost Features

### 2.1 Author Timeline - Reduced Visualization
**File**: `FileAuthorsTab.tsx`  
**Severity**: 🟡 Medium  
**Description**: Reduced author activity timeline from 5 authors to 3 authors displayed.

**Change**:
```tsx
// Before: Shows top 5 authors
{data.authors.slice(0, 5).map((author, authorIndex) => {

// After: Shows top 3 authors  
{data.authors.slice(0, 3).map((author, authorIndex) => {
```

**Value Lost**:
- **Reduced visibility**: Only top 3 contributors shown instead of top 5
- **Team dynamics**: Harder to see full picture of team collaboration patterns

**Business Impact**: In teams with distributed contributions, missing 2 contributors can hide important collaboration patterns.

---

### 2.2 Author Timeline - Compact Multi-Author View
**File**: `FileAuthorsTab.tsx`  
**Severity**: 🟠 Medium-High  
**Description**: Replaced compact multi-author timeline matrix with larger separate timeline charts.

**Original Features**:
- **Compact space usage**: All 5 authors in horizontal bars within single component
- **Comparative analysis**: Easy to compare authors side-by-side at same scale
- **Intensity-based opacity**: Bars used opacity to show commit intensity (0.2 to 1.0)
- **Color-coded per author**: Each author had distinct color (sky, purple, emerald, amber, pink)
- **Name truncation**: First name only for space efficiency
- **Dense time periods**: Each period as thin vertical bar (gap-px spacing)

**Original Code**:
```tsx
<div className="space-y-2">
    {data.authors.slice(0, 5).map((author, authorIndex) => {
        const colors = ['bg-sky-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-pink-500'];
        return (
            <div key={author.name} className="flex items-center gap-2">
                <span className="w-24 text-xs text-slate-400 truncate">
                    {author.name.split(' ')[0]}
                </span>
                <div className="flex-1 flex gap-px h-4">
                    {data.ownership_timeline.map((month, monthIndex) => {
                        const authorData = month.authors.find(a => a.name === author.name);
                        const commits = authorData?.commits || 0;
                        const intensity = commits / maxCommits;
                        return (
                            <div className={cn('flex-1 rounded-sm transition-opacity',
                                commits > 0 ? colors[authorIndex] : 'bg-slate-800/50')}
                                style={{ opacity: commits > 0 ? Math.max(0.2, intensity) : 0.1 }}
                                title={`${month.month}: ${commits} commits`} />
                        );
                    })}
                </div>
            </div>
        );
    })}
</div>
```

**New Implementation**:
```tsx
{data.authors.slice(0, 3).map((author, authorIndex) => {
    return (
        <div key={author.name} className="mb-3">
            <div className="text-xs text-slate-400 mb-1">{author.name}</div>
            <TimelineChart data={timelineData} chartType="area" height={80} />
        </div>
    );
})}
```

**Value Lost**:
- **Space efficiency**: New version takes ~3× more vertical space (80px × 3 authors + spacing vs. compact rows)
- **Comparative view**: Can't easily compare author patterns at same visual scale
- **Data density**: Less information per screen real estate
- **Quick scanning**: Compact rows allowed faster pattern recognition across authors
- **Month labels**: Original showed `month.month` in tooltips; may be lost in new implementation

**Business Impact**: Project managers reviewing code ownership patterns need more scrolling and lose the ability to quickly compare multiple contributors' activity patterns simultaneously.

---

### 2.3 Bus Factor Calculation - Added Feature ✅
**File**: `FileAuthorsTab.tsx`  
**Severity**: N/A (Addition, not removal)  
**Description**: This is actually a **NEW FEATURE** added in the current changes.

**Features Added**:
- Bus factor calculation (minimum contributors for 50% of commits)
- Risk level visualization (high/medium/low)
- Color-coded warning badges
- Knowledge silo warnings

**Note**: This is an improvement, not a loss.

---

## 3. FileCommitsTab.tsx - Lost Features

### 3.1 Minimal Lost Functionality
**File**: `FileCommitsTab.tsx`  
**Severity**: 🟢 Low  
**Description**: Added commit density timeline visualization (new feature).

**Added Feature**:
- New `commitDensityData` calculation
- Visual commit density timeline using `TimelineChart`
- Groups commits by date and displays frequency

**Note**: This file primarily gained features rather than losing them.

---

## 4. Deleted Files - Major Losses

### 4.1 Global Filter Store (filterStore.tsx)
**File**: `src/frontend/src/stores/filterStore.tsx` (459 lines)  
**Severity**: 🔴 Critical  
**Description**: Entire centralized state management system for advanced filtering has been deleted.

**Lost Features**:
1. **DateRange Filtering**
   - From/to date selection for temporal filtering
   - Used across entire application

2. **CouplingFilter**
   - Min/max strength sliders
   - Metric selection (jaccard, jaccard_weighted, p_dst_given_src, p_src_given_dst)

3. **ChurnFilter**
   - Min/max commit thresholds
   - Churn rate filtering

4. **AuthorFilter**
   - Selected authors inclusion
   - Author exclusion list
   - Minimum contribution thresholds

5. **FileFilter**
   - File extension include/exclude
   - Path pattern matching
   - Path exclusion patterns
   - File size constraints (min/max)

6. **RiskFilter**
   - Min/max risk score ranges
   - Hotspot inclusion toggle
   - Low activity file inclusion toggle

7. **PerformanceSettings**
   - Virtual scrolling toggle
   - Pagination size configuration
   - Debounce delays
   - Lazy loading controls

**Lost Infrastructure**:
- React Context provider (`FilterProvider`)
- Custom hooks (`useFilters`)
- State persistence
- Filter composition logic
- Cross-component filter synchronization

**Value Lost**:
- **Centralized state management**: All filters managed in one place
- **Advanced query capabilities**: Complex multi-dimensional filtering
- **Performance optimization**: Virtual scrolling and pagination controls
- **User experience**: Consistent filtering across all views
- **Large repository support**: Essential for navigating big projects

**Business Impact**: 
- **Critical for enterprise users**: Large codebases become difficult to navigate
- **Loss of analytical power**: Can't perform sophisticated queries on repository data
- **Performance degradation**: Without virtual scrolling, large datasets may cause UI lag
- **Inconsistent UX**: Each component may implement filters differently

---

### 4.2 Folder Tree Component (FolderTree.tsx)
**File**: `src/frontend/src/features/git/FolderTree.tsx` (Deleted)  
**Severity**: 🔴 Critical  
**Description**: Complete removal of the hierarchical folder tree visualization component.

**Lost Features**:

1. **Hierarchical File Tree Visualization**
   - Recursive tree rendering with expand/collapse
   - Nested folder structure representation
   - Visual depth indicators

2. **File Aggregation Statistics**
   - Folder-level rollup of file stats:
     - Total file count
     - Aggregate commit counts
     - Lines added/deleted sums
     - Unique author counts
     - Child folder counts
     - Coupling statistics (coupled_count, max_coupling, strong_coupling_count)
     - Most recent modification date
     - Last author name

3. **Context Menu System**
   - Right-click context menu with actions:
     - "Open File Details"
     - "View in Git"
     - "Show Hotspot Analysis"
     - "Copy Path"
     - "Copy Git URL"

4. **Quick Filters**
   - 'hot': High commit activity files
   - 'stable': Low activity, reliable files
   - 'recent': Recently modified files
   - 'coupled': Highly coupled files
   - 'risky': High-risk files

5. **Customization Settings**
   - `maxDepth`: Control tree depth rendering
   - `showFiles`: Toggle file visibility (folders only mode)
   - `colorPalette`: Customizable folder colors (10-color palette)
   - `showHints`: Toggle metadata hints
   - `hintDensity`: 'compact' | 'normal' | 'detailed' hint levels

6. **Advanced Interactions**
   - Hover information panel showing:
     - File/folder name and path
     - File count, commits, lines changed
     - Author information, last modified date
     - Coupling and risk metrics
   - Git provider integration (GitHub, GitLab, Azure DevOps, Bitbucket)
   - Default branch support
   - File selection callback
   - Detail view navigation

7. **Visual Features**
   - Color-coded folders from customizable palette
   - Expand/collapse animations
   - Hover state indicators
   - Metric badges and icons
   - Responsive layout

**Original Code Structure**:
```tsx
interface FolderTreeProps {
    repoId: string;
    onFileSelect?: (path: string) => void;
    onOpenDetails?: (path: string, type: 'file' | 'folder') => void;
    gitWebUrl?: string;
    gitProvider?: 'github' | 'gitlab' | 'azure_devops' | 'bitbucket' | null;
    defaultBranch?: string;
}

interface TreeNode {
    __type?: 'file' | 'dir';
    __children?: Record<string, TreeNode>;
    file_id?: number;
    commits?: number;
    lines_added?: number;
    lines_deleted?: number;
    authors?: number;
    last_modified?: string;
    last_author?: string;
    coupled_count?: number;
    max_coupling?: number;
    avg_coupling?: number;
    strong_coupling_count?: number;
}
```

**Value Lost**:
- **Primary navigation method**: Users lose hierarchical file system navigation
- **Project structure understanding**: Can't visualize repository organization
- **Aggregated insights**: Folder-level metrics are no longer available
- **Contextual actions**: All context menu functionality removed
- **Flexible filtering**: Quick filters for different file categories gone
- **Git integration**: Direct links to source control provider lost

**Business Impact**:
- **Critical UX regression**: Users must rely on alternative navigation (possibly flat lists or search)
- **Lost analytical capability**: Can't analyze folder-level patterns or hotspots
- **Reduced discoverability**: Files harder to find without tree structure
- **Workflow disruption**: Context menu actions must be accessed elsewhere (if available)
- **Enterprise adoption risk**: Large repositories with deep folder structures become very difficult to navigate

---

### 4.3 Store Index (stores/index.ts)
**File**: `src/frontend/src/stores/index.ts` (Deleted)  
**Severity**: 🟡 Medium  
**Description**: Central exports file for store modules removed.

**Impact**: If other stores existed, they've lost their central export point. May indicate broader state management refactoring.

---

## 5. Data Structure Changes

### 5.1 Ownership Timeline Data Structure
**File**: `FileAuthorsTab.tsx`  
**Severity**: 🟠 Medium-High  
**Description**: Change in how ownership timeline data is structured and accessed.

**Original Structure**:
```tsx
data.ownership_timeline.map((month) => {
    month.month       // Period label
    month.authors     // Array of authors with commit counts per month
})
```

**New Structure**:
```tsx
data.ownership_timeline.map((point) => {
    point.date                        // Date string
    point.contributions[author.name]  // Commits per author (object lookup)
})
```

**Impact**:
- Different API contract expected
- Backend may need updates to match new structure
- Potential breaking change for data fetching

---

### 5.2 Day/Hour Matrix Data Structure
**File**: `FileActivityTab.tsx`  
**Severity**: 🟡 Medium  
**Description**: Changed from nested array structure to flat array of objects.

**Original Structure**:
```tsx
data.day_hour_matrix = [
    { day: 0, hours: [0, 2, 5, 3, ...] },  // 24 hours per day
    { day: 1, hours: [1, 0, 3, 2, ...] },
    ...
]
```

**New Structure**:
```tsx
data.day_hour_matrix = [
    { day: 0, hour: 0, count: 0 },
    { day: 0, hour: 1, count: 2 },
    { day: 0, hour: 2, count: 5 },
    ...
]
```

**Impact**:
- More normalized data structure
- Easier to work with in some contexts
- Requires backend data format changes
- Potential N×24 array size (7 days × 24 hours = 168 objects vs 7 objects)

---

## 6. Summary by Severity

### 🔴 Critical (2 features)
1. **Global Filter Store deletion** - Centralized filtering infrastructure
2. **Folder Tree Component deletion** - Primary navigation method

### 🟠 Medium-High (4 features)
1. **Year filter for heatmap** - Temporal filtering capability
2. **Velocity chart peak detection** - Advanced activity analytics
3. **Compact multi-author timeline** - Space-efficient comparison view
4. **Ownership timeline data structure** - API contract change

### 🟡 Medium (4 features)
1. **Custom interactive charts** - Fine-grained control
2. **Lines changed stacked visualization** - Ratio insights
3. **Author timeline reduction (5→3)** - Visibility reduction
4. **Store index deletion** - State management organization

### 🟢 Low (3 features)
1. **Day/hour matrix custom implementation** - Implementation detail
2. **Timeline X-axis labels** - Minor UX convenience
3. **FileCommitsTab changes** - Actually gained features

---

## 7. Recommendations

### Immediate Action Required (Critical)
1. **Restore or replace Global Filter Store**
   - Essential for large repository navigation
   - Consider migrating to modern state management (Zustand, Jotai, etc.)
   - Ensure virtual scrolling and pagination capabilities maintained

2. **Restore or replace Folder Tree Component**
   - Critical for user navigation
   - If replacing, ensure equivalent functionality:
     - Hierarchical navigation
     - Folder-level aggregations
     - Context menu actions
     - Quick filters

### High Priority
3. **Restore year filtering for heatmap** - High-value feature for long-lived repos
4. **Restore velocity peak detection** - Important for project management insights
5. **Consider restoring compact author timeline** - Better space utilization

### Medium Priority
6. **Evaluate shared chart components** - Ensure they support all required interactions
7. **Restore 5-author display** - Or make configurable
8. **Validate data structure changes** - Ensure backend APIs align

### Low Priority
9. **Document new architecture** - Explain rationale for shared components
10. **Performance testing** - Verify shared components don't degrade performance

---

## 8. Migration Path

If these changes are intentional (moving to shared component library):

1. **Ensure feature parity** in shared components:
   - Add year filtering to `HeatmapCalendar`
   - Add peak detection to `TimelineChart`
   - Add compact multi-series mode to timeline charts

2. **Document API changes** for data structures
3. **Provide migration guide** for users dependent on removed features
4. **Consider phased rollout** with feature flags

---

## Appendix: Code Statistics

| File | Status | Lines Changed | Features Lost | Severity |
|------|--------|---------------|---------------|----------|
| FileActivityTab.tsx | Modified | ~771 lines diff | 6 | 🟠 Med-High |
| FileAuthorsTab.tsx | Modified | ~150 lines diff | 2 | 🟡 Medium |
| FileCommitsTab.tsx | Modified | ~50 lines diff | 0 (gained) | ✅ Improved |
| filterStore.tsx | **Deleted** | -459 lines | 7+ | 🔴 Critical |
| FolderTree.tsx | **Deleted** | Unknown (100+ lines shown) | 7+ | 🔴 Critical |
| stores/index.ts | **Deleted** | Unknown | 1 | 🟡 Medium |

**Total Estimated Impact**: ~20+ features removed or significantly changed

---

*Analysis generated from git diff comparing uncommitted changes to HEAD*
