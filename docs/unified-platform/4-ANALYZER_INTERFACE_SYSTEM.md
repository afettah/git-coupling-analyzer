# Analyzer Interface System (Contract & APIs)

> **Status**: ✅ Fully Implemented

---

## Implementation Status

### ✅ Implemented
- `BaseAnalyzer` ABC with `analyzer_type`, `display_name`, `get_config_schema()`, `analyze()`, `validate_config()` — `src/platform/code_intel/interfaces/analyzer.py`
- `AnalysisTask` dataclass (task_id, analyzer_type, repo_id, repo_path, db_path, parquet_dir, config) — same file
- `TaskResult` dataclass (status, entity_count, relationship_count, metrics, error) — same file
- `TaskStatus` enum (NOT_RUN, PENDING, RUNNING, COMPLETED, FAILED) — same file
- `GitAnalyzerAPI` with 11 abstract methods (coupling, graph, history, details, hotspots, dashboard, components, clustering, tree, authors, timeline) — `src/platform/code_intel/interfaces/git_analyzer.py`
- `DepAnalyzerAPI` with 5 abstract methods (import_graph, file_imports, circular_deps, external_packages, dependency_stats) — `src/platform/code_intel/interfaces/dep_analyzer.py`
- `SemanticAnalyzerAPI` with 6 abstract methods (domains, classify_file, similar_files, file_tokens, domain_detail, bridge_entities) — `src/platform/code_intel/interfaces/semantic_analyzer.py`
- Shared types: `Entity`, `Relationship`, `Domain`, `RelKind`, `EntityKind` — `src/platform/code_intel/interfaces/types.py`
- `AnalyzerRegistry` singleton with register/get/list — `src/platform/code_intel/registry.py`
- `GitPlugin` implementing `BaseAnalyzer` — `src/git-analyzer/git_analyzer/plugin.py`
- `GitAPI` implementing `GitAnalyzerAPI` — `src/git-analyzer/git_analyzer/api.py`

### 🔧 TODO
- [ ] Implement `DepPlugin` + `DepAPI` classes (interfaces exist, no implementation)
- [ ] Implement `SemanticPlugin` + `SemanticAPI` classes (interfaces exist, no implementation)
- [ ] Add `IntelligenceAnalyzerAPI` interface (not yet defined — needed for risk/cross-source queries)
- [ ] Implement `IntelPlugin` + `IntelAPI` classes

### 💡 Improvements
- Consider adding `async analyze()` variant for true async support
- `GitAPI._get_conn()` opens new connections per call — consider connection pooling or passing `Storage` object

---

## BaseAnalyzer contract (summary)

- `BaseAnalyzer` defines properties `analyzer_type` and `display_name`, `get_config_schema()` and the main method `analyze(task: AnalysisTask) -> TaskResult`.
- `AnalysisTask` contains task_id, analyzer_type, repo_id, repo_path, db_path, parquet_dir and config.
- `TaskResult` contains status, entity/relationship counts, metrics, and error info.

## Analyzer-specific APIs

- `GitAnalyzerAPI` — coupling, coupling graph, file history/details, hotspots, clustering runs, file tree, authors, timeline.
- `DepAnalyzerAPI` — import graph, file imports, circular deps, external packages, dependency stats.
- `SemanticAnalyzerAPI` — domains, file classification, similar files, tokens, domain details, bridge entities.

## Types

Common datatypes: `Entity`, `Relationship`, `Domain`, `RelKind`, `EntityKind` are defined to standardize how analyzers write to the DB and how the graph queries consume it.

## Registry

`AnalyzerRegistry` is a central singleton where analyzers register on import. The orchestrator uses the registry to discover analyzers and to proxy requests to the analyzer-specific APIs.

---

*This file is an interface-focused extract. For example implementations see `git-analyzer/plugin.py` and the `platform/code_intel/registry.py`.*