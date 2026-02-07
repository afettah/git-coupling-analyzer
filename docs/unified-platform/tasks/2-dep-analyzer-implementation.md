# Dependency Analyzer Implementation

> **Priority**: High (Phase 2)
> **Depends on**: Platform interfaces (✅ done)
> **Design doc**: `docs/unified-platform/8-DEPENDENCY_ANALYZER.md`

## Summary
Implement the dependency analyzer that parses import relationships from source code.

## Tasks

### Backend
- [ ] Create `src/dep-analyzer/dep_analyzer/plugin.py` — `DepPlugin(BaseAnalyzer)` + `DepAPI(DepAnalyzerAPI)`
- [ ] Create `src/dep-analyzer/dep_analyzer/analyzer.py` — main analysis orchestration
- [ ] Create `src/dep-analyzer/dep_analyzer/parsers/python.py` — AST-based Python import parser
- [ ] Create `src/dep-analyzer/dep_analyzer/parsers/typescript.py` — TS import parser
- [ ] Add `dep_imports`, `dep_cycles` tables to `src/platform/code_intel/schema.py`
- [ ] Implement 5 `DepAPI` query methods
- [ ] Create `src/platform/code_intel/routers/deps.py`
- [ ] Register `DepPlugin` in `src/platform/code_intel/app.py`

### Frontend
- [ ] Wire `ImportGraph` component to real API
- [ ] Wire `ExternalPackages` component to real API
- [ ] Wire `CircularDeps` component to real API
- [ ] Add D3 import graph visualization

### Testing
- [ ] Add unit tests in `tests/test_dep_analyzer/`
- [ ] Test Python import parser with various import patterns
- [ ] Integration test: analyze repo → query deps API
