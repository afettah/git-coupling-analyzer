# Task: Enhanced Cluster View

**Status:** Partially Done  
**Priority:** High  

---

## Overview

A complete redesign of the Cluster View to provide a modern, interactive, and feature-rich experience for exploring and analyzing file clusters. This task transforms the current basic clustering interface into a multi-view, shareable, and visually stunning analysis workspace.

---

## Problem Statement

The current cluster view is limited in functionality and visual appeal:
- No persistent snapshot management (landing page for saved analyses)
- Limited visualization options (only list/card view)
- Poor file organization and navigation
- No external tool integrations (Excalidraw, 3D visualization)
- Lack of interactive filtering and exploration tools

---

## Goals

1. **Unified Snapshot Hub** — Entry point showing all clustering snapshots with run-new-analysis CTA
2. **Multi-View Tabs** — Switch between Clusters, Excalidraw, and Project City views
3. **Rich Cluster Cards** — Sortable, filterable cards with deep-dive capabilities
4. **Hierarchical File Explorer** — Folder tree with expand/collapse and summary views
5. **Excalidraw Integration** — Auto-generated diagrams of cluster relationships
6. **Project City Visualization** — 3D/2D city metaphor for codebase architecture

---

## Detailed Feature Specifications

### 1. Clustering Landing Page (Snapshot Hub)

When the user opens the Clustering section, they should see a **dashboard-style landing page**, not an immediate analysis view.

#### Layout
```
┌─────────────────────────────────────────────────────────────────┐
│  🔍 Search snapshots...                     [+ Run New Analysis] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📊 Recent Snapshots                                             │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ │
│  │ Snapshot #12     │ │ Snapshot #11     │ │ Snapshot #10     │ │
│  │ Louvain • 24 cls │ │ L. Propagation   │ │ Spectral         │ │
│  │ 2 hours ago      │ │ Yesterday        │ │ 3 days ago       │ │
│  │ ⭐ 85% coupling  │ │ ⭐ 78% coupling  │ │ ⭐ 82% coupling  │ │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘ │
│                                                                  │
│  📁 All Snapshots (32 total)                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Name     │ Algorithm   │ Clusters │ Coupling │ Created     │ │
│  ├──────────┼─────────────┼──────────┼──────────┼─────────────┤ │
│  │ Snap #12 │ Louvain     │ 24       │ 85%      │ 2h ago      │ │
│  │ Snap #11 │ Label Prop. │ 18       │ 78%      │ 1d ago      │ │
│  │ ···      │ ···         │ ···      │ ···      │ ···         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Features
| Feature | Description |
|---------|-------------|
| **Recent Cards** | Top 3-6 most recent snapshots as visual cards with key metrics |
| **Full Table View** | Sortable, paginated table of all snapshots |
| **Search & Filter** | Filter by algorithm, date range, coupling threshold |
| **Bulk Actions** | Multi-select for compare, delete, export |
| **Quick Compare** | Select 2 snapshots and see diff immediately |
| **Run New** | Prominent CTA redirects to analysis wizard |

#### Snapshot Card Metrics
- **Name** (editable with inline rename)
- **Algorithm Used** (with info tooltip)
- **Cluster Count**
- **Average Coupling %**
- **Files Analyzed**
- **Created At** (relative time)
- **Status Badges** (e.g., "Baseline", "Draft", "Shared")

---

### 2. Snapshot Detail View (Multi-Tab Interface)

When a snapshot is opened (or after running a new analysis), redirect to `/clustering/{snapshotId}` with a tabbed interface.

#### URL Structure
```
/repos/{repoId}/clustering                     → Landing page
/repos/{repoId}/clustering/{snapshotId}        → Snapshot detail (default: Clusters tab)
/repos/{repoId}/clustering/{snapshotId}/city   → Project City view
/repos/{repoId}/clustering/{snapshotId}/draw   → Excalidraw view
```

#### Tab Bar Design
```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Snapshots    Snapshot: "Feature Analysis v2"        │
├────────────┬────────────┬────────────┬──────────────────────────┤
│  📊 Clusters │  🎨 Excalidraw │  🏙️ Project City │         [Actions ▼] │
└────────────┴────────────┴────────────┴──────────────────────────┘
```

---

### 3. Clusters Tab — Card & Explorer View

The primary view showing all detected clusters with rich filtering and interaction capabilities.

#### 3.1 Global Controls Bar

```
┌─────────────────────────────────────────────────────────────────┐
│ View: [Cards ▼]  Sort: [Coupling ▼]  Depth: [3 ▼]  🔍 Filter... │
│ Coupling: ══════●════════ 40-100%   Files: ════●══════ 5-500    │
└─────────────────────────────────────────────────────────────────┘
```

| Control | Options |
|---------|---------|
| **View Mode** | Cards, Compact List, Table |
| **Sort By** | Coupling % (default), File Count, Folder Count, Churn, Name |
| **Sort Order** | Descending (default), Ascending |
| **Folder Depth** | 1-10 (affects folder count and grouping) |
| **Coupling Range** | Slider (min-max percentage) |
| **File Count Range** | Slider (min-max files) |
| **Search** | Full-text search across file names and paths |
| **Tag Filter** | Filter by user-applied tags |

#### 3.2 Cluster Card Design

Each cluster is displayed as a rich, interactive card:

```
┌─────────────────────────────────────────────────────────────────┐
│  📦 auth-middleware                                    [···]    │
│  ─────────────────────────────────────────────────────────────  │
│  │ Coupling      Files       Folders     Churn                  │
│  │ ████████ 87%  24 files    6 folders   +1,245 / -892         │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  📂 Top Folders                                                  │
│  • src/auth (8 files)                                           │
│  • src/middleware (6 files)                                     │
│  • src/utils/security (4 files)                                 │
│                                                                  │
│  📄 Preview Files (showing 5 of 24)                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🔥 auth.service.ts        │ 📁 src/auth        │ 245 LOC  │   │
│  │    jwt.middleware.ts      │ 📁 src/middleware  │ 128 LOC  │   │
│  │    password.utils.ts      │ 📁 src/utils       │ 89 LOC   │   │
│  │    session.manager.ts     │ 📁 src/auth        │ 156 LOC  │   │
│  │    token.validator.ts     │ 📁 src/auth        │ 67 LOC   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  [Show all 24 files]               [📥 Export] [🔍 Explore]     │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.3 Card Elements

| Element | Description |
|---------|-------------|
| **Cluster Name** | Auto-generated or user-defined, editable inline |
| **Menu (···)** | Rename, Tag, Export, Remove from view, Compare |
| **Coupling Bar** | Visual progress bar with percentage |
| **File Count** | Total files in cluster |
| **Folder Count** | Unique folders (respects depth setting) |
| **Churn** | Lines added/removed in files (from git history) |
| **Top Folders** | 3 most common folder paths |
| **Preview Files** | Top 5 files sorted by coupling contribution |
| **Hot File Icon** | 🔥 for high-churn files |
| **Path Toggle** | Show filename only (default) or full path |
| **Actions** | Export cluster, Explore details |

#### 3.4 File Detail Modal

When clicking "Show all files" or "Explore", open a rich modal:

```
┌─────────────────────────────────────────────────────────────────┐
│  📦 Cluster: auth-middleware                              [×]   │
├─────────────────────────────────────────────────────────────────┤
│  View: [Tree ▼]  Path: [Filename ▼]  Sort: [Coupling ▼]         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📁 src                                                          │
│   ├── 📁 auth (8 files, 87% avg coupling)                       │
│   │    ├── 🔥 auth.service.ts                    87%  245 LOC   │
│   │    ├──    session.manager.ts                 82%  156 LOC   │
│   │    ├──    token.validator.ts                 79%  67 LOC    │
│   │    └── ···  (5 more files)                                  │
│   ├── 📁 middleware (6 files, 81% avg coupling)                 │
│   │    ├──    jwt.middleware.ts                  85%  128 LOC   │
│   │    ├──    auth.middleware.ts                 80%  94 LOC    │
│   │    └── ···  (4 more files)                                  │
│   └── 📁 utils/security (4 files, 75% avg coupling)             │
│        ├──    password.utils.ts                  78%  89 LOC    │
│        └── ···  (3 more files)                                  │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│  📊 Cluster Insights                                             │
│   • Highest churn: auth.service.ts (+423/-287 in 45 commits)   │
│   • Common authors: @alice (34%), @bob (28%), @charlie (18%)    │
│   • Peak activity: Sprint 42 (Oct 2025)                         │
│  ─────────────────────────────────────────────────────────────  │
│                     [Export to CSV]  [Close]                     │
└─────────────────────────────────────────────────────────────────┘
```

---

### 4. Folder Tree Organization

Files within a cluster can be viewed in multiple organizational modes:

#### View Modes
| Mode | Description |
|------|-------------|
| **Flat List** | Simple list of all files, sortable by any column |
| **Folder Tree** | Hierarchical tree matching project structure |
| **Folder Summary** | Collapsed view showing folder-level aggregates |

#### Folder Summary Mode

```
┌─────────────────────────────────────────────────────────────────┐
│  📁 Folder                    │ Files │ Coupling │ Churn        │
├───────────────────────────────┼───────┼──────────┼──────────────┤
│  ▶ src/auth                   │ 8     │ 87%      │ +1,023/-678  │
│  ▶ src/middleware             │ 6     │ 81%      │ +456/-234    │
│  ▶ src/utils/security         │ 4     │ 75%      │ +234/-123    │
│  ▶ tests/auth                 │ 6     │ 72%      │ +189/-67     │
└─────────────────────────────────────────────────────────────────┘
```

Clicking `▶` expands to show individual files.

---

### 5. Excalidraw Integration

A collaborative whiteboard view with auto-generated cluster diagrams.

#### 5.1 Initial Generation

When the Excalidraw tab is opened for the first time, generate a diagram:

```
┌─────────────────────────────────────────────────────────────────┐
│  🎨 Excalidraw View                  [⟳ Regenerate] [⬇ Export]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│         ┌──────────────┐                                        │
│         │   Cluster    │                                        │
│         │    Auth      │       ┌──────────────┐                 │
│         │  (24 files)  │──────▶│   Cluster    │                 │
│         │    87%       │  42%  │    API       │                 │
│         └──────────────┘       │  (18 files)  │                 │
│               │                │    73%       │                 │
│               │ 38%            └──────────────┘                 │
│               ▼                       │                         │
│         ┌──────────────┐              │ 55%                     │
│         │   Cluster    │              ▼                         │
│         │   Database   │◀─────┌──────────────┐                 │
│         │  (12 files)  │  67% │   Cluster    │                 │
│         │    65%       │      │   Utils      │                 │
│         └──────────────┘      │  (8 files)   │                 │
│                               │    58%       │                 │
│                               └──────────────┘                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 5.2 Diagram Elements

| Element | Representation |
|---------|----------------|
| **Cluster** | Rounded rectangle with name, file count, coupling % |
| **Inter-cluster Edge** | Arrow with coupling % between clusters |
| **Edge Thickness** | Proportional to coupling strength |
| **Color Coding** | Based on coupling strength (green→yellow→red) |

#### 5.3 User Interactions

- **Drag & Position** — Reposition clusters freely
- **Edit Labels** — Rename clusters inline
- **Add Notes** — Place sticky notes for annotations
- **Draw Boundaries** — Group clusters with shapes
- **Export** — PNG, SVG, or native Excalidraw JSON

#### 5.4 Implementation Approach

**Option A: Embedded Excalidraw Library** (Recommended)
```typescript
// npm install @excalidraw/excalidraw
import { Excalidraw, exportToSvg } from "@excalidraw/excalidraw";

const ClusterExcalidraw = ({ clusters, interClusterEdges }) => {
  const elements = useMemo(() => 
    generateClusterDiagram(clusters, interClusterEdges), 
    [clusters]
  );
  
  return (
    <Excalidraw 
      initialData={{ elements }}
      onChange={(elements) => saveToSnapshot(elements)}
    />
  );
};
```

**Option B: iFrame Integration**
- Generate Excalidraw scene JSON
- Open in Excalidraw web app via URL with scene data

---

### 6. Project City Visualization

A 3D city metaphor where folders are blocks/districts and files are buildings.

#### 6.1 Concept

```
┌─────────────────────────────────────────────────────────────────┐
│  🏙️ Project City               [🔄 View Mode ▼] [📷 Screenshot]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│    ┌─────┐ ┌───────┐     ┌─────────────┐                        │
│    │░░░░░│ │███████│     │             │  Legend:               │
│    │░░░░░│ │███████│     │   ┌───┐     │  █ High coupling       │
│    │░░░░░│ │███████│     │   │███│     │  ▓ Medium coupling     │
│    └─────┘ └───────┘     │   │███│     │  ░ Low coupling        │
│    src/auth  src/api     │   └───┘     │                        │
│                          │  src/core   │  Height = LOC          │
│     ┌───────────────┐    └─────────────┘  Area = File count     │
│     │ ▓▓▓ ▓▓▓ ▓▓▓  │                                           │
│     │ ▓▓▓ ▓▓▓ ▓▓▓  │    Camera: [Orbit] [Top-down] [Side]      │
│     │              │                                            │
│     └──────────────┘    Zoom: ─────●───── 75%                   │
│       src/utils                                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 6.2 Visual Encoding

| Property | Visual Representation |
|----------|----------------------|
| **Folder** | City block / District boundary |
| **File** | Building within district |
| **Building Height** | Lines of Code (LOC) |
| **Building Color** | Cluster membership (each cluster = unique hue) |
| **Building Opacity** | Coupling strength (more opaque = higher coupling) |
| **District Size** | Number of files in folder |

#### 6.3 View Modes

| Mode | Description |
|------|-------------|
| **By Structure** | Folders as districts, colored by cluster membership |
| **By Cluster** | Clusters as districts, showing project structure overlap |
| **Inverted** | Files grouped by cluster, with structural colors |

#### 6.4 Interactivity

- **Hover** — Show file/folder details tooltip
- **Click** — Select file, highlight related files in same cluster
- **Zoom** — Mouse wheel or pinch gesture
- **Rotate** — Click and drag (3D mode)
- **Pan** — Right-click and drag

#### 6.5 Implementation Approach

**Recommended Library: Three.js with React Three Fiber**

```typescript
// npm install three @react-three/fiber @react-three/drei
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Box, Text } from '@react-three/drei';

const ProjectCity = ({ folders, clusters }) => {
  return (
    <Canvas camera={{ position: [50, 50, 50] }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      {folders.map((folder, i) => (
        <CityBlock 
          key={folder.path}
          position={calculateGridPosition(i)}
          files={folder.files}
          clusters={clusters}
        />
      ))}
      <OrbitControls />
    </Canvas>
  );
};

const CityBlock = ({ position, files, clusters }) => (
  <group position={position}>
    {files.map((file, i) => (
      <Box
        key={file.path}
        position={calculateBuildingPosition(i, files.length)}
        args={[1, file.loc / 100, 1]} // Height based on LOC
        material-color={getClusterColor(file.clusterId, clusters)}
      />
    ))}
  </group>
);
```

**Alternative: CodeCity / Treemap Library**
- `d3-treemap` for 2D representation
- `vis.gl` for WebGL-based visualization

---

## Implementation Guidelines

### Phase 1: Foundation (Week 1)

#### 1.1 Routing & State Management

```typescript
// frontend/src/App.tsx
import { Routes, Route } from 'react-router-dom';

<Routes>
  <Route path="/repos/:repoId/clustering" element={<ClusteringHub />} />
  <Route path="/repos/:repoId/clustering/:snapshotId" element={<SnapshotDetail />}>
    <Route index element={<ClustersTab />} />
    <Route path="city" element={<ProjectCity />} />
    <Route path="draw" element={<ExcalidrawView />} />
  </Route>
</Routes>
```

#### 1.2 New Component Structure

```
frontend/src/components/
├── clustering/
│   ├── ClusteringHub.tsx          # Landing page with snapshots
│   ├── SnapshotDetail.tsx         # Tab container
│   ├── ClustersTab.tsx            # Main clusters view
│   ├── ClusterCard.tsx            # Individual cluster card
│   ├── ClusterModal.tsx           # File detail modal
│   ├── ExcalidrawView.tsx         # Excalidraw integration
│   ├── ProjectCity.tsx            # 3D city view
│   ├── FilterBar.tsx              # Global controls
│   ├── FolderTree.tsx             # Hierarchical file tree
│   └── hooks/
│       ├── useSnapshots.ts        # Snapshot CRUD
│       ├── useClusters.ts         # Cluster data & filtering
│       └── useClusterDiagram.ts   # Excalidraw generation
```

#### 1.3 API Extensions

```typescript
// backend/lfca/api.py - New endpoints needed

# Snapshot management
GET  /repos/{id}/clustering/snapshots              # List all snapshots
POST /repos/{id}/clustering/snapshots              # Create snapshot
GET  /repos/{id}/clustering/snapshots/{sid}        # Get snapshot detail
PUT  /repos/{id}/clustering/snapshots/{sid}        # Update (rename, tags)
DELETE /repos/{id}/clustering/snapshots/{sid}      # Delete snapshot

# Cluster insights
GET  /repos/{id}/clustering/snapshots/{sid}/insights
     # Returns: churn per file, commit count, author distribution

# Inter-cluster relationships
GET  /repos/{id}/clustering/snapshots/{sid}/edges
     # Returns: coupling between clusters for Excalidraw/City views
```

### Phase 2: Core UI (Week 2)

#### 2.1 ClusteringHub Component

```typescript
// ClusteringHub.tsx - Pseudocode
const ClusteringHub = () => {
  const { snapshots, loading, create, delete } = useSnapshots(repoId);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);

  return (
    <PageContainer>
      <Header>
        <SearchInput onChange={handleSearch} />
        <Button onClick={() => navigate('new')}>
          <Plus /> Run New Analysis
        </Button>
      </Header>

      <Section title="Recent Snapshots">
        <CardGrid>
          {snapshots.slice(0, 6).map(snap => (
            <SnapshotCard 
              key={snap.id}
              snapshot={snap}
              onSelect={() => navigate(snap.id)}
              onCompareToggle={() => toggleCompare(snap.id)}
            />
          ))}
        </CardGrid>
      </Section>

      <Section title="All Snapshots">
        <DataTable 
          data={snapshots}
          columns={snapshotColumns}
          sortable
          selectable
          onRowClick={(snap) => navigate(snap.id)}
        />
      </Section>

      {selectedForCompare.length === 2 && (
        <CompareButton onClick={handleCompare}>
          Compare Selected
        </CompareButton>
      )}
    </PageContainer>
  );
};
```

#### 2.2 ClusterCard Component

```typescript
// ClusterCard.tsx
interface ClusterCardProps {
  cluster: ClusterData;
  folderDepth: number;
  onExplore: () => void;
  onExport: () => void;
}

const ClusterCard = ({ cluster, folderDepth, onExplore, onExport }) => {
  const [expanded, setExpanded] = useState(false);
  
  const topFolders = useMemo(() => 
    aggregateFolders(cluster.files, folderDepth).slice(0, 3),
    [cluster, folderDepth]
  );
  
  const previewFiles = useMemo(() =>
    cluster.files
      .sort((a, b) => b.coupling - a.coupling)
      .slice(0, 5),
    [cluster]
  );

  return (
    <Card>
      <CardHeader>
        <ClusterName editable onRename={handleRename}>
          {cluster.name}
        </ClusterName>
        <DropdownMenu>
          <MenuItem onClick={handleRename}>Rename</MenuItem>
          <MenuItem onClick={handleTag}>Add Tag</MenuItem>
          <MenuItem onClick={onExport}>Export</MenuItem>
        </DropdownMenu>
      </CardHeader>

      <MetricBar>
        <Metric label="Coupling" value={cluster.coupling} format="percent" />
        <Metric label="Files" value={cluster.files.length} />
        <Metric label="Folders" value={topFolders.length} />
        <Metric label="Churn" value={cluster.churn} format="delta" />
      </MetricBar>

      <FolderList folders={topFolders} />
      
      <FilePreview 
        files={previewFiles}
        pathMode={pathMode}
      />

      <CardActions>
        <Button variant="ghost" onClick={() => setExpanded(!expanded)}>
          Show all {cluster.files.length} files
        </Button>
        <Button onClick={onExplore}>Explore</Button>
        <Button variant="outline" onClick={onExport}>Export</Button>
      </CardActions>
    </Card>
  );
};
```

### Phase 3: Excalidraw Integration (Week 3)

#### 3.1 Install Dependencies

```bash
npm install @excalidraw/excalidraw
```

#### 3.2 Diagram Generation Logic

```typescript
// hooks/useClusterDiagram.ts
import { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types';

export const generateClusterDiagram = (
  clusters: ClusterData[],
  interClusterEdges: ClusterEdge[]
): ExcalidrawElement[] => {
  const elements: ExcalidrawElement[] = [];
  
  // Layout clusters in a force-directed or grid layout
  const positions = calculateLayout(clusters, interClusterEdges);
  
  // Create cluster rectangles
  clusters.forEach((cluster, i) => {
    elements.push({
      id: `cluster-${cluster.id}`,
      type: 'rectangle',
      x: positions[i].x,
      y: positions[i].y,
      width: 200,
      height: 100,
      backgroundColor: getCouplingColor(cluster.coupling),
      roundness: { type: 3 },
      // ... other Excalidraw properties
    });
    
    // Add text labels
    elements.push({
      id: `label-${cluster.id}`,
      type: 'text',
      x: positions[i].x + 10,
      y: positions[i].y + 10,
      text: `${cluster.name}\n${cluster.files.length} files • ${cluster.coupling}%`,
      // ...
    });
  });
  
  // Create edges between clusters
  interClusterEdges.forEach(edge => {
    elements.push({
      id: `edge-${edge.from}-${edge.to}`,
      type: 'arrow',
      startBinding: { elementId: `cluster-${edge.from}` },
      endBinding: { elementId: `cluster-${edge.to}` },
      strokeWidth: Math.max(1, edge.strength * 5),
      // ...
    });
  });
  
  return elements;
};
```

### Phase 4: Project City (Week 4)

#### 4.1 Install Dependencies

```bash
npm install three @react-three/fiber @react-three/drei
```

#### 4.2 City Component Structure

```typescript
// ProjectCity.tsx
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';

const ProjectCity = ({ snapshot }) => {
  const { folders, clusters } = useProcessedCityData(snapshot);
  const [viewMode, setViewMode] = useState<'structure' | 'cluster'>('structure');
  const [hoveredFile, setHoveredFile] = useState(null);

  return (
    <div className="city-container">
      <CityControls viewMode={viewMode} onViewModeChange={setViewMode} />
      
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[50, 50, 50]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 20, 10]} castShadow />
        
        <CityGround />
        
        {viewMode === 'structure' ? (
          <StructureView folders={folders} clusters={clusters} />
        ) : (
          <ClusterView clusters={clusters} />
        )}
        
        <OrbitControls 
          enablePan 
          enableZoom 
          enableRotate
          maxPolarAngle={Math.PI / 2.1}
        />
      </Canvas>
      
      {hoveredFile && <FileTooltip file={hoveredFile} />}
    </div>
  );
};
```

---

## API Response Schemas

### Snapshot List Response

```json
{
  "snapshots": [
    {
      "id": "snap_12345",
      "name": "Feature Analysis Q4",
      "algorithm": "louvain",
      "algorithm_params": { "resolution": 1.2 },
      "cluster_count": 24,
      "file_count": 342,
      "avg_coupling": 0.85,
      "created_at": "2026-01-27T14:30:00Z",
      "tags": ["baseline", "reviewed"],
      "repo_sha": "abc123..."
    }
  ]
}
```

### Cluster Detail Response

```json
{
  "cluster": {
    "id": "cluster_001",
    "name": "auth-middleware",
    "coupling": 0.87,
    "files": [
      {
        "path": "src/auth/auth.service.ts",
        "filename": "auth.service.ts",
        "folder": "src/auth",
        "coupling_contribution": 0.92,
        "loc": 245,
        "churn": { "additions": 423, "deletions": 287 },
        "commit_count": 45,
        "is_hot": true
      }
    ],
    "folder_summary": [
      { "path": "src/auth", "file_count": 8, "avg_coupling": 0.87 },
      { "path": "src/middleware", "file_count": 6, "avg_coupling": 0.81 }
    ],
    "insights": {
      "top_authors": [
        { "name": "alice", "percentage": 0.34 },
        { "name": "bob", "percentage": 0.28 }
      ],
      "peak_activity_period": "2025-10-01/2025-10-31"
    }
  }
}
```

### Inter-Cluster Edges Response

```json
{
  "edges": [
    {
      "from_cluster": "cluster_001",
      "to_cluster": "cluster_002",
      "coupling_strength": 0.42,
      "shared_commits": 28,
      "shared_files": ["src/config.ts"]
    }
  ]
}
```

---

## Acceptance Criteria

### Must Have (MVP)
- [x] Clustering landing page with snapshot cards and table
- [x] URL-based routing for snapshots
- [x] Tab navigation (Clusters, Excalidraw, City)
- [x] Cluster cards with core metrics (coupling, files, churn)
- [x] File detail modal with folder tree view
- [x] Sorting and filtering controls
- [x] Export to CSV functionality

### Should Have
- [x] Excalidraw integration with auto-generated diagrams (basic layout)
- [x] Project City 3D visualization (basic layout)
- [ ] Inline cluster renaming (needs backend support)
- [x] Snapshot comparison selection
- [x] Hot file indicators

### Nice to Have
- [ ] Custom tags for snapshots
- [ ] Excalidraw save/restore
- [x] City view mode toggle (structure vs cluster)
- [ ] Screenshot/export for City view
- [ ] Keyboard shortcuts

---

## Technical Notes

### Performance Considerations
- Virtualize long file lists (use `react-window` or `@tanstack/virtual`)
- Lazy load Excalidraw and Three.js bundles (dynamic imports)
- Memoize folder aggregation calculations
- Use Web Workers for city layout calculations

### Accessibility
- Ensure all interactive elements are keyboard navigable
- Provide ARIA labels for visualization elements
- Support reduced motion preferences
- Maintain sufficient color contrast

### Testing Strategy
- Unit tests for folder aggregation logic
- Component tests for card and modal interactions
- E2E tests for complete user flows
- Visual regression tests for city/excalidraw views
