# Interactive Dependency Graph Visualization

## Pain / Problem

The current LFCA visualization shows coupling edges and file nodes, but it's a **static, flat graph**. For large repositories (400+ files), the graph becomes an unreadable hairball. The speech describes this exact pain: *"When zoomed in, the graph looks simple. But zooming out reveals the complexity."*

Developers need to:
- **Explore** the graph at different abstraction levels (file → folder → module → service).
- **Filter** by coupling type, strength threshold, or time window.
- **Overlay** different data layers (coupling strength, change frequency, code ownership, batch assignment).
- **Interact** with the graph (click a node to see details, select a cluster to plan work).

Without these capabilities, the graph is interesting but not actionable.

## Idea

Upgrade the existing frontend graph visualization into a **multi-layer, zoomable, filterable dependency explorer** with:

- **Semantic zoom**: at high zoom, show individual files with coupling edges; at low zoom, automatically collapse into folders/modules with aggregated edge weights.
- **Collapsible clusters**: click a folder to expand/collapse its contents.
- **Filter panel**: filter by coupling strength, file type, time window, author, change frequency.
- **Overlays**: toggle layers for coupling edges, static imports, co-change heatmap, batch coloring.
- **Selection actions**: select a subgraph and trigger actions (impact analysis, batch planning, export).

## Expected Added Value

| Dimension | Impact |
|---|---|
| **Comprehension** | Developers can actually understand the architecture of a 1000-file repo. |
| **Navigation** | Semantic zoom lets users move from big picture to specific file in seconds. |
| **Discovery** | Hidden coupling hotspots become visible through heatmap overlays. |
| **Actionability** | Select-and-act workflow connects visualization directly to refactoring/analysis tools. |
| **Presentation** | Clean, interactive graphs are shareable in architecture reviews and sprint planning. |

## Pseudo Front Screens

### Screen 1 — High-Level View (Module Level)
```
┌────────────────────────────────────────────────────────────────┐
│  🌐 Dependency Explorer — openhands                            │
│                                                                │
│  Zoom: ━━━━━●━━━━━━━  Module level                            │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                                                          │  │
│  │        ┌──────────┐         ┌──────────┐                 │  │
│  │        │  agent/   │════════▶│  core/   │                 │  │
│  │        │  (42 files)│        │  (18 files)│                │  │
│  │        └─────┬─────┘         └─────┬─────┘                │  │
│  │              │                     │                       │  │
│  │              ▼                     ▼                       │  │
│  │        ┌──────────┐         ┌──────────┐                 │  │
│  │        │ runtime/ │         │  utils/  │                 │  │
│  │        │  (31 files)│        │  (12 files)│                │  │
│  │        └──────────┘         └──────────┘                 │  │
│  │                                                          │  │
│  │  Edge thickness = aggregated coupling strength            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  Layers: [✓ Coupling] [✓ Imports] [ ] Heatmap] [ ] Batches]   │
│  Filter: strength > [0.3]  period: [Last 6 months ▼]          │
└────────────────────────────────────────────────────────────────┘
```

### Screen 2 — Zoomed Into a Module
```
┌────────────────────────────────────────────────────────────────┐
│  🌐 Dependency Explorer — openhands / agent /                  │
│                                                                │
│  Zoom: ━━━━━━━━━●━━━  File level                              │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                                                          │  │
│  │    codeact_agent.py ──── manager.py ──── __init__.py     │  │
│  │         │      ╲                │                         │  │
│  │         │       ╲               │                         │  │
│  │    prompts/      browsing_agent.py                       │  │
│  │    system.py          │                                   │  │
│  │         │              │                                   │  │
│  │    micro_agent.py ────┘                                   │  │
│  │                                                          │  │
│  │  ── import     ═══ strong coupling (>0.7)                 │  │
│  │  -- weak coupling   🔴 high churn node                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  Selected: codeact_agent.py                                    │
│  Coupling: 8 edges | Imports: 4 | Imported by: 6              │
│  [View Impact] [Add to Batch] [Show History]                   │
└────────────────────────────────────────────────────────────────┘
```

