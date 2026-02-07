# Dependency Analyzer (dep-analyzer)

> **Status**: ❌ Not Implemented — only scaffolding exists

---

## Implementation Status

### ✅ Implemented
- Package scaffolding: `src/dep-analyzer/pyproject.toml`, `src/dep-analyzer/dep_analyzer/__init__.py`
- `DepAnalyzerAPI` interface defined with 5 methods — `src/platform/code_intel/interfaces/dep_analyzer.py`
- Frontend UI shells: `ImportGraph`, `ExternalPackages`, `CircularDeps`, `DepsLayout` — `src/frontend/src/features/deps/`
- Frontend API client with types — `src/frontend/src/api/deps.ts`
- Navigation tab configured — `src/frontend/src/config/navigation.ts`

### 🔧 TODO
- [ ] Create `dep_analyzer/plugin.py` — `DepPlugin` implementing `BaseAnalyzer`
- [ ] Create `dep_analyzer/analyzer.py` — orchestration for parsing + writing to DB
- [ ] Create `dep_analyzer/parsers/python.py` — AST-based Python import parser
- [ ] Create `dep_analyzer/parsers/typescript.py` — TS import parser (regex or AST)
- [ ] Add `dep_imports` and `dep_cycles` tables to `schema.py`
- [ ] Implement all 5 `DepAPI` methods (get_import_graph, get_file_imports, get_circular_deps, get_external_packages, get_dependency_stats)
- [ ] Create `src/platform/code_intel/routers/deps.py` router
- [ ] Register `DepPlugin` in `app.py`
- [ ] Wire frontend components to real API
- [ ] Add tests in `tests/test_dep_analyzer/`

### 💡 Improvements
- Start with Python parser (most value, AST is reliable) before TS/C#/Java
- Consider using tree-sitter for multi-language support

---

## Purpose

Extract import relationships, detect circular dependencies, and surface external packages and dependency statistics.

## Project layout highlights

- `dep_analyzer/plugin.py` — `DepPlugin` implements `BaseAnalyzer` and registers `DepAPI`.
- `dep_analyzer/analyzer.py` — Orchestration for parsing files and writing `dep_imports` and `dep_cycles`.
- `dep_analyzer/parsers/` — Language parsers (Python, TypeScript, C#, Java).

## Parsers

- Python: use `ast` to extract static imports, import-from statements, and symbols.
- TypeScript: a pragmatic regex-based parser or a TS AST when available.
- C#/Java: regex-based heuristics for `using`/`import` and project files.

## API capabilities (summary)

- get_import_graph(db_path, language=None, min_imports=1)
- get_file_imports(db_path, file_path)
- get_circular_deps(db_path)
- get_external_packages(db_path)
- get_dependency_stats(db_path)

## Phase 2 tasks (short)

- Define `DepAnalyzerAPI` and implement `DepPlugin`.
- Implement robust Python import parser (AST) and TypeScript parser.
- Add platform router `platform/code_intel/routers/deps.py` to proxy queries.
- Add frontend views: ImportGraph, ExternalPackages, CircularDeps.

---

*See `1-UNIFIED_PLATFORM_OVERVIEW.md` for context and `3-PROJECT_SCAFFOLDING.md` for migration steps.*