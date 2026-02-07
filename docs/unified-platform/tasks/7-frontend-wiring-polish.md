# Frontend Wiring & Polish

> **Priority**: Medium — tracks frontend work across all phases
> **Design doc**: `docs/unified-platform/7-FRONTEND.md`

## Summary
Frontend components and API clients exist for all features, but most are shells awaiting backend endpoints.

## Tasks

### API Wiring (blocked on backend routers)
- [ ] Wire deps feature components when `/repos/{id}/deps/*` endpoints exist
- [ ] Wire semantic feature components when `/repos/{id}/semantic/*` endpoints exist
- [ ] Wire graph feature when `/repos/{id}/graph/*` endpoints exist
- [ ] Wire risk feature when `/repos/{id}/risk/*` endpoints exist
- [ ] Wire intelligence dashboard when `/repos/{id}/intelligence/*` endpoints exist

### UX Improvements
- [ ] Add loading/empty/error states for all feature views (currently no fallback)
- [ ] Implement `useAnalyzerStatus` hook for task polling
- [ ] Add cross-feature linking (click file → see coupling + imports + domains)
- [ ] Settings page: per-analyzer configuration forms

### Visualization
- [ ] D3 import graph visualization in `ImportGraph` component
- [ ] D3 domain map visualization in `DomainMap` component
- [ ] D3 knowledge graph visualization in `KnowledgeGraph` component

### Technical Debt
- [ ] Consider React Query / TanStack Query for data fetching + caching
- [ ] Add skeleton loading states
- [ ] Audit TypeScript errors (check `tsc_errors.txt` at project root)