### Screen 3 — Heatmap Overlay
```
┌────────────────────────────────────────────────────────────────┐
│  🌐 Dependency Explorer — Heatmap: Change Frequency            │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                                                          │  │
│  │    🟥 codeact_agent.py ─── 🟧 manager.py                 │  │
│  │         │                        │                        │  │
│  │    🟨 prompts/system.py    🟩 __init__.py                 │  │
│  │         │                                                 │  │
│  │    🟥 browsing_agent.py                                   │  │
│  │                                                          │  │
│  │  🟥 >50 changes  🟧 20-50  🟨 10-20  🟩 <10              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  Heatmap: [Change Frequency ▼]                                 │
│  Also available: Coupling Density | Code Age | Author Count    │
└────────────────────────────────────────────────────────────────┘
```

## Pseudo High Level Flow

```
1. User opens Dependency Explorer for a repository
2. Backend loads:
       │
       ├── Dependency graph (static imports)
       ├── Coupling graph (LFCA edges with scores)
       ├── File metadata (change frequency, authors, age)
       └── Folder structure (for hierarchical grouping)
       │
3. Frontend renders initial view at module level:
       │
       ├── Folders as collapsed super-nodes
       ├── Edges = aggregated coupling + dependency weights
       └── D3 force-directed layout with constraints
       │
4. User interactions:
       │
       ├── Zoom in → expand folder nodes into file nodes
       ├── Zoom out → collapse files back into folder nodes
       ├── Click node → show detail panel (coupling list, stats)
       ├── Toggle layer → show/hide coupling, imports, heatmap
       ├── Adjust filter → re-query with new threshold/time window
       ├── Select subgraph → enable action buttons
       └── Drag selection → trigger batch planning or impact analysis
       │
5. Semantic zoom algorithm:
       │
       ├── Compute visible viewport bounds
       ├── Determine appropriate abstraction level
       ├── Merge/split nodes dynamically
       └── Recalculate layout with animation
```

## High Level Design

```
┌──────────────────────────────────────────────────────────────────┐
│                          Frontend (React)                         │
│                                                                  │
│  ┌─────────────┐  ┌──────────────────┐  ┌───────────────────┐   │
│  │ FilterPanel  │  │  GraphCanvas     │  │  DetailPanel      │   │
│  │              │  │  (D3 + Canvas)   │  │                   │   │
│  │ - Strength   │  │                  │  │ - Node info       │   │
│  │ - Time range │  │ - Force layout   │  │ - Coupling list   │   │
│  │ - File type  │  │ - Semantic zoom  │  │ - Change history  │   │
│  │ - Layers     │  │ - Collapsible    │  │ - Actions         │   │
│  │              │  │   clusters       │  │                   │   │
│  └──────┬───────┘  └────────┬─────────┘  └────────┬──────────┘   │
│         │                   │                      │              │
│         └───────────┬───────┴──────────────────────┘              │
│                     │  Shared state (Zustand / Context)           │
└─────────────────────┬────────────────────────────────────────────┘
                      │  REST API
┌─────────────────────▼────────────────────────────────────────────┐
│                       Backend (FastAPI)                            │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                      │
│  │  Graph Builder    │  │  Aggregation     │                      │
│  │                   │  │  Service         │                      │
│  │ - Load dep graph  │  │                  │                      │
│  │ - Load coupling   │  │ - Folder-level   │                      │
│  │ - Merge into      │  │   aggregation    │                      │
│  │   unified graph   │  │ - Threshold      │                      │
│  │ - Apply filters   │  │   filtering      │                      │
│  │                   │  │ - Time windowing  │                      │
│  └────────┬──────────┘  └────────┬─────────┘                      │
│           │                      │                                │
│  ┌────────▼──────────────────────▼───────────────────────────┐    │
│  │                    LFCA Data Layer                          │    │
│  │  edges_file_topk.parquet | edges_folder.parquet | metadata │    │
│  └────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Responsibility |
|---|---|
| **GraphCanvas** | D3-based canvas renderer with force layout, semantic zoom, and cluster collapse. |
| **FilterPanel** | Controls for coupling threshold, time window, file type, and layer toggles. |
| **DetailPanel** | Shows node/edge details, coupling evidence, and action buttons. |
| **Graph Builder** | Merges dependency + coupling graphs, applies filters, returns unified graph JSON. |
| **Aggregation Service** | Computes folder-level super-nodes and aggregated edge weights for zoomed-out views. |
