# Frontend Migration Status Report

**Date**: 2025-02-07  
**Target**: Align frontend with UNIFIED_PLATFORM_DESIGN.md  
**Scope**: Frontend only (no backend changes required)

---

## Executive Summary

The current frontend implementation is **70% aligned** with the unified platform design. The core structure is in place with proper feature-based organization, but several key API modules, types, and screens are missing or incomplete.

### Overall Progress

| Category | Status | Progress |
|----------|--------|----------|
| Project Structure | ✅ Complete | 100% |
| API Client Layer | 🟡 Partial | 40% |
| Type Definitions | 🟡 Partial | 45% |
| Core Features | 🟡 Partial | 65% |
| Navigation | ✅ Complete | 100% |
| Shared Components | ✅ Complete | 100% |

---

## ✅ What Has Been Implemented

### 1. Project Structure ✅
**Status**: Fully aligned with design

```
frontend/src/
├── api/          ✅ Exists (but incomplete)
├── types/        ✅ Exists (but missing many types)
├── features/     ✅ Properly organized by domain
│   ├── repos/    ✅ Complete
│   ├── dashboard/ ✅ Exists
│   ├── git/      ✅ Substantial implementation
│   ├── deps/     ✅ Layout exists
│   ├── semantic/ ✅ Layout exists
│   ├── graph/    ✅ Basic implementation
│   ├── risk/     ✅ Layout exists
│   └── settings/ ✅ Exists
├── shared/       ✅ Complete with reusable primitives
├── hooks/        ✅ Custom hooks implemented
├── stores/       ✅ State management ready
├── config/       ✅ Navigation config complete
└── design-tokens/ ✅ Theme system in place
```

### 2. Navigation System ✅
**Status**: Complete and matches design

- ✅ Top-level tabs: Dashboard, Git, Deps, Semantic, Graph, Risk, Settings
- ✅ Git subtabs: Coupling, Files, Hotspots, Clustering, Timeline
- ✅ Routing structure matches `/repos/:id/<feature>/<subfeature>` pattern
- ✅ Navigation config in `config/navigation.ts`

### 3. Core Components ✅
**Status**: All shared UI primitives implemented

- ✅ Button, Card, Modal, Badge, Tabs, Table, Tooltip, Spinner
- ✅ ErrorBoundary, EmptyState
- ✅ Consistent styling with TailwindCSS v4 + slate/sky color palette
- ✅ Icon system using `lucide-react`

### 4. API Client Foundation ✅
**Status**: Core infrastructure complete

- ✅ Axios client with base URL configuration
- ✅ Global error interceptor
- ✅ Error notification system
- ✅ `ApiErrorInfo` type definition

### 5. Implemented API Modules

#### repos.ts ✅ Complete
```typescript
✅ getRepos()
✅ createRepo()
✅ deleteRepo()
```

#### git.ts 🟢 Well-developed (70% complete)
```typescript
✅ Types: AnalysisStatus, FileInfo, CoupledFile, ClusterResult, etc.
✅ Analysis endpoints (analyze, status, config)
✅ File endpoints (files, fileDetails, fileTree, folderDetails)
✅ Coupling endpoints (coupling, couplingGraph, couplingEvidence)
✅ Hotspots endpoint
✅ Clustering endpoints (runClustering, compareSnapshots)
✅ Timeline/trends endpoints
⚠️ Missing: some author stats, validation log endpoints
```

### 6. Implemented Features

#### Git Feature 🟢 Substantial (75%)
```
✅ CouplingGraph (D3 force-directed)
✅ FileTree + FileDetailsPanel
✅ FolderDetailsPanel
✅ HotspotsView
✅ TimeMachineView
✅ ClusteringView with full workspace
✅ Clustering comparison tools
⚠️ Missing: AuthorStats component
```

#### Dashboard Feature 🟡 Basic (50%)
```
✅ AnalysisDashboard layout
✅ Basic stat display
⚠️ Missing: Combined intelligence widgets
⚠️ Missing: Analyzer status panel
⚠️ Missing: Risk signals widget
⚠️ Missing: Trend charts
```

#### Repos Feature ✅ Complete
```
✅ RepoList
✅ RepoCard
✅ CreateRepoModal
✅ Delete functionality
```

---

## 🟡 What Needs to Be Implemented

### 1. Missing API Modules 🔴 CRITICAL

According to UNIFIED_PLATFORM_DESIGN.md section 6.3, we need these API modules:

#### `api/analyzers.ts` ❌ MISSING
```typescript
// Required endpoints per design doc lines 1181-1190
export const listAnalyzers = (repoId: string) => ...
export const runAnalyzer = (repoId: string, type: string, config?: any) => ...
export const getAnalyzerStatus = (repoId: string, type: string) => ...
export const getTaskHistory = (repoId: string) => ...
export const getTask = (repoId: string, taskId: string) => ...
```

#### `api/deps.ts` ❌ MISSING
```typescript
// Required per design doc lines 1244-1248
export const getImportGraph = (repoId: string, filters?: any) => ...
export const getFileImports = (repoId: string, filePath: string) => ...
export const getCircularDeps = (repoId: string) => ...
export const getExternalPackages = (repoId: string) => ...
export const getDepsStats = (repoId: string) => ...
```

#### `api/semantic.ts` ❌ MISSING
```typescript
// Required per design doc lines 1254-1260
export const getDomains = (repoId: string) => ...
export const getDomain = (repoId: string, domainId: number) => ...
export const classifyFile = (repoId: string, filePath: string) => ...
export const getSimilarFiles = (repoId: string, filePath: string) => ...
export const getFileTokens = (repoId: string, filePath: string) => ...
export const getBridgeEntities = (repoId: string) => ...
```

#### `api/graph.ts` ❌ MISSING
```typescript
// Required per design doc lines 1266-1272
export const searchEntities = (repoId: string, query: any) => ...
export const getEntity = (repoId: string, entityId: number) => ...
export const getRelationships = (repoId: string, filters?: any) => ...
export const getNeighbors = (repoId: string, entityId: number) => ...
export const findPath = (repoId: string, fromId: number, toId: number) => ...
export const getGraphStats = (repoId: string) => ...
```

#### `api/risk.ts` ❌ MISSING
```typescript
// Required per design doc lines 1278-1280
export const getRiskOverview = (repoId: string) => ...
export const getRiskFiles = (repoId: string, filters?: any) => ...
export const getRiskFolders = (repoId: string) => ...
```

#### `api/intelligence.ts` ❌ MISSING
```typescript
// Required per design doc lines 1278-1280 (intelligence section)
export const getIntelligenceDashboard = (repoId: string) => ...
export const getArchitectureMap = (repoId: string) => ...
export const getCorrelations = (repoId: string) => ...
```

### 2. Missing Type Definitions 🟡 IMPORTANT

Create proper TypeScript types mirroring backend models:

#### `types/entity.ts` ❌ MISSING
```typescript
export interface Entity {
    entity_id: number;
    qualified_name: string;
    name: string;
    kind: string; // 'file' | 'class' | 'function' | 'package' | 'external_package'
    language?: string;
    parent_id?: number;
    metadata: Record<string, any>;
}

export interface Relationship {
    rel_id: number;
    source_type: string; // 'git' | 'deps' | 'semantic' | 'intelligence'
    rel_kind: string;
    src_entity_id: number;
    dst_entity_id: number;
    weight: number;
    metadata: Record<string, any>;
    run_id?: string;
}

export interface Domain {
    domain_id: number;
    name: string;
    label?: string;
    description?: string;
    coherence_score: number;
    member_count: number;
    top_terms: string[];
}
```

#### `types/analyzer.ts` ❌ MISSING
```typescript
export interface AnalyzerInfo {
    type: string;
    name: string;
    description: string;
    available: boolean;
    last_run?: string;
    status?: TaskStatus;
}

export interface TaskStatus {
    task_id: string;
    analyzer_type: string;
    state: 'not_run' | 'pending' | 'running' | 'completed' | 'failed';
    stage?: string;
    progress?: number;
    started_at?: string;
    completed_at?: string;
    error?: string;
}

export interface TaskResult {
    task_id: string;
    success: boolean;
    result?: any;
    error?: string;
}
```

#### `types/deps.ts` ❌ MISSING
```typescript
export interface ImportInfo {
    import_id: number;
    src_entity_id: number;
    dst_entity_id: number;
    src_path: string;
    dst_path: string;
    import_type: 'static' | 'dynamic';
    is_external: boolean;
    is_dynamic: boolean;
}

export interface CircularDep {
    cycle_id: number;
    cycle_path: string[]; // Array of file paths forming the cycle
    cycle_length: number;
}

export interface ExternalPackage {
    name: string;
    usage_count: number;
    importing_files: number;
}
```

#### `types/graph.ts` ❌ MISSING
```typescript
export interface GraphNode {
    id: number;
    entity: Entity;
    degree: number;
    domain?: string;
}

export interface GraphEdge {
    source: number;
    target: number;
    source_type: string;
    rel_kind: string;
    weight: number;
}

export interface PathResult {
    path: Entity[];
    length: number;
    total_weight: number;
}
```

#### `types/risk.ts` ❌ MISSING
```typescript
export interface RiskScore {
    entity_id: number;
    path: string;
    overall_risk: number;
    coupling_risk: number;
    dependency_risk: number;
    churn_risk: number;
    semantic_risk: number;
    signals: RiskSignal[];
}

export interface RiskSignal {
    category: string;
    severity: 'high' | 'medium' | 'low';
    description: string;
    value?: number;
}

export interface RiskOverview {
    overall_score: number;
    category_scores: {
        coupling: number;
        dependency: number;
        churn: number;
        semantic: number;
    };
    high_risk_count: number;
    medium_risk_count: number;
    distribution: Array<{ bucket: string; count: number }>;
}
```

### 3. Missing Feature Components 🟡 IMPORTANT

#### Dashboard Feature - Enhanced Widgets
```
❌ AnalyzerStatusPanel.tsx  - Show status of all analyzers with run controls
❌ RiskSignalsWidget.tsx    - Top risk files mini-list
❌ DomainOverviewWidget.tsx - Domain summary visualization
❌ TrendChart.tsx           - Multi-line area chart for metrics over time
🟡 StatCards.tsx            - Enhance with data from all analyzers
```

#### Dependencies Feature
```
❌ ImportGraph.tsx           - D3 force graph for import relationships
❌ ExternalPackages.tsx      - Treemap of external dependencies
❌ CircularDeps.tsx          - Cycle visualization with path highlighting
❌ FileImportDetail.tsx      - Side panel showing imports/imported-by
🟡 DepsLayout.tsx            - Exists but needs tab implementation
```

#### Semantic Feature
```
❌ DomainMap.tsx             - D3 bubble/pack chart of domains
❌ DomainDetail.tsx          - Files, terms, cross-coupling for domain
❌ DomainList.tsx            - Table view of all domains
❌ BridgeEntities.tsx        - Multi-domain entities list
❌ FileSemanticDetail.tsx    - Classification + tokens for file
❌ DomainBadge.tsx           - Reusable domain tag component
🟡 SemanticLayout.tsx        - Exists but needs tab implementation
```

#### Graph Feature
```
🟡 KnowledgeGraph.tsx        - Exists but needs enhancement
❌ GraphCanvas.tsx           - D3 multi-edge renderer (multiple sources)
❌ EntityDetail.tsx          - All signals for one entity
❌ PathFinder.tsx            - Shortest path visualization
❌ GraphFilters.tsx          - Source type, weight, kind toggles
```

#### Risk Feature
```
❌ RiskOverview.tsx          - Scorecard + gauge visualization
❌ RiskTreemap.tsx           - D3 treemap by folder
❌ RiskFileTable.tsx         - Sortable table of risky files
❌ RiskSignalBadge.tsx       - Signal pill component
🟡 RiskLayout.tsx            - Exists but needs tab implementation
```

#### Settings Feature
```
❌ GitSettings.tsx           - Git analysis config form
❌ DepsSettings.tsx          - Dependency analysis config form
❌ SemanticSettings.tsx      - Semantic analysis config form
❌ AnalyzerRunPanel.tsx      - Run/status controls for analyzers
```

#### Git Feature - Missing Pieces
```
❌ AuthorStats.tsx           - Author contribution analysis
⚠️ Enhance FileDetail.tsx    - Add semantic domain info
⚠️ Enhance CouplingGraph.tsx - Add multi-source edge coloring
```

### 4. Missing Hooks 🟢 LOW PRIORITY

```
❌ useAnalyzerStatus.ts      - Poll analyzer status with auto-refresh
❌ useGraphData.ts           - Fetch + cache graph subsets efficiently
```

### 5. Missing Route Definitions 🟡 IMPORTANT

Update `App.tsx` to include all routes from design doc section 6.2:

```typescript
// Currently missing or incomplete:
/repos/:id/git/authors
/repos/:id/deps/graph
/repos/:id/deps/external
/repos/:id/deps/circular
/repos/:id/deps/files/:path
/repos/:id/semantic/domains
/repos/:id/semantic/domains/:id
/repos/:id/semantic/files/:path
/repos/:id/semantic/bridges
/repos/:id/graph (knowledge graph)
/repos/:id/graph/entities/:id
/repos/:id/risk
/repos/:id/risk/files
/repos/:id/risk/folders
```

---

## 📋 Implementation Priority

### 🔴 Phase 1: Critical Foundation (Week 1)

1. **Create missing API modules**
   - `api/analyzers.ts` - Required for running any analysis
   - `api/deps.ts` - Core dependency analysis
   - `api/semantic.ts` - Core semantic analysis
   - `api/graph.ts` - Unified knowledge graph queries
   - `api/risk.ts` - Risk scoring
   - `api/intelligence.ts` - Combined insights

2. **Create missing type definitions**
   - `types/entity.ts` - Core entity model
   - `types/analyzer.ts` - Task and status types
   - `types/deps.ts` - Dependency types
   - `types/graph.ts` - Graph query types
   - `types/risk.ts` - Risk scoring types

3. **Update Dashboard**
   - Add AnalyzerStatusPanel with run controls
   - Add RiskSignalsWidget
   - Add basic trend visualization

### 🟡 Phase 2: Feature Completion (Week 2)

4. **Implement Dependencies Feature**
   - ImportGraph component with D3
   - ExternalPackages treemap
   - CircularDeps visualization
   - FileImportDetail panel
   - Wire up DepsLayout with tabs

5. **Implement Semantic Feature**
   - DomainMap bubble chart
   - DomainDetail view
   - DomainList table
   - BridgeEntities view
   - FileSemanticDetail panel
   - DomainBadge component
   - Wire up SemanticLayout with tabs

6. **Implement Risk Feature**
   - RiskOverview scorecard
   - RiskTreemap by folder
   - RiskFileTable sortable
   - RiskSignalBadge component
   - Wire up RiskLayout with tabs

### 🟢 Phase 3: Enhancement (Week 3)

7. **Enhance Graph Feature**
   - GraphCanvas multi-source edges
   - EntityDetail comprehensive view
   - PathFinder visualization
   - GraphFilters panel

8. **Settings Feature**
   - GitSettings form
   - DepsSettings form
   - SemanticSettings form
   - AnalyzerRunPanel controls

9. **Git Feature Enhancements**
   - AuthorStats component
   - Add domain badges to FileDetail
   - Multi-source edge coloring in CouplingGraph

10. **Utility Hooks**
    - useAnalyzerStatus with polling
    - useGraphData with caching

---

## 🎯 Key Design Decisions & Patterns

### API Call Pattern
```typescript
// All API functions follow this pattern:
export const getFunctionName = (repoId: string, ...params) =>
    client.get<ResponseType>(`/repos/${repoId}/path`).then(res => res.data);
```

### Component Organization
```
features/<domain>/
  ├── MainLayout.tsx       # Tab container (if multi-tab)
  ├── ViewComponent.tsx    # Primary views
  ├── DetailPanel.tsx      # Side panels
  └── components/          # Feature-specific subcomponents
```

### Cross-Linking Pattern
```typescript
// Any file path is clickable
<Link to={`/repos/${repoId}/git/files/${encodedPath}`}>
  {path}
</Link>

// Any entity is clickable
<Link to={`/repos/${repoId}/graph/entities/${entityId}`}>
  {entity.name}
</Link>
```

### State Management
- Use React Query or SWR for server state
- Use Zustand stores for UI state (filters, selections)
- Keep component state local when possible

---

## 🐛 Known Issues to Fix

1. **Import path in App.tsx** (Line 8)
   ```typescript
   // Current:
   import ClusteringWorkspace from './features/git/ClusteringView';
   // Should verify this path is correct
   ```

2. **Old API imports**
   - Some components still import from `api.ts` instead of modular API files
   - Need to update all imports to use `/api/<module>.ts` pattern

3. **Type consistency**
   - Ensure all API response types match backend Pydantic models
   - Add proper null handling for optional fields

4. **Error boundary placement**
   - Add error boundaries around major feature sections
   - Implement proper error recovery UI

---

## 📊 Estimated Effort

| Phase | Tasks | Estimated Hours | Priority |
|-------|-------|----------------|----------|
| Phase 1: API & Types | 8 files | 16-20 hours | 🔴 Critical |
| Phase 2: Feature Components | 15 components | 30-40 hours | 🟡 High |
| Phase 3: Enhancements | 10 items | 20-25 hours | 🟢 Medium |
| **Total** | **33 items** | **66-85 hours** | |

---

## 🎨 Design Compliance

### ✅ Already Compliant
- TailwindCSS v4 with slate color palette (950 bg, 400 text, sky-500 accent)
- `cn()` utility for class merging
- Lucide React icons exclusively
- Feature-based organization
- Shared component library

### 🟡 Needs Attention
- Ensure all D3 visualizations use consistent color scheme
- Verify all forms follow design token spacing/typography
- Add loading states with consistent spinner component
- Ensure all tables use shared Table component

---

## 🚀 Next Steps

1. **Start with Phase 1**: Create all missing API modules and types
2. **Test API endpoints**: Verify backend endpoints match expected schema
3. **Implement Dashboard enhancements**: Add analyzer status panel first
4. **Feature-by-feature completion**: Dependencies → Semantic → Risk → Graph
5. **Integration testing**: Verify cross-linking between features
6. **Polish & refinement**: Loading states, error handling, responsive design

---

## 📝 Notes

- **No backward compatibility required**: Clean slate to align with new design
- **Backend is ready**: All endpoints defined in UNIFIED_PLATFORM_DESIGN.md should be implemented in the platform orchestrator
- **Database schema is unified**: All analyzers write to the same SQLite database per repo
- **Frontend is the only migration needed**: Backend architecture is already restructured

---

## ✅ Definition of Done

The frontend migration will be considered **complete** when:

1. ✅ All API modules from section 6.3 are implemented
2. ✅ All type definitions match backend models
3. ✅ All routes from section 6.2 are functional
4. ✅ All feature components from section 6.3 are implemented
5. ✅ Dashboard shows combined intelligence from all analyzers
6. ✅ Cross-linking works between all features
7. ✅ Error handling is consistent across all views
8. ✅ Loading states are implemented for async operations
9. ✅ All visualizations follow design system
10. ✅ No console errors or TypeScript errors

---

**End of Report**
