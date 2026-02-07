# Code Intelligence Platform — Overview

> **Version**: 2.0
> **Status**: Partially Implemented
> **Purpose**: High-level goals, architecture, and key decisions for the platform split.

---

## Implementation Status

### ✅ Implemented
- Monorepo split into `platform/`, `git-analyzer/`, `dep-analyzer/`, `semantic-analyzer/`, `project-intelligence/` (all under `src/`)
- Orchestrator app with FastAPI (`src/platform/code_intel/app.py`)
- Interface system: `BaseAnalyzer`, `AnalysisTask`, `TaskResult` (`src/platform/code_intel/interfaces/analyzer.py`)
- Analyzer-specific API contracts: `GitAnalyzerAPI`, `DepAnalyzerAPI`, `SemanticAnalyzerAPI` (`src/platform/code_intel/interfaces/`)
- Shared types: `Entity`, `Relationship`, `Domain`, `RelKind`, `EntityKind` (`src/platform/code_intel/interfaces/types.py`)
- Registry singleton for analyzer discovery (`src/platform/code_intel/registry.py`)
- Orchestrator task dispatch (`src/platform/code_intel/orchestrator.py`)
- Single REST API through orchestrator (repos, git, analyzers routers)
- Git analyzer fully ported: plugin, API, extract, edges, clustering (`src/git-analyzer/`)
- Frontend shell with feature-based routing and all navigation tabs (`src/frontend/`)

### 🔧 TODO
- [ ] Implement `dep-analyzer` plugin and analysis pipeline (only `__init__.py` exists)
- [ ] Implement `semantic-analyzer` plugin and analysis pipeline (only `__init__.py` exists)
- [ ] Implement `project-intelligence` plugin and risk model (only `__init__.py` exists)
- [ ] Add routers for deps, semantic, graph, risk, and intelligence endpoints
- [ ] Implement async task tracking with DB status rows (currently sync-only)
- [ ] Implement cross-source graph queries in orchestrator (`code_intel/graph/` is empty)

### ⚠️ Issues
- DB name mismatch: `config.py` uses `lfca.sqlite` but design doc says `code-intel.sqlite`
- `platform/pyproject.toml` does not list analyzer packages as dependencies (design says it should)
- Orchestrator runs tasks synchronously despite design calling for BackgroundTasks + DB polling

### 💡 Improvements
- Extract `code-intel-interfaces` as standalone package to cleanly resolve circular dependency
- Add health check that reports per-analyzer status (currently only lists names)

---

## Executive summary

The monolithic `lfca` package is split into independent Python projects (orchestrator `platform/`, and analyzers such as `git-analyzer`, `dep-analyzer`, `semantic-analyzer`, `project-intelligence`) that communicate via well-defined interfaces. The orchestrator manages repositories, dispatches analysis tasks, and provides a single REST API so the frontend never talks to analyzers directly.

## Goals

- Make analyzers independently testable and replaceable.
- Provide a single source of truth (SQLite per repo) that all analyzers write to.
- Expose consistent, discoverable APIs to the frontend via the orchestrator.
- Enable cross-source intelligence (risk scoring, knowledge graph) that combines signals from all analyzers.

## Key decisions

- Project separation: Python packages inside the monorepo for simple imports and shared virtualenv.
- Communication: Direct Python calls via interfaces (no HTTP between analyzers by default).
- Storage: One SQLite per repository + Parquet for bulk artifacts (commits/changesets).
- Async tasks: FastAPI BackgroundTasks and task rows in the DB for status and progress.
- Frontend ↔ Backend: Rest proxy through orchestrator for 1-1 mapping of routers to analyzers.

## High-level architecture

- Orchestrator `platform/` owns the REST API, schema, registry, and graph queries.
- Analyzers implement a `BaseAnalyzer` contract and an analyzer-specific API (e.g., `GitAnalyzerAPI`).
- `project-intelligence` ingests analyzer outputs and computes risk/cross-coupling insights.

## Data Flow

### Complete Analysis Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          COMPLETE DATA FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. USER creates repo via Frontend                                          │
│     Frontend → POST /repos → Orchestrator creates repo dir + empty DB       │
│                                                                             │
│  2. USER triggers analyzers (one or all)                                    │
│     Frontend → POST /repos/{id}/analyzers/git/run                           │
│     Orchestrator → creates task row → calls git_analyzer.analyze(task)      │
│     Git analyzer: mirror → extract → edges → writes to shared DB            │
│     Task status updated: running → completed                                │
│                                                                             │
│     Frontend → POST /repos/{id}/analyzers/deps/run                          │
│     Orchestrator → creates task → calls dep_analyzer.analyze(task)          │
│     Dep analyzer: parse imports → writes entities + relationships to DB     │
│                                                                             │
│     Frontend → POST /repos/{id}/analyzers/semantic/run                      │
│     Orchestrator → creates task → calls semantic_analyzer.analyze(task)     │
│     Sem analyzer: tokenize → TF-IDF → cluster → writes to DB               │
│                                                                             │
│     Frontend → POST /repos/{id}/analyzers/intelligence/run                  │
│     Orchestrator → creates task → calls project_intel.analyze(task)         │
│     Intelligence: reads all data → computes risk → writes scores            │
│                                                                             │
│  3. USER explores data via Frontend                                         │
│     Frontend → GET /repos/{id}/git/coupling?path=... → Orchestrator         │
│     Orchestrator → registry.get_git_api().get_coupling(db_path, ...) →      │
│     Git analyzer API impl → queries git_edges table → returns JSON          │
│                                                                             │
│     Frontend → GET /repos/{id}/graph/neighbors/42 → Orchestrator            │
│     Orchestrator → builds NetworkX graph from relationships table →         │
│     Returns subgraph as JSON                                                │
│                                                                             │
│     Frontend → GET /repos/{id}/risk/overview → Orchestrator                 │
│     Orchestrator → registry.get_api("intelligence").get_risk(...) →         │
│     Intelligence API → queries intel_risk_scores → returns JSON             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Flow Principles

- **Create once**: Repository directory and DB created on first POST /repos
- **Analyze independently**: Each analyzer can run in any order (deps/semantic work best after git)
- **Shared database**: All analyzers write to the same SQLite file
- **Task tracking**: Every long-running operation creates a task row for status polling
- **Query anywhere**: Frontend queries any analyzer through orchestrator proxy
- **Graph unification**: Orchestrator combines all relationships for cross-source queries

## Where to find details

- Project scaffolding & migration: `3-PROJECT_SCAFFOLDING.md`
- Analyzer interface system (full contract): `4-ANALYZER_INTERFACE_SYSTEM.md`
- Database schema & entity lifecycle: `5-DATABASE_SCHEMA.md`
- API design, endpoints & roadmap: `6-API_AND_ROADMAP.md`
- Frontend architecture and routes: `7-FRONTEND.md`
- Dependency Analyzer: `8-DEPENDENCY_ANALYZER.md`
- Semantic Analyzer: `9-SEMANTIC_ANALYZER.md`
- Project Intelligence & Risk: `10-INTELLIGENCE.md`

---

*This overview is a concise entry point — see the per-area docs for implementation details.*