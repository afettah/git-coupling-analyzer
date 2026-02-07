# Project Intelligence (Cross-source intelligence)

> **Status**: ❌ Not Implemented — only scaffolding exists

---

## Implementation Status

### ✅ Implemented
- Package scaffolding: `src/project-intelligence/pyproject.toml`, `src/project-intelligence/project_intel/__init__.py`
- Frontend UI shells: `ProjectDashboard`, `RiskSignalsWidget`, `DomainOverviewWidget` — `src/frontend/src/features/dashboard/`
- Risk feature shells: `RiskOverview`, `RiskFileTable`, `RiskLayout` — `src/frontend/src/features/risk/`
- Graph feature shell: `KnowledgeGraph` — `src/frontend/src/features/graph/`
- Frontend API clients with types — `src/frontend/src/api/intelligence.ts`, `src/frontend/src/api/risk.ts`, `src/frontend/src/api/graph.ts`
- Navigation tabs configured (graph, risk in top nav)

### 🔧 TODO
- [ ] Define `IntelligenceAnalyzerAPI` interface in `src/platform/code_intel/interfaces/` (missing — unlike dep/semantic, no interface exists yet)
- [ ] Create `project_intel/plugin.py` — `IntelPlugin` implementing `BaseAnalyzer`
- [ ] Create `project_intel/risk_model.py` — combine coupling, dependency, churn, semantic signals
- [ ] Create `project_intel/cross_coupling.py` — correlate coupling across sources
- [ ] Create `project_intel/architecture_map.py` — domains + dependency graphs → architecture view
- [ ] Add `intel_risk_scores` table to `schema.py`
- [ ] Implement graph query layer in `src/platform/code_intel/graph/` (currently empty `__init__.py`)
- [ ] Create routers: `risk.py`, `intelligence.py`, `graph.py` in `src/platform/code_intel/routers/`
- [ ] Register `IntelPlugin` in `app.py`
- [ ] Wire all frontend components to real API + add D3 knowledge graph visualization
- [ ] Add tests in `tests/test_project_intelligence/`

### ⚠️ Issues
- This analyzer depends on output from git, deps, and semantic analyzers — must run last
- No `IntelligenceAnalyzerAPI` interface defined yet (gap vs dep/semantic which have interfaces)
- `registry.py` has `get_dep_api()` and `get_semantic_api()` helper methods but no `get_intel_api()`

### 💡 Improvements
- Risk model should be configurable (weight parameters per signal)
- Consider incremental risk updates when only one analyzer re-runs

---

## Purpose

Combine signals from git, dependency, and semantic analyzers to produce unified insights: per-file risk scores, architecture maps, cross-coupling correlations, and other cross-source analytics.

## Project layout highlights

- `project_intel/plugin.py` — `IntelPlugin` implements `BaseAnalyzer` and registers `IntelAPI`.
- `project_intel/risk_model.py` — Combines coupling, dependency, churn, and semantic signals into `intel_risk_scores`.
- `project_intel/cross_coupling.py` — Correlates coupling across sources (git ↔ deps ↔ semantic).
- `project_intel/architecture_map.py` — Combines domains and dependency graphs into an architecture view.

## Capabilities (summary)

- get risk overview and per-file scores
- aggregate risk by folder
- compute cross-source correlations and architecture maps

## Phase 4 tasks (short)

- Implement risk model and scoring pipeline that reads analyzer outputs.
- Add platform routers for risk and intelligence endpoints.
- Implement frontend views: KnowledgeGraph, RiskMap, Architecture Map, and Combined Dashboard.

---

*See `1-UNIFIED_PLATFORM_OVERVIEW.md` for high-level context.*