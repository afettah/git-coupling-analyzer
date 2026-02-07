# Project Intelligence Implementation

> **Priority**: Medium (Phase 4)
> **Depends on**: git-analyzer (✅ done), dep-analyzer, semantic-analyzer
> **Design doc**: `docs/unified-platform/10-INTELLIGENCE.md`

## Summary
Implement the cross-source intelligence layer: risk scoring, architecture maps, coupling correlation.

## Tasks

### Interface (blocker — gap in current interfaces)
- [ ] Define `IntelligenceAnalyzerAPI` in `src/platform/code_intel/interfaces/intelligence.py`
- [ ] Add `get_intel_api()` to `AnalyzerRegistry`

### Backend
- [ ] Create `src/project-intelligence/project_intel/plugin.py` — `IntelPlugin(BaseAnalyzer)` + `IntelAPI`
- [ ] Create `src/project-intelligence/project_intel/risk_model.py` — combine signals into risk scores
- [ ] Create `src/project-intelligence/project_intel/cross_coupling.py` — cross-source correlation
- [ ] Create `src/project-intelligence/project_intel/architecture_map.py` — architecture view
- [ ] Add `intel_risk_scores` table to `schema.py`
- [ ] Create routers: `risk.py`, `intelligence.py` in `src/platform/code_intel/routers/`
- [ ] Register `IntelPlugin` in `app.py`

### Graph Layer (orchestrator-owned)
- [ ] Implement graph query layer in `src/platform/code_intel/graph/` (neighbors, paths, subgraphs)
- [ ] Create `src/platform/code_intel/routers/graph.py`

### Frontend
- [ ] Wire `KnowledgeGraph` to real API + D3 graph visualization
- [ ] Wire `RiskOverview` + `RiskFileTable` to real API
- [ ] Wire `ProjectDashboard`, `RiskSignalsWidget`, `DomainOverviewWidget` to real APIs

### Testing
- [ ] Add unit tests in `tests/test_project_intelligence/`
- [ ] Integration test: full pipeline → risk scores make sense
