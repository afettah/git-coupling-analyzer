# Excalidraw View — Complete Redesign

**Status:** In Progress  
**Priority:** High  
**Created:** February 6, 2026

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Vision](#2-vision)
3. [Architecture Overview](#3-architecture-overview)
4. [Layout Engine Redesign](#4-layout-engine-redesign)
5. [View Modes (Expanded)](#5-view-modes-expanded)
6. [Interactive Features](#6-interactive-features)
7. [Visual Design System](#7-visual-design-system)
8. [Component Architecture](#8-component-architecture)
9. [Implementation Phases](#9-implementation-phases)
10. [File Structure](#10-file-structure)
11. [API Reference](#11-api-reference)

---

## 1. Problem Statement

### Current Issues

The existing Excalidraw implementation is **basic and broken** in several fundamental ways:

| Problem | Impact |
|---------|--------|
| **Fixed grid layout** — Clusters laid out in a simple `ceil(sqrt(N))` grid with fixed `400×300` boxes. No intelligence about relationships. | Highly-coupled clusters may be far apart; diagram has no semantic meaning in its spatial layout. |
| **No edge routing** — Arrows draw straight lines from center-to-center of boxes, cutting through other boxes. | Diagram is unreadable with >5 clusters. Overlapping arrows create visual noise. |
| **Hardcoded box sizes** — `boxWidth=400`, `boxHeight=300`. Only adjusts height for file count, never width. | Long filenames are truncated. Clusters with few files waste space; clusters with many files are clipped at 15. |
| **No interactivity beyond Excalidraw defaults** — No click-to-filter, no tooltip on hover, no zoom-to-cluster. | Users can't navigate or explore the data meaningfully. |
| **Per-Folder view has no edges** — The second view mode explicitly discards edge data. | Half the feature set is missing coupling visualization. |
| **No grouping / nesting** — Flat list of rectangles; no visual hierarchy for folders, modules, or coupling levels. | Loses the hierarchical nature of code coupling. |
| **Manual edit tracking is fragile** — Only tracks element count changes, not actual element modifications. | Users can move/resize elements without triggering the "unsaved edits" warning, leading to lost work. |
| **No responsive scaling** — Generated elements have absolute positions; no auto-fit, no zoom-to-fit on settings change. | Users must manually zoom/pan after every regeneration. |
| **Duplicate controls** — ExcalidrawView has its own view mode & folder depth controls separate from the shared `ViewFiltersBar`. | Confusing UX; two sets of controls doing overlapping things. |
| **No coupling-based spatial layout** — Position is arbitrary (grid order), not driven by coupling strength. | The diagram doesn't communicate the most important metric: which clusters are tightly coupled. |

### Root Cause

The implementation treats Excalidraw as a "dump elements on canvas" tool rather than as a **relationship-aware diagramming engine**. There is no layout algorithm, no edge routing, no semantic spatial positioning.

---

## 2. Vision

### Goal

Transform the Excalidraw view from a static grid dump into an **intelligent, interactive architecture diagram** that:

1. **Spatially encodes coupling** — Tightly-coupled clusters are placed close together; loosely-coupled clusters are far apart.
2. **Routes edges cleanly** — Arrows avoid crossing boxes, use orthogonal/curved routing with coupling strength encoded in thickness + color.
3. **Scales gracefully** — From 2 clusters to 50+, the layout adapts dynamically with collapsible groups and zoom levels.
4. **Is interactive** — Click to expand clusters, hover for details, drag to reorganize, filter inline.
5. **Supports multiple perspectives** — Cluster-centric, folder-centric, and a **new coupling-graph** mode.

### Design Principles

- **Data density without clutter** — Show as much information as possible without visual noise.
- **Coupling is king** — Every visual decision (position, color, size, edge weight) should communicate coupling relationships.
- **Progressive disclosure** — Start with a high-level overview; let users drill into details.
- **Consistency** — Share design language with ProjectCity and ClustersTab (same palette, same coupling legend, same filter semantics).

---

## 3. Architecture Overview

```
ExcalidrawView (orchestrator)
├── useExcalidrawScene (hook: manages API, scene, undo history)
├── ExcalidrawToolbar (controls: view mode, layout, export)
├── Layout Engines (pluggable strategies)
│   ├── ForceDirectedLayout    ← coupling-graph mode
│   ├── HierarchicalLayout     ← per-cluster / per-folder with nesting
│   └── GridLayout             ← fallback / simple mode (improved current)
├── Element Generators (convert layout → Excalidraw elements)
│   ├── ClusterBoxGenerator    ← renders a cluster as a rounded container
│   ├── FileNodeGenerator      ← renders files inside clusters
│   ├── EdgeGenerator          ← renders coupling edges with routing
│   └── LabelGenerator         ← renders stats, legends, titles
├── Edge Router
│   ├── OrthogonalRouter       ← right-angle paths avoiding obstacles
│   └── CurvedRouter           ← bezier curves for organic look
└── Interaction Layer
    ├── useElementInteraction   ← click/hover handlers mapped to elements
    ├── Tooltip overlay         ← hover details panel
    └── ContextMenu             ← right-click actions
```

### Key Architectural Changes

1. **Pluggable layout engines** — Layout is separated from element generation. Any layout engine produces `LayoutNode[]` positions; element generators consume them.
2. **Edge routing as a first-class concern** — Edges are routed after layout, with awareness of all box positions.
3. **Scene management hook** — All Excalidraw API interaction (updateScene, scrollToContent, undo/redo, export) is encapsulated in a single hook.
4. **Interaction layer** — Element IDs are structured semantically (`cluster:5`, `file:5:src/api.ts`, `edge:3-7`) so click/hover handlers can resolve what was interacted with.

---

## 4. Layout Engine Redesign

### 4.1 Force-Directed Layout (NEW — Default)

Uses a spring-force simulation where:

- **Attraction** between clusters is proportional to coupling strength.
- **Repulsion** between all clusters prevents overlap.
- **Node size** is proportional to file count (or total churn).
- **Gravity** pulls all nodes toward center to prevent drift.

```typescript
interface LayoutNode {
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    cluster: ClusterData;
}

interface LayoutEdge {
    from: number;
    to: number;
    strength: number;     // 0-1 coupling strength
    sharedFiles?: string[];
}

interface LayoutResult {
    nodes: LayoutNode[];
    edges: LayoutEdge[];
    bounds: { minX: number; minY: number; maxX: number; maxY: number };
}
```

**Algorithm (simplified):**

```
1. Initialize node positions randomly (or in a circle)
2. For N iterations (e.g., 300):
   a. Apply repulsion force between all node pairs (Coulomb's law)
   b. Apply attraction force along edges (Hooke's law, scaled by coupling_strength)
   c. Apply gentle gravity toward center
   d. Apply velocity damping (cooling schedule)
   e. Resolve overlaps (push apart if bounding boxes intersect)
3. Center the graph at (0, 0)
4. Return final positions
```

**Why force-directed?**
- Naturally places highly-coupled clusters close together.
- Familiar mental model (similar to dependency graphs, network diagrams).
- Works well for 5–50 nodes (our typical range).
- Produces aesthetically pleasing, organic layouts.

**Performance consideration:**
- Run in a Web Worker if N > 30 clusters.
- Cache layout results — only re-run when cluster data or coupling edges change.
- Use Barnes-Hut approximation for N > 100 (unlikely in practice).

### 4.2 Hierarchical Layout (Improved)

For the "per-folder" view, use a **treemap-inspired nested layout**:

```
Root
├── src/
│   ├── components/   [Cluster 1: 5 files, Cluster 3: 2 files]
│   ├── services/     [Cluster 2: 8 files]
│   └── utils/        [Cluster 1: 3 files, Cluster 4: 1 file]
├── tests/
│   └── unit/         [Cluster 2: 4 files]
└── config/           [Cluster 5: 2 files]
```

- Folders become **nested containers** (Excalidraw rectangles with children).
- Files inside folders are colored by their cluster assignment.
- Coupling edges connect across folder boundaries, highlighting cross-cutting concerns.
- Container sizes are proportional to file count.

### 4.3 Grid Layout (Fallback / Simple)

Improved version of the current grid:
- **Sorted by coupling** — Highest-coupling clusters placed centrally.
- **Dynamic box sizing** — Width adapts to longest filename; height adapts to file count.
- **Compact mode** — For >20 clusters, show summary boxes (name + stats only, no file list).

---

## 5. View Modes (Expanded)

### Mode 1: Coupling Graph (NEW — Default)

**What:** Force-directed graph where clusters are nodes and coupling edges are links.

**Elements:**
- **Cluster nodes** — Rounded rectangles, sized by file count, colored by coupling intensity.
- **Coupling edges** — Lines between clusters, thickness = coupling strength, color gradient from blue (low) to orange/red (high).
- **File pills** (optional, toggleable) — Small rounded tags inside cluster nodes showing filenames.
- **Edge labels** — Coupling percentage shown on hover or for edges > 30%.
- **Cluster stats badge** — Small overlay showing file count + coupling %.

**Interactions:**
- Hover cluster → show tooltip with full cluster details (files, coupling, churn, authors).
- Click cluster → expand to show file list inline (toggle).
- Click edge → highlight shared files / coupling evidence.
- Double-click cluster → zoom to fill viewport with that cluster.

### Mode 2: Per-Cluster (Improved)

**What:** Each cluster is a detailed card showing its files, grouped by folder.

**Improvements over current:**
- Folder sub-groups inside cluster boxes (nested rectangles with folder name headers).
- Intra-cluster file coupling shown as thin lines between files.
- Better text rendering — multi-line file paths with monospace font.
- No hardcoded 15-file limit — use scrollable regions or paginated expansion.

### Mode 3: Per-Folder (Improved)

**What:** Files grouped by folder path, colored by cluster assignment.

**Improvements over current:**
- **Edges ARE shown** — Coupling edges between clusters are rendered, connecting through the folder containers.
- Folders are nested hierarchically (not flat).
- Cluster color legend integrated into the diagram.
- Cross-cluster files highlighted with a special badge.

### Mode 4: Dependency Matrix (NEW)

**What:** An N×N matrix where cells show coupling strength between cluster pairs.

**Elements:**
- Row/column headers = cluster names.
- Cell color intensity = coupling strength.
- Click cell → show coupling details (shared files, commit evidence).

This is a compact, information-dense view useful when N is large (>15 clusters).

---

## 6. Interactive Features

### 6.1 Structured Element IDs

Every generated Excalidraw element gets a semantically meaningful ID:

```typescript
type ElementIdScheme = 
    | `cluster-box:${number}`        // cluster container
    | `cluster-label:${number}`      // cluster name text
    | `cluster-stats:${number}`      // stats text
    | `file-node:${number}:${string}` // file inside cluster (clusterId:filePath)
    | `folder-group:${string}`       // folder container
    | `edge:${number}-${number}`     // coupling edge (from-to)
    | `edge-label:${number}-${number}` // edge label
    | `legend:${string}`;            // legend elements
```

### 6.2 Hover Tooltip

When hovering over a cluster box, show a floating panel (React overlay, NOT an Excalidraw element) with:

```
┌─────────────────────────────────────┐
│ 🗂 Cluster: Auth & Sessions        │
│                                     │
│ Files:        12                    │
│ Coupling:     78%                   │
│ Total Churn:  2,340 lines           │
│ Top Authors:  alice, bob, charlie   │
│                                     │
│ Top Files:                          │
│   auth/login.ts         (890 churn) │
│   auth/session.ts       (456 churn) │
│   middleware/auth.ts    (312 churn) │
│                                     │
│ Connected to:                       │
│   → User Profile (45% coupling)    │
│   → API Gateway (32% coupling)     │
└─────────────────────────────────────┘
```

**Implementation:** Use `Excalidraw.onChange` to track pointer position + `getSceneElements()` to hit-test against element bounding boxes. Render tooltip as an absolutely-positioned React `<div>` overlaying the Excalidraw canvas.

### 6.3 Click-to-Expand

Clicking a cluster in Coupling Graph mode toggles its expansion:

- **Collapsed** (default): Cluster is a compact rounded rectangle with name + stats.
- **Expanded**: Cluster becomes a larger container showing all files with folder sub-groups.

State management: Keep a `Set<number>` of expanded cluster IDs. On toggle, regenerate elements for that cluster only and call `updateScene()` with the modified elements.

### 6.4 Context Menu

Right-click on elements provides actions:

| Element | Actions |
|---------|---------|
| Cluster box | Expand/Collapse, Zoom to fit, Export cluster CSV, View in Clusters tab, Copy name |
| File node | Open file details, Copy path, View in tree |
| Edge | Show coupling evidence, Highlight shared files |
| Background | Reset view, Fit all, Toggle grid, Change layout |

### 6.5 Minimap

For large diagrams (>10 clusters), show a minimap in the corner:
- Small rectangle showing the full diagram extent.
- Highlighted viewport rectangle showing current visible area.
- Click on minimap to navigate.

> **Note:** Excalidraw has no built-in minimap. Implement as a React overlay using a scaled-down SVG render of the element bounding boxes.

---

## 7. Visual Design System

### 7.1 Color Palette

Reuse the existing `CLUSTER_PALETTE` and `getCouplingColor()` from the design tokens, but add:

```typescript
const EXCALIDRAW_THEME = {
    // Backgrounds
    canvasBg: '#0a0f1e',           // Darker than current for more contrast
    clusterBg: '#111827',          // Dark fill for cluster boxes
    clusterBgHover: '#1e293b',     // Lighter on hover
    folderBg: '#0f172a',           // Folder sub-group fill
    
    // Borders
    clusterBorder: '#334155',      // Default cluster border
    clusterBorderHover: '#64748b', // Hover state
    selectedBorder: '#38bdf8',     // Selected cluster highlight (sky-400)
    
    // Text
    titleText: '#f1f5f9',          // Cluster name (slate-100)
    bodyText: '#cbd5e1',           // File names (slate-300)
    metaText: '#64748b',           // Stats, labels (slate-500)
    accentText: '#38bdf8',         // Links, highlights (sky-400)
    
    // Edges
    edgeLow: '#334155',            // Low coupling (<20%)
    edgeMedium: '#f59e0b',         // Medium coupling (20-50%) — amber
    edgeHigh: '#ef4444',           // High coupling (>50%) — red
    edgeVeryHigh: '#dc2626',       // Very high coupling (>70%) — red-600
    
    // Badges
    fileBadge: '#1e3a5f',          // File count badge bg
    couplingBadge: '#3b1f1f',      // High coupling warning badge bg
};
```

### 7.2 Typography

```typescript
const EXCALIDRAW_FONTS = {
    clusterTitle: { size: 20, family: 3 },   // Excalidraw font family 3 = monospace-like
    fileName: { size: 12, family: 1 },        // Default hand-drawn
    folderName: { size: 14, family: 1 },
    stats: { size: 11, family: 1 },
    edgeLabel: { size: 10, family: 1 },
    legend: { size: 13, family: 1 },
};
```

### 7.3 Element Sizing (Dynamic)

```typescript
function calculateClusterSize(cluster: ClusterData, mode: ViewMode): { width: number; height: number } {
    const fileCount = cluster.files.length;
    const longestFileName = Math.max(...cluster.files.map(f => getFileName(f).length));
    
    // Width: based on longest filename (min 250, max 600)
    const charWidth = 7; // approx px per char at fontSize 12
    const width = Math.max(250, Math.min(600, longestFileName * charWidth + 60));
    
    // Height: based on file count (min 120 for collapsed, scales with files)
    const headerHeight = 50;    // title + stats
    const fileRowHeight = 22;   // per file row
    const footerHeight = 30;    // bottom stats
    const maxVisibleFiles = mode === 'coupling-graph' ? 0 : 30;
    const visibleFiles = Math.min(fileCount, maxVisibleFiles);
    const height = headerHeight + visibleFiles * fileRowHeight + footerHeight;
    
    return { width: Math.round(width), height: Math.round(height) };
}
```

### 7.4 Edge Visual Encoding

| Coupling % | Stroke Width | Color | Opacity | Dash |
|-----------|-------------|-------|---------|------|
| 0–10% | 1px | slate-700 | 30% | dashed |
| 10–25% | 2px | slate-500 | 50% | solid |
| 25–50% | 3px | amber-500 | 70% | solid |
| 50–70% | 4px | red-400 | 85% | solid |
| 70–100% | 5px | red-600 | 100% | solid, glow |

---

## 8. Component Architecture

### 8.1 New File Structure

```
frontend/src/components/clustering/views/excalidraw/
├── index.ts                    # Re-exports
├── ExcalidrawView.tsx          # Main orchestrator (redesigned)
├── ExcalidrawToolbar.tsx       # View mode, layout, export controls
├── ExcalidrawTooltip.tsx       # Hover tooltip overlay
├── ExcalidrawContextMenu.tsx   # Right-click context menu
├── ExcalidrawMinimap.tsx       # Minimap overlay for large diagrams
├── hooks/
│   ├── useExcalidrawScene.ts   # Scene management (API, undo, export)
│   ├── useElementInteraction.ts # Click/hover/context menu handlers
│   └── useLayoutEngine.ts      # Layout computation with caching
├── layout/
│   ├── types.ts                # LayoutNode, LayoutEdge, LayoutResult
│   ├── forceDirected.ts        # Force-directed layout algorithm
│   ├── hierarchical.ts         # Folder-nested hierarchical layout
│   ├── grid.ts                 # Improved grid layout (fallback)
│   └── edgeRouter.ts           # Edge routing (orthogonal + curved)
├── generators/
│   ├── clusterElements.ts      # Cluster box + internal file list generation
│   ├── edgeElements.ts         # Edge + label generation from routed paths
│   ├── legendElements.ts       # Legend, title, annotation generation
│   └── utils.ts                # Shared element creation helpers
└── constants.ts                # Excalidraw-specific theme & sizing constants
```

### 8.2 Redesigned ExcalidrawView

```typescript
// ExcalidrawView.tsx — High-level component structure

interface ExcalidrawViewProps {
    clusters: ClusterData[];
    edges: ClusterEdge[];
    onFileSelect?: (path: string) => void;
}

function ExcalidrawView({ clusters, edges, onFileSelect }: ExcalidrawViewProps) {
    // Layout & view mode
    const [viewMode, setViewMode] = useState<ExcalidrawViewMode>('coupling-graph');
    const [layoutType, setLayoutType] = useState<LayoutType>('force-directed');
    const [expandedClusters, setExpandedClusters] = useState<Set<number>>(new Set());
    const [folderDepth, setFolderDepth] = useState(2);
    
    // Scene management
    const {
        excalidrawRef,
        updateScene,
        scrollToContent,
        exportSvg,
        exportPng,
        exportJson,
    } = useExcalidrawScene();
    
    // Layout computation (memoized + cached)
    const layout = useLayoutEngine({
        clusters,
        edges,
        layoutType,
        viewMode,
        expandedClusters,
        folderDepth,
    });
    
    // Element generation from layout
    const elements = useMemo(() => {
        return generateAllElements(layout, {
            viewMode,
            expandedClusters,
            folderDepth,
            theme: EXCALIDRAW_THEME,
        });
    }, [layout, viewMode, expandedClusters, folderDepth]);
    
    // Interaction handling
    const {
        hoveredElement,
        tooltipData,
        handlePointerMove,
        handlePointerDown,
        handleContextMenu,
    } = useElementInteraction({
        elements,
        clusters,
        edges,
        excalidrawRef,
        onFileSelect,
        onToggleExpand: (clusterId) => {
            setExpandedClusters(prev => {
                const next = new Set(prev);
                next.has(clusterId) ? next.delete(clusterId) : next.add(clusterId);
                return next;
            });
        },
    });
    
    // Sync elements to Excalidraw
    useEffect(() => {
        updateScene(elements);
        scrollToContent();
    }, [elements]);
    
    return (
        <div className="relative">
            <ExcalidrawToolbar
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                layoutType={layoutType}
                onLayoutTypeChange={setLayoutType}
                folderDepth={folderDepth}
                onFolderDepthChange={setFolderDepth}
                onExportSvg={exportSvg}
                onExportPng={exportPng}
                onExportJson={exportJson}
                clusterCount={clusters.length}
            />
            
            <div className="h-[75vh] min-h-[600px] rounded-2xl overflow-hidden border border-slate-800">
                <Excalidraw
                    ref={excalidrawRef}
                    initialData={{ elements, appState: INITIAL_APP_STATE }}
                    theme="dark"
                    onPointerDown={handlePointerDown}
                    onChange={handlePointerMove}
                />
            </div>
            
            {/* Overlays */}
            {tooltipData && (
                <ExcalidrawTooltip data={tooltipData} />
            )}
            
            {clusters.length > 10 && (
                <ExcalidrawMinimap
                    layout={layout}
                    viewportBounds={/* from excalidraw state */}
                />
            )}
        </div>
    );
}
```

### 8.3 Hook: `useExcalidrawScene`

```typescript
// hooks/useExcalidrawScene.ts

interface UseExcalidrawSceneReturn {
    excalidrawRef: React.RefObject<any>;
    updateScene: (elements: ExcalidrawElement[]) => void;
    scrollToContent: (padding?: number) => void;
    fitToViewport: () => void;
    exportSvg: () => Promise<void>;
    exportPng: () => Promise<void>;
    exportJson: () => void;
    getAppState: () => any;
    hasUnsavedEdits: boolean;
}

function useExcalidrawScene(): UseExcalidrawSceneReturn {
    // Encapsulates ALL Excalidraw API interaction
    // - Debounced scene updates to prevent flicker
    // - Smart diffing: only update changed elements
    // - Export with proper error handling
    // - Unsaved edit tracking via deep comparison
}
```

### 8.4 Hook: `useLayoutEngine`

```typescript
// hooks/useLayoutEngine.ts

interface UseLayoutEngineOptions {
    clusters: ClusterData[];
    edges: ClusterEdge[];
    layoutType: LayoutType;
    viewMode: ExcalidrawViewMode;
    expandedClusters: Set<number>;
    folderDepth: number;
}

function useLayoutEngine(options: UseLayoutEngineOptions): LayoutResult {
    // - Runs layout algorithm (force-directed, hierarchical, or grid)
    // - Memoizes result — only recomputes when inputs change
    // - For force-directed: runs simulation in requestAnimationFrame loop
    //   (or Web Worker for large graphs)
    // - Applies edge routing after node positions are finalized
    // - Returns LayoutResult with positioned nodes and routed edges
}
```

---

## 9. Implementation Phases

### Phase 1: Foundation (Priority: Critical)

**Goal:** Replace the current broken layout with force-directed positioning and clean edge routing.

| Task | Description | Files |
|------|-------------|-------|
| **1.1** Define layout types | Create `LayoutNode`, `LayoutEdge`, `LayoutResult` interfaces | `layout/types.ts` |
| **1.2** Force-directed layout | Implement spring-force simulation (attraction by coupling, repulsion, gravity, overlap resolution) | `layout/forceDirected.ts` |
| **1.3** Edge router | Implement basic curved edge routing (bezier curves avoiding node overlap) | `layout/edgeRouter.ts` |
| **1.4** Refactor element generators | Separate element creation from layout; generators consume `LayoutResult` | `generators/clusterElements.ts`, `generators/edgeElements.ts`, `generators/utils.ts` |
| **1.5** Scene management hook | Encapsulate Excalidraw API calls, debounced updates, smart diffing | `hooks/useExcalidrawScene.ts` |
| **1.6** Update ExcalidrawView | Wire up new layout engine + generators; remove old inline generation | `ExcalidrawView.tsx` |
| **1.7** Dynamic cluster sizing | Calculate box dimensions from file count + longest filename | `generators/clusterElements.ts` |
| **1.8** Visual edge encoding | Implement coupling-strength → visual encoding (thickness, color, opacity, dash) | `generators/edgeElements.ts` |

**Acceptance Criteria:**
- Clusters are positioned so that highly-coupled clusters are visually closer.
- Edges don't cut through cluster boxes.
- Box sizes adapt to content.
- Diagram auto-fits viewport on generation.

### Phase 2: Interactivity (Priority: High)

| Task | Description | Files |
|------|-------------|-------|
| **2.1** Element interaction hook | Map element IDs to semantic entities; handle click, hover, context menu | `hooks/useElementInteraction.ts` |
| **2.2** Hover tooltip | React overlay showing cluster/file/edge details on hover | `ExcalidrawTooltip.tsx` |
| **2.3** Click-to-expand | Toggle cluster expansion to show/hide file list | `ExcalidrawView.tsx`, `generators/clusterElements.ts` |
| **2.4** Context menu | Right-click actions: zoom to fit, export, navigate | `ExcalidrawContextMenu.tsx` |
| **2.5** Toolbar redesign | Clean toolbar with view mode, layout type, export buttons | `ExcalidrawToolbar.tsx` |

**Acceptance Criteria:**
- Hovering a cluster shows detailed tooltip.
- Clicking a cluster toggles file list visibility.
- Right-click provides contextual actions.
- Toolbar integrates cleanly with the shared `ViewFiltersBar`.

### Phase 3: Advanced Views (Priority: Medium)

| Task | Description | Files |
|------|-------------|-------|
| **3.1** Hierarchical layout engine | Treemap-inspired nested folder layout | `layout/hierarchical.ts` |
| **3.2** Improved grid layout | Sorted by coupling, dynamic sizing, compact mode | `layout/grid.ts` |
| **3.3** Per-Folder view with edges | Render coupling edges in folder-grouped view | `generators/edgeElements.ts` |
| **3.4** Dependency Matrix view | NxN coupling matrix as Excalidraw elements | New generator |
| **3.5** Minimap | Scaled-down overview for large diagrams | `ExcalidrawMinimap.tsx` |

### Phase 4: Polish & Performance (Priority: Medium)

| Task | Description | Files |
|------|-------------|-------|
| **4.1** Animation | Smooth transitions when expanding/collapsing clusters | Scene management |
| **4.2** Web Worker layout | Offload force simulation to worker for large graphs | `layout/forceDirected.worker.ts` |
| **4.3** Layout caching | Cache computed layouts; invalidate on data change | `hooks/useLayoutEngine.ts` |
| **4.4** Export improvements | Export with legend, title, and timestamp watermark | `hooks/useExcalidrawScene.ts` |
| **4.5** Keyboard shortcuts | `F` = fit to viewport, `E` = expand all, `C` = collapse all, `1-4` = view modes | `ExcalidrawView.tsx` |
| **4.6** Undo/redo for manual edits | Track manual modifications and support undo | `hooks/useExcalidrawScene.ts` |

---

## 10. File Structure

### Before (Current)

```
excalidraw/
└── elementGenerator.ts    ← 659 lines, everything in one file
```

### After (Redesigned)

```
excalidraw/
├── index.ts                        # Re-exports
├── ExcalidrawView.tsx              # Main orchestrator (~150 lines)
├── ExcalidrawToolbar.tsx           # Controls bar (~80 lines)
├── ExcalidrawTooltip.tsx           # Hover tooltip (~100 lines)
├── ExcalidrawContextMenu.tsx       # Right-click menu (~80 lines)
├── ExcalidrawMinimap.tsx           # Minimap overlay (~120 lines)
├── constants.ts                    # Theme, sizing, font config (~80 lines)
├── hooks/
│   ├── useExcalidrawScene.ts       # Scene API wrapper (~120 lines)
│   ├── useElementInteraction.ts    # Interaction handlers (~150 lines)
│   └── useLayoutEngine.ts          # Layout orchestration (~80 lines)
├── layout/
│   ├── types.ts                    # Layout interfaces (~50 lines)
│   ├── forceDirected.ts            # Force-directed algorithm (~200 lines)
│   ├── hierarchical.ts             # Treemap nested layout (~180 lines)
│   ├── grid.ts                     # Improved grid layout (~100 lines)
│   └── edgeRouter.ts               # Edge routing algorithms (~150 lines)
└── generators/
    ├── clusterElements.ts          # Cluster box generation (~150 lines)
    ├── edgeElements.ts             # Edge + label generation (~100 lines)
    ├── legendElements.ts           # Legend, annotations (~80 lines)
    └── utils.ts                    # Shared helpers (~80 lines)
```

**Total: ~1,900 lines across 17 files** (vs. current 947 lines across 2 files).  
More code, but each file has a single responsibility and is independently testable.

---

## 11. API Reference

### Layout Engine Interface

Every layout engine implements this interface:

```typescript
interface LayoutEngine {
    name: string;
    compute(
        clusters: ClusterData[],
        edges: ClusterEdge[],
        options: LayoutOptions
    ): LayoutResult;
}

interface LayoutOptions {
    viewMode: ExcalidrawViewMode;
    folderDepth: number;
    expandedClusters: Set<number>;
    canvasWidth?: number;    // hint for aspect ratio
    canvasHeight?: number;
}
```

### Element Generator Interface

```typescript
interface ElementGenerator {
    generate(
        layout: LayoutResult,
        options: GeneratorOptions
    ): ExcalidrawElement[];
}

interface GeneratorOptions {
    viewMode: ExcalidrawViewMode;
    expandedClusters: Set<number>;
    folderDepth: number;
    theme: typeof EXCALIDRAW_THEME;
    hoveredClusterId?: number;
    selectedClusterId?: number;
}
```

### Structured Element ID Format

```typescript
// Parse an element ID to determine what it represents
function parseElementId(id: string): ParsedElement | null {
    const patterns = [
        { regex: /^cluster-box:(\d+)$/, type: 'cluster' as const },
        { regex: /^cluster-label:(\d+)$/, type: 'cluster-label' as const },
        { regex: /^file-node:(\d+):(.+)$/, type: 'file' as const },
        { regex: /^folder-group:(.+)$/, type: 'folder' as const },
        { regex: /^edge:(\d+)-(\d+)$/, type: 'edge' as const },
        { regex: /^edge-label:(\d+)-(\d+)$/, type: 'edge-label' as const },
    ];
    // ...
}
```

---

## Design Decisions & Trade-offs

| Decision | Rationale | Alternative Considered |
|----------|-----------|----------------------|
| Force-directed as default layout | Best visual encoding of coupling relationships | Hierarchical (less intuitive for coupling); Circular (wastes space) |
| React overlays for tooltip/context menu | Richer UI than Excalidraw text elements; proper event handling | Excalidraw-native elements (limited styling, no interactivity) |
| Structured element IDs | Enables interaction without maintaining a separate lookup map | UUID-based IDs with side map (more complex) |
| Separate layout from generation | Allows swapping layout algorithms without changing rendering; easier testing | Monolithic generator (current; unmaintainable) |
| Not using `@excalidraw/excalidraw`'s collaboration features | Not needed for read-only visualization; reduces complexity | Collaboration mode (overkill for this use case) |
| Keeping Excalidraw as the rendering engine | Interactive canvas, export capabilities, zoom/pan for free | Custom Canvas2D (too much work); D3.js (no hand-drawn aesthetic); react-flow (different paradigm) |

---

## Success Metrics

After full implementation, the Excalidraw view should:

1. ✅ **Spatial coupling encoding** — A user can glance at the diagram and immediately identify which clusters are tightly coupled (they're close together with thick edges).
2. ✅ **Zero visual clutter** — No overlapping edges/boxes, no truncated labels, no wasted whitespace.
3. ✅ **Instant comprehension** — The diagram is understandable within 5 seconds for someone unfamiliar with the codebase.
4. ✅ **Graceful scaling** — Works cleanly from 2 clusters to 50+.
5. ✅ **Interactive exploration** — Users can hover, click, expand, and drill down without leaving the view.
6. ✅ **Export-ready** — Exported SVG/PNG is presentation-quality with legend and title.
7. ✅ **Performance** — Layout computation < 500ms for 50 clusters; no jank during interaction.
