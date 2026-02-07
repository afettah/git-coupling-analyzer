# Frontend Architecture & UX

> **Status**: Structure complete, git features working, other features are shells/stubs

---

## Implementation Status

### ✅ Implemented
- **Routing & Layout**: Feature-based routing with tabs (dashboard, git, deps, semantic, graph, risk, settings) — `src/frontend/src/App.tsx`, `src/frontend/src/config/navigation.ts`
- **API Clients**: Full typed Axios clients for all domains — `src/frontend/src/api/` (repos, git, analyzers, deps, semantic, graph, risk, intelligence)
- **Global Error Handling**: Interceptor + `ErrorNotification` component — `src/frontend/src/api/client.ts`, `src/frontend/src/shared/ErrorNotification.tsx`
- **Git Features** (fully functional):
  - `ClusteringView`, `FileDetailsPanel`, `FolderDetailsPanel`, `FolderTree`, `HotspotsView`, `ImpactGraph`, `TimeMachineView` — `src/frontend/src/features/git/`
- **Deps Feature** (UI shells, no backend):
  - `ImportGraph`, `ExternalPackages`, `CircularDeps`, `DepsLayout` — `src/frontend/src/features/deps/`
- **Semantic Feature** (UI shells, no backend):
  - `DomainMap`, `DomainDetail`, `BridgeEntities`, `SemanticLayout` — `src/frontend/src/features/semantic/`
- **Graph Feature** (UI shell): `KnowledgeGraph` — `src/frontend/src/features/graph/`
- **Risk Feature** (UI shells): `RiskOverview`, `RiskFileTable`, `RiskLayout` — `src/frontend/src/features/risk/`
- **Dashboard**: `AnalysisDashboard`, `AnalyzerStatusPanel`, `ProjectDashboard`, `RiskSignalsWidget`, `DomainOverviewWidget` — `src/frontend/src/features/dashboard/`
- **Shared UI**: Breadcrumbs, CommandPalette, ExportPanel, GlobalFiltersPanel, KeyboardShortcutsModal, AlgorithmInfoModal — `src/frontend/src/shared/`
- **Design Tokens**: Colors, spacing, typography, animations, shadows, borders — `src/frontend/src/design-tokens/`
- **Hooks**: useDebounce, useLocalStorage, useClickOutside — `src/frontend/src/hooks/`
- **Stores**: filterStore (Zustand-like) — `src/frontend/src/stores/`

### 🔧 TODO
- [ ] Wire deps feature components to real API (needs backend routers first)
- [ ] Wire semantic feature components to real API
- [ ] Wire graph/risk/intelligence features to real API
- [ ] Implement `useAnalyzerStatus` hook for task polling
- [ ] Add D3 visualizations for import graph, domain map, knowledge graph
- [ ] Add cross-linking between features (click file → see coupling + imports + domains)
- [ ] Settings page: analyzer configuration forms per-type

### ⚠️ Issues
- Frontend API clients (`deps.ts`, `semantic.ts`, `risk.ts`, etc.) define endpoints that don't exist in the backend yet
- No loading/empty states for unimplemented analyzer views

### 💡 Improvements
- Add React Query or SWR for data fetching + caching
- Add skeleton loading states for all feature views

---

## Design principles

- Feature-based organization: one feature per analyzer (git, deps, semantic, graph, risk).
- API 1-1 proxy: `frontend/src/api/*` maps directly to orchestrator routers.
- Shared UI primitives and cross-linking between features (files, domains, risks).

## Routes & Information Architecture

- /repos → Repo list
- /repos/:id/dashboard → Combined intelligence dashboard
- /repos/:id/git/coupling → Coupling graph
- /repos/:id/git/files → File tree
- /repos/:id/deps/graph → Import graph
- /repos/:id/semantic/domains → Domain map
- /repos/:id/graph → Knowledge graph explorer
- /repos/:id/risk → Risk overview
- /repos/:id/settings → Analyzer configuration and run controls

## Component organization (high level)

- `src/api/` — Axios clients for repos, analyzers, git, deps, semantic, graph, risk, intelligence.
- `src/features/` — Feature folders for `git/`, `deps/`, `semantic/`, `graph/`, `risk/`, `dashboard/`.
- `src/shared/` — Buttons, Cards, Modal, Table, etc.
- `hooks/` — `useAnalyzerStatus`, `useGraphData`, `useDebounce`.

## UX flow & wireframes (summary)

- Dashboard gives a combined view (files, commits, domains, risk score).
- Knowledge graph explorer shows multi-source edges (git, imports, semantic) with filters.
- Feature deep-dive pages (file detail, domain detail, import cycle lists) link back to the graph and risks.

## Implementation notes

- Keep API clients thin — frontend should not contain business logic.
- Use D3 for graphs and visualizations; keep components small and testable.
- Use Zustand or local React state for lightweight stores.

---

*For API endpoint reference see the orchestrator routers in `platform/code_intel/routers/`.*