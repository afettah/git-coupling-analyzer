# Code Intelligence Platform — Project-Based Architecture

> **Version**: 2.0  
> **Status**: Design  
> **Created**: 2025  
> **Purpose**: Split LFCA into a multi-project platform with an orchestrator, independent analyzers, and a unified frontend

---

## 1. Executive Summary

The current monolithic `lfca` package is split into **independent projects** that communicate through **well-defined Python interfaces**. An **orchestrator** manages projects, dispatches analysis tasks, and aggregates results. Each **analyzer** (git, dependency, semantic, …) lives in its own project and implements a standard contract. A **project-intelligence** module combines signals from all analyzers to produce unified insights (risk, knowledge graph, cross-source queries).

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                        ┌──────────────────────┐                         │
│                        │    React Frontend     │                         │
│                        │  (single SPA, Vite)   │                         │
│                        └──────────┬───────────┘                         │
│                                   │ REST                                │
│                        ┌──────────▼───────────┐                         │
│                        │    Orchestrator API   │                         │
│                        │ (CodeIntelPlatform)   │                         │
│                        └──┬─────┬─────┬───┬───┘                         │
│                           │     │     │   │                             │
│              ┌────────────┘     │     │   └───────────────┐             │
│              ▼                  ▼     ▼                   ▼             │
│   ┌──────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌──────┐  │
│   │  Git Analyzer    │ │ Dep Analyzer   │ │ Semantic       │ │ ...  │  │
│   │  (git-analyzer)  │ │ (dep-analyzer) │ │ (sem-analyzer) │ │      │  │
│   └──────────────────┘ └────────────────┘ └────────────────┘ └──────┘  │
│              │                  │                 │                      │
│              └──────────────────┴─────────────────┘                     │
│                                 │                                       │
│                        ┌────────▼────────┐                              │
│                        │   Shared DB     │                              │
│                        │   (SQLite)      │                              │
│                        └─────────────────┘                              │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  Project Intelligence (cross-source analysis, risk, knowledge   │   │
│   │  graph)                                                         │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Project separation | Python packages in monorepo | Simple imports, shared virtualenv, single deploy for now |
| Inter-project communication | Direct Python calls via interfaces | No HTTP overhead between analyzers; swap to microservices later if needed |
| Database | Single SQLite per repository | Zero-ops, already proven at scale, all analyzers write to same file |
| Async tasks | Background threads + status in DB | Same pattern that works today, no message broker needed |
| Frontend ↔ Backend | REST 1-1 proxy through orchestrator | Frontend never calls analyzers directly |
| No backward compatibility | Clean break | Opportunity to design the right schema and API from scratch |

---

## 2. Project Structure

### 2.1 Monorepo Layout

```
code-intelligence-platform/
│
├── platform/                        # 🎯 ORCHESTRATOR — project management & API gateway
│   ├── pyproject.toml               #    Package: code-intel-platform
│   └── code_intel/
│       ├── __init__.py
│       ├── app.py                   # FastAPI app — THE single entry point
│       ├── config.py                # Global config, RepoPaths, data dirs
│       ├── models.py                # Pydantic request/response models (shared)
│       ├── storage.py               # DB connection factory, shared access
│       ├── schema.py                # Full database DDL (unified schema)
│       │
│       ├── routers/                 # FastAPI routers, one per domain
│       │   ├── __init__.py
│       │   ├── repos.py            # CRUD repos, list, delete
│       │   ├── analyzers.py        # List/run/status for all analyzers
│       │   ├── git.py              # Proxy to git-analyzer API
│       │   ├── deps.py             # Proxy to dep-analyzer API
│       │   ├── semantic.py         # Proxy to semantic-analyzer API
│       │   ├── graph.py            # Unified graph queries (knowledge graph)
│       │   ├── risk.py             # Combined risk scoring
│       │   └── intelligence.py     # Cross-source insights
│       │
│       ├── interfaces/             # 🔌 CONTRACTS — analyzers implement these
│       │   ├── __init__.py
│       │   ├── analyzer.py         # BaseAnalyzer ABC + types
│       │   ├── git_analyzer.py     # GitAnalyzerInterface (specific to git)
│       │   ├── dep_analyzer.py     # DepAnalyzerInterface (specific to deps)
│       │   ├── semantic_analyzer.py # SemanticAnalyzerInterface
│       │   └── types.py            # Shared domain types (Entity, Relationship, etc.)
│       │
│       ├── registry.py             # Analyzer discovery & DI container
│       ├── orchestrator.py         # Run analysis, combine results, status tracking
│       └── graph/                  # In-memory graph operations
│           ├── __init__.py
│           ├── builder.py          # SQLite → NetworkX
│           ├── queries.py          # Neighbors, paths, centrality
│           └── risk.py             # Unified risk model
│
├── git-analyzer/                    # 📦 GIT COUPLING ANALYZER
│   ├── pyproject.toml               #    Package: git-analyzer
│   └── git_analyzer/
│       ├── __init__.py
│       ├── plugin.py               # Implements GitAnalyzerInterface → registered
│       ├── extract.py              # Git log → parquet (from current lfca/extract.py)
│       ├── edges.py                # Pair counting, metrics (from current lfca/edges.py)
│       ├── changesets.py           # Changeset grouping (from current lfca/changesets.py)
│       ├── git.py                  # Git CLI wrapper (from current lfca/git.py)
│       ├── mirror.py              # Bare clone management (from current lfca/mirror.py)
│       ├── sync.py                # HEAD sync, file tree (from current lfca/sync.py)
│       ├── config.py              # Git-specific config (CouplingConfig)
│       │
│       ├── api.py                  # Git-specific query functions (coupling, history, etc.)
│       │                           # Called by orchestrator's git router
│       │
│       └── clustering/            # Clustering algorithms (from current lfca/clustering/)
│           ├── __init__.py
│           ├── base.py
│           ├── registry.py
│           ├── louvain.py
│           ├── dbscan.py
│           ├── hierarchical.py
│           ├── label_propagation.py
│           ├── components.py
│           └── insights.py
│
├── dep-analyzer/                    # 📦 DEPENDENCY ANALYZER
│   ├── pyproject.toml               #    Package: dep-analyzer
│   └── dep_analyzer/
│       ├── __init__.py
│       ├── plugin.py               # Implements DepAnalyzerInterface → registered
│       ├── analyzer.py             # Orchestrates language parsers
│       ├── api.py                  # Dep-specific query functions
│       ├── config.py               # Dep-specific config
│       │
│       └── parsers/                # Language-specific import parsers
│           ├── __init__.py
│           ├── base.py             # BaseParser ABC
│           ├── python_parser.py    # ast module → imports
│           ├── typescript_parser.py # Regex → import/require/export
│           ├── csharp_parser.py    # Regex → using/csproj
│           └── java_parser.py      # Regex → imports
│
├── semantic-analyzer/               # 📦 SEMANTIC ANALYZER
│   ├── pyproject.toml               #    Package: semantic-analyzer
│   └── semantic_analyzer/
│       ├── __init__.py
│       ├── plugin.py               # Implements SemanticAnalyzerInterface → registered
│       ├── analyzer.py             # Orchestrates extraction → embedding → clustering
│       ├── api.py                  # Semantic-specific query functions
│       ├── config.py               # Semantic-specific config
│       │
│       ├── extraction/             # Token extraction
│       │   ├── __init__.py
│       │   ├── tokenizer.py        # CamelCase/snake_case splitting
│       │   ├── stopwords.py        # Tech token lists per framework
│       │   └── extractor.py        # AST/tree-sitter token extraction
│       │
│       └── embedding/              # Vectorization & similarity
│           ├── __init__.py
│           ├── tfidf.py            # TF-IDF vectorizer
│           ├── similarity.py       # Cosine similarity computation
│           └── labeler.py          # Auto-generate domain labels
│
├── project-intelligence/            # 📦 CROSS-SOURCE INTELLIGENCE
│   ├── pyproject.toml               #    Package: project-intelligence
│   └── project_intel/
│       ├── __init__.py
│       ├── plugin.py               # Registered as a special "meta-analyzer"
│       ├── risk_model.py           # Combine signals → unified risk scores
│       ├── cross_coupling.py       # Coupling correlation: git ↔ deps ↔ semantic
│       ├── architecture_map.py     # Combine domains + deps → architecture view
│       └── api.py                  # Intelligence-specific queries
│
├── frontend/                        # 🖥️ REACT FRONTEND (single SPA)
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── api/                    # API client layer — mirrors orchestrator routers
│       │   ├── client.ts           # Axios instance + error handling
│       │   ├── repos.ts           # /repos endpoints
│       │   ├── analyzers.ts       # /analyzers endpoints
│       │   ├── git.ts             # /git endpoints (coupling, history, clustering)
│       │   ├── deps.ts            # /deps endpoints
│       │   ├── semantic.ts        # /semantic endpoints
│       │   ├── graph.ts           # /graph endpoints (knowledge graph)
│       │   ├── risk.ts            # /risk endpoints
│       │   └── intelligence.ts    # /intelligence endpoints
│       │
│       ├── types/                  # TypeScript types matching backend models
│       │   ├── repo.ts
│       │   ├── analyzer.ts
│       │   ├── git.ts
│       │   ├── deps.ts
│       │   ├── semantic.ts
│       │   ├── graph.ts
│       │   └── risk.ts
│       │
│       ├── features/               # Feature-based component organization
│       │   ├── repos/             # Repo list, create, settings
│       │   ├── dashboard/         # Enhanced dashboard (all sources)
│       │   ├── git/               # Coupling graph, file details, clustering, hotspots
│       │   ├── deps/              # Import graph, external deps, circular deps
│       │   ├── semantic/          # Domain map, domain detail, bridge files
│       │   ├── graph/             # Knowledge graph explorer, path finder
│       │   ├── risk/              # Risk overview, treemap, risk table
│       │   └── intelligence/      # Combined insights, architecture map
│       │
│       ├── shared/                 # Shared UI primitives
│       ├── hooks/
│       ├── stores/
│       ├── lib/
│       ├── config/
│       ├── design-tokens/
│       ├── App.tsx
│       └── main.tsx
│
├── tests/                           # Tests organized by project
│   ├── test_platform/
│   ├── test_git_analyzer/
│   ├── test_dep_analyzer/
│   ├── test_semantic_analyzer/
│   └── test_project_intelligence/
│
├── scripts/                         # Dev utilities
├── docs/
└── pyproject.toml                   # Root — workspace/dev dependencies
```

### 2.2 Package Dependencies

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     DEPENDENCY GRAPH                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   code-intel-platform (orchestrator)                                    │
│       │                                                                 │
│       ├── depends on → git-analyzer                                     │
│       ├── depends on → dep-analyzer                                     │
│       ├── depends on → semantic-analyzer                                │
│       ├── depends on → project-intelligence                             │
│       │                                                                 │
│       └── OWNS: interfaces/, schema.py, registry.py                    │
│              ↑                                                          │
│              │ implements                                                │
│              │                                                          │
│   git-analyzer ──┐                                                      │
│   dep-analyzer ──┤── each imports interfaces from code-intel-platform   │
│   sem-analyzer ──┤   (but only the interfaces/ package, not the app)    │
│   project-intel ─┘                                                      │
│                                                                         │
│   RULE: Analyzers NEVER import each other directly                      │
│   RULE: Analyzers NEVER import platform routers/orchestrator            │
│   RULE: Platform imports analyzer.plugin + analyzer.api only            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

```toml
# platform/pyproject.toml
[project]
name = "code-intel-platform"
dependencies = [
    "fastapi>=0.110.0",
    "uvicorn>=0.27.0",
    "pydantic>=2.6.0",
    "pyarrow>=14.0.0",
    "networkx>=3.0",
    # Analyzer packages (injected at install time)
    "git-analyzer",
    "dep-analyzer",
    "semantic-analyzer",
    "project-intelligence",
]

# git-analyzer/pyproject.toml
[project]
name = "git-analyzer"
dependencies = [
    "pyarrow>=14.0.0",
    "networkx>=3.0",
    "python-louvain>=0.16",
    "scipy>=1.10.0",
    "scikit-learn>=1.3.0",
    "code-intel-platform",     # for interfaces only
]

# dep-analyzer/pyproject.toml
[project]
name = "dep-analyzer"
dependencies = [
    "code-intel-platform",     # for interfaces only
]

# semantic-analyzer/pyproject.toml
[project]
name = "semantic-analyzer"
dependencies = [
    "scikit-learn>=1.3.0",
    "code-intel-platform",     # for interfaces only
]

# project-intelligence/pyproject.toml
[project]
name = "project-intelligence"
dependencies = [
    "networkx>=3.0",
    "code-intel-platform",     # for interfaces only
]
```

> **Circular dependency note**: Platform depends on analyzers, and analyzers depend on platform interfaces. This is resolved by having analyzers import *only* from `code_intel.interfaces` — a leaf package with no internal imports. In Python this works with `pip install -e .` in the monorepo. If needed later, extract `code-intel-interfaces` as a standalone package.

---

## 3. Analyzer Interface System

### 3.1 Base Analyzer Contract

Every analyzer implements this interface. The orchestrator uses only this contract — never the internal implementation.

```python
# platform/code_intel/interfaces/analyzer.py

from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any


class AnalyzerType(str, Enum):
    """Known analyzer types. Extensible via string values."""
    GIT_COUPLING = "git"
    DEPENDENCY = "deps"
    SEMANTIC = "semantic"
    INTELLIGENCE = "intelligence"


class TaskStatus(str, Enum):
    NOT_RUN = "not_run"
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class AnalysisTask:
    """A unit of work dispatched to an analyzer."""
    task_id: str
    analyzer_type: str
    repo_id: str
    repo_path: Path          # path to mirror.git or source repo
    db_path: Path            # path to the shared SQLite database
    parquet_dir: Path        # path to parquet data directory
    config: dict[str, Any]   # analyzer-specific configuration


@dataclass
class TaskResult:
    """Standard result from any analyzer task."""
    task_id: str
    status: TaskStatus
    entity_count: int = 0
    relationship_count: int = 0
    metrics: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


class BaseAnalyzer(ABC):
    """
    Contract that every analyzer must implement.

    The orchestrator:
    1. Calls list_capabilities() to discover what this analyzer offers
    2. Calls analyze() to run analysis (async-friendly, status tracked in DB)
    3. Calls the analyzer-specific query interface for data retrieval
    """

    @property
    @abstractmethod
    def analyzer_type(self) -> str:
        """Unique identifier: 'git', 'deps', 'semantic', etc."""
        ...

    @property
    @abstractmethod
    def display_name(self) -> str:
        """Human-readable name for UI."""
        ...

    @abstractmethod
    def get_config_schema(self) -> dict:
        """JSON Schema for this analyzer's configuration."""
        ...

    @abstractmethod
    def analyze(self, task: AnalysisTask) -> TaskResult:
        """
        Run analysis. This is the main entry point.

        SYNC tasks: Return TaskResult directly with data.
        ASYNC tasks: Update status in DB, return TaskResult with status=RUNNING,
                     complete work in background.

        The analyzer writes entities and relationships to the shared DB
        using the standard schema.
        """
        ...

    def validate_config(self, config: dict) -> list[str]:
        """Validate configuration. Return list of error messages (empty = valid)."""
        return []
```

### 3.2 Analyzer-Specific Interfaces

Each analyzer type has its own query interface. These are **separate from `BaseAnalyzer`** because query APIs differ fundamentally per analyzer.

```python
# platform/code_intel/interfaces/git_analyzer.py

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any


class GitAnalyzerAPI(ABC):
    """Query interface specific to git coupling analysis."""

    @abstractmethod
    def get_file_coupling(self, db_path: Path, file_path: str, *,
                          metric: str = "jaccard", min_weight: float = 0.0,
                          limit: int = 50) -> list[dict]:
        """Get files coupled with the given file."""
        ...

    @abstractmethod
    def get_coupling_graph(self, db_path: Path, root_path: str, *,
                           metric: str = "jaccard", min_weight: float = 0.1,
                           limit: int = 200) -> dict:
        """Get coupling graph (nodes + edges) for visualization."""
        ...

    @abstractmethod
    def get_file_history(self, db_path: Path, parquet_dir: Path,
                         file_path: str) -> dict:
        """Get commit history for a file."""
        ...

    @abstractmethod
    def get_file_details(self, db_path: Path, parquet_dir: Path,
                         file_path: str) -> dict:
        """Get comprehensive file details (commits, churn, authors)."""
        ...

    @abstractmethod
    def get_hotspots(self, db_path: Path, parquet_dir: Path, *,
                     limit: int = 50, sort_by: str = "risk_score") -> list[dict]:
        """Get files ranked by risk/churn/coupling."""
        ...

    @abstractmethod
    def get_dashboard_summary(self, db_path: Path, parquet_dir: Path) -> dict:
        """Summary stats for the dashboard."""
        ...

    @abstractmethod
    def get_component_coupling(self, db_path: Path, component: str, *,
                               depth: int = 2) -> list[dict]:
        """Get coupling between components/folders."""
        ...

    @abstractmethod
    def run_clustering(self, db_path: Path, *,
                       algorithm: str = "louvain", weight_column: str = "jaccard",
                       min_weight: float = 0.1, folders: list[str] | None = None,
                       params: dict | None = None) -> dict:
        """Run clustering algorithm on coupling graph."""
        ...

    @abstractmethod
    def get_file_tree(self, db_path: Path) -> dict:
        """Get file tree structure."""
        ...

    @abstractmethod
    def get_authors(self, db_path: Path, parquet_dir: Path, *,
                    limit: int = 50) -> list[dict]:
        """Get author statistics."""
        ...

    @abstractmethod
    def get_timeline(self, db_path: Path, parquet_dir: Path, *,
                     points: int = 12, granularity: str = "monthly") -> list[dict]:
        """Get temporal evolution data."""
        ...
```

```python
# platform/code_intel/interfaces/dep_analyzer.py

from abc import ABC, abstractmethod
from pathlib import Path


class DepAnalyzerAPI(ABC):
    """Query interface specific to dependency analysis."""

    @abstractmethod
    def get_import_graph(self, db_path: Path, *,
                         language: str | None = None,
                         min_imports: int = 1) -> dict:
        """Full import graph (nodes + edges) for visualization."""
        ...

    @abstractmethod
    def get_file_imports(self, db_path: Path, file_path: str) -> dict:
        """What this file imports and what imports this file."""
        ...

    @abstractmethod
    def get_circular_deps(self, db_path: Path) -> list[dict]:
        """Detect circular dependency chains."""
        ...

    @abstractmethod
    def get_external_packages(self, db_path: Path) -> list[dict]:
        """External packages used across codebase."""
        ...

    @abstractmethod
    def get_dependency_stats(self, db_path: Path) -> dict:
        """Summary: total imports, external count, circular count, etc."""
        ...
```

```python
# platform/code_intel/interfaces/semantic_analyzer.py

from abc import ABC, abstractmethod
from pathlib import Path


class SemanticAnalyzerAPI(ABC):
    """Query interface specific to semantic analysis."""

    @abstractmethod
    def get_domains(self, db_path: Path) -> list[dict]:
        """All discovered domains with stats."""
        ...

    @abstractmethod
    def classify_file(self, db_path: Path, file_path: str) -> dict:
        """Which domain(s) does this file belong to?"""
        ...

    @abstractmethod
    def get_similar_files(self, db_path: Path, file_path: str, *,
                          limit: int = 10, min_similarity: float = 0.5) -> list[dict]:
        """Find semantically similar files."""
        ...

    @abstractmethod
    def get_file_tokens(self, db_path: Path, file_path: str) -> dict:
        """Extracted semantic tokens for a file."""
        ...

    @abstractmethod
    def get_domain_detail(self, db_path: Path, domain_id: int) -> dict:
        """Detailed info about a domain: files, terms, cross-coupling."""
        ...

    @abstractmethod
    def get_bridge_entities(self, db_path: Path) -> list[dict]:
        """Entities that span multiple domains."""
        ...
```

### 3.3 Shared Types

```python
# platform/code_intel/interfaces/types.py

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Entity:
    """A code entity (file, class, function, package)."""
    entity_id: int | None = None
    file_id: int | None = None
    kind: str = "file"              # file, class, function, module, package
    name: str = ""
    qualified_name: str | None = None
    language: str | None = None
    line_start: int | None = None
    line_end: int | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Relationship:
    """A relationship between two entities."""
    rel_id: int | None = None
    source_type: str = ""           # git, deps, semantic, intelligence
    rel_kind: str = ""              # CO_CHANGED, IMPORTS, SIMILAR_TO, etc.
    src_entity_id: int = 0
    dst_entity_id: int = 0
    weight: float = 1.0
    properties: dict[str, Any] = field(default_factory=dict)
    run_id: str | None = None


@dataclass
class Domain:
    """A semantic domain (cluster of related entities)."""
    domain_id: int | None = None
    label: str = ""
    description: str | None = None
    entity_count: int = 0
    coherence_score: float = 0.0
    top_terms: list[str] = field(default_factory=list)


# Relationship kinds — constants
class RelKind:
    # Git analyzer
    CO_CHANGED = "CO_CHANGED"

    # Dependency analyzer
    IMPORTS = "IMPORTS"
    DEPENDS_ON = "DEPENDS_ON"       # external package dependency

    # Semantic analyzer
    SIMILAR_TO = "SIMILAR_TO"
    BELONGS_TO_DOMAIN = "BELONGS_TO_DOMAIN"

    # Future
    CALLS = "CALLS"
    EXTENDS = "EXTENDS"
    IMPLEMENTS = "IMPLEMENTS"
    TESTED_BY = "TESTED_BY"
    OWNS = "OWNS"


# Entity kinds — constants
class EntityKind:
    FILE = "file"
    CLASS = "class"
    FUNCTION = "function"
    MODULE = "module"
    PACKAGE = "package"
    EXTERNAL_PACKAGE = "external_package"
```

### 3.4 Analyzer Registry & Dependency Injection

```python
# platform/code_intel/registry.py

from __future__ import annotations
from typing import Any
from code_intel.interfaces.analyzer import BaseAnalyzer
from code_intel.interfaces.git_analyzer import GitAnalyzerAPI
from code_intel.interfaces.dep_analyzer import DepAnalyzerAPI
from code_intel.interfaces.semantic_analyzer import SemanticAnalyzerAPI


class AnalyzerRegistry:
    """
    Central registry. Analyzers register themselves at import time.
    The orchestrator uses this to discover and dispatch to analyzers.
    """

    def __init__(self):
        self._analyzers: dict[str, BaseAnalyzer] = {}
        self._apis: dict[str, Any] = {}     # analyzer_type → API impl

    def register(self, analyzer: BaseAnalyzer, api: Any = None):
        """Register an analyzer and its query API."""
        self._analyzers[analyzer.analyzer_type] = analyzer
        if api is not None:
            self._apis[analyzer.analyzer_type] = api

    def get_analyzer(self, analyzer_type: str) -> BaseAnalyzer:
        if analyzer_type not in self._analyzers:
            raise ValueError(f"Unknown analyzer: {analyzer_type}. "
                           f"Available: {list(self._analyzers.keys())}")
        return self._analyzers[analyzer_type]

    def get_api(self, analyzer_type: str) -> Any:
        """Get the query API for an analyzer type."""
        if analyzer_type not in self._apis:
            raise ValueError(f"No API registered for: {analyzer_type}")
        return self._apis[analyzer_type]

    def get_git_api(self) -> GitAnalyzerAPI:
        return self._apis["git"]

    def get_dep_api(self) -> DepAnalyzerAPI:
        return self._apis["deps"]

    def get_semantic_api(self) -> SemanticAnalyzerAPI:
        return self._apis["semantic"]

    def list_all(self) -> list[dict]:
        return [
            {
                "type": a.analyzer_type,
                "display_name": a.display_name,
                "config_schema": a.get_config_schema(),
            }
            for a in self._analyzers.values()
        ]


# Global singleton
registry = AnalyzerRegistry()
```

```python
# platform/code_intel/app.py — Startup wiring

from code_intel.registry import registry

def register_analyzers():
    """
    Import and register all analyzer plugins.
    Each analyzer's plugin.py calls registry.register() on import.
    """
    # Git analyzer
    from git_analyzer.plugin import GitPlugin, GitAPI
    registry.register(GitPlugin(), GitAPI())

    # Dep analyzer
    from dep_analyzer.plugin import DepPlugin, DepAPI
    registry.register(DepPlugin(), DepAPI())

    # Semantic analyzer
    from semantic_analyzer.plugin import SemanticPlugin, SemanticAPI
    registry.register(SemanticPlugin(), SemanticAPI())

    # Project intelligence
    from project_intel.plugin import IntelPlugin, IntelAPI
    registry.register(IntelPlugin(), IntelAPI())
```

### 3.5 Example: Git Analyzer Plugin

```python
# git-analyzer/git_analyzer/plugin.py

from code_intel.interfaces.analyzer import BaseAnalyzer, AnalysisTask, TaskResult, TaskStatus
from code_intel.interfaces.git_analyzer import GitAnalyzerAPI
from pathlib import Path


class GitPlugin(BaseAnalyzer):
    """Git coupling analyzer — wraps the existing extraction pipeline."""

    @property
    def analyzer_type(self) -> str:
        return "git"

    @property
    def display_name(self) -> str:
        return "Git Coupling Analysis"

    def get_config_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "min_revisions": {"type": "integer", "default": 5},
                "max_changeset_size": {"type": "integer", "default": 50},
                "changeset_mode": {
                    "type": "string",
                    "enum": ["by_commit", "by_author_time", "by_ticket_id"],
                },
                "min_cooccurrence": {"type": "integer", "default": 5},
                "window_days": {"type": "integer", "nullable": True},
                "since": {"type": "string", "nullable": True},
                "until": {"type": "string", "nullable": True},
            }
        }

    def analyze(self, task: AnalysisTask) -> TaskResult:
        """Run the full git analysis pipeline."""
        from git_analyzer.extract import HistoryExtractor
        from git_analyzer.edges import EdgeBuilder
        from git_analyzer.mirror import mirror_repo
        from git_analyzer.config import CouplingConfig

        # Delegates to existing pipeline, writes to shared DB
        # 1. mirror_repo(task.repo_path, task.config)
        # 2. HistoryExtractor(...).run() → parquet
        # 3. EdgeBuilder(...).build() → git_edges + relationships
        # 4. Return TaskResult
        pass


class GitAPI(GitAnalyzerAPI):
    """Query implementation for git data."""

    def get_file_coupling(self, db_path, file_path, *, metric="jaccard",
                          min_weight=0.0, limit=50):
        # Query git_edges table
        ...

    def get_coupling_graph(self, db_path, root_path, *, metric="jaccard",
                           min_weight=0.1, limit=200):
        ...

    # ... all other methods from GitAnalyzerAPI ...
```

---

## 4. Database Schema

### 4.1 Design Principles

- **Single SQLite file per repository** at `data/repos/{repo_id}/code-intel.sqlite`
- **All analyzers write to the same DB** — the schema is owned by the platform
- **Analyzer-specific tables are allowed** (prefixed: `git_`, `dep_`, `sem_`) for data that doesn't fit the unified model
- **Parquet for bulk data** (commit history, changes) — same directory `data/repos/{repo_id}/parquet/`

### 4.2 Complete Schema

```sql
-- ════════════════════════════════════════════════════════════════════════
-- CODE INTELLIGENCE PLATFORM — UNIFIED DATABASE SCHEMA
-- ════════════════════════════════════════════════════════════════════════

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

-- ─────────────────────────────────────────────────────────────────────
-- CORE: Repository & Project Management
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS repo_meta (
    key   TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS schema_info (
    key   TEXT PRIMARY KEY,
    value TEXT
);

-- ─────────────────────────────────────────────────────────────────────
-- CORE: Code Entities (files, classes, functions, packages)
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS entities (
    entity_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    kind            TEXT NOT NULL,           -- 'file','class','function','module','package','external_package'
    name            TEXT NOT NULL,           -- short name
    qualified_name  TEXT,                    -- full path or qualified name (unique for files)
    language        TEXT,                    -- 'python','typescript','csharp','java'
    parent_id       INTEGER REFERENCES entities(entity_id),  -- file for class, class for method
    line_start      INTEGER,
    line_end        INTEGER,
    exists_at_head  BOOLEAN DEFAULT TRUE,
    metadata_json   TEXT,                    -- extensible (LOC, complexity, etc.)
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_entities_qualified
    ON entities(qualified_name) WHERE qualified_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entities_kind ON entities(kind);
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
CREATE INDEX IF NOT EXISTS idx_entities_parent ON entities(parent_id);
CREATE INDEX IF NOT EXISTS idx_entities_language ON entities(language);

-- ─────────────────────────────────────────────────────────────────────
-- CORE: Relationships (unified edges — ALL source types)
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS relationships (
    rel_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type     TEXT NOT NULL,           -- 'git','deps','semantic','intelligence'
    rel_kind        TEXT NOT NULL,           -- 'CO_CHANGED','IMPORTS','SIMILAR_TO', etc.
    src_entity_id   INTEGER NOT NULL REFERENCES entities(entity_id),
    dst_entity_id   INTEGER NOT NULL REFERENCES entities(entity_id),
    weight          REAL DEFAULT 1.0,
    properties_json TEXT,                    -- source-specific extra data
    run_id          TEXT,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rel_source ON relationships(source_type);
CREATE INDEX IF NOT EXISTS idx_rel_kind ON relationships(rel_kind);
CREATE INDEX IF NOT EXISTS idx_rel_src ON relationships(src_entity_id);
CREATE INDEX IF NOT EXISTS idx_rel_dst ON relationships(dst_entity_id);
CREATE INDEX IF NOT EXISTS idx_rel_weight ON relationships(weight DESC);
CREATE INDEX IF NOT EXISTS idx_rel_kind_src ON relationships(rel_kind, src_entity_id);
CREATE INDEX IF NOT EXISTS idx_rel_src_source ON relationships(src_entity_id, source_type);

-- ─────────────────────────────────────────────────────────────────────
-- CORE: Analysis Task Tracking
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS analysis_tasks (
    task_id         TEXT PRIMARY KEY,
    analyzer_type   TEXT NOT NULL,
    state           TEXT NOT NULL DEFAULT 'pending',  -- pending/running/completed/failed
    config_json     TEXT,
    progress        REAL DEFAULT 0.0,        -- 0.0 to 1.0
    stage           TEXT,                    -- human-readable stage description
    entity_count    INTEGER DEFAULT 0,
    relationship_count INTEGER DEFAULT 0,
    metrics_json    TEXT,                     -- analyzer-specific result metrics
    started_at      TEXT,
    finished_at     TEXT,
    error           TEXT,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_type ON analysis_tasks(analyzer_type);
CREATE INDEX IF NOT EXISTS idx_tasks_state ON analysis_tasks(state);

-- ─────────────────────────────────────────────────────────────────────
-- GIT ANALYZER: Specific tables (prefixed git_)
-- ─────────────────────────────────────────────────────────────────────

-- File path history (renames/moves tracked by git analyzer)
CREATE TABLE IF NOT EXISTS git_file_lineage (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id       INTEGER NOT NULL REFERENCES entities(entity_id),
    path            TEXT NOT NULL,
    start_commit_oid TEXT NOT NULL,
    end_commit_oid  TEXT,
    UNIQUE(entity_id, path, start_commit_oid)
);
CREATE INDEX IF NOT EXISTS idx_git_lineage_entity ON git_file_lineage(entity_id);

-- Git coupling edges (fast path for coupling-specific queries)
-- Duplicates relationship data but optimized for the coupling UI
CREATE TABLE IF NOT EXISTS git_edges (
    src_entity_id   INTEGER NOT NULL REFERENCES entities(entity_id),
    dst_entity_id   INTEGER NOT NULL REFERENCES entities(entity_id),
    pair_count      REAL NOT NULL,
    src_count       INTEGER NOT NULL,
    dst_count       INTEGER NOT NULL,
    src_weight      REAL NOT NULL,
    dst_weight      REAL NOT NULL,
    jaccard         REAL NOT NULL,
    jaccard_weighted REAL NOT NULL,
    p_dst_given_src REAL NOT NULL,
    p_src_given_dst REAL NOT NULL,
    PRIMARY KEY (src_entity_id, dst_entity_id)
);
CREATE INDEX IF NOT EXISTS idx_git_edges_src ON git_edges(src_entity_id);
CREATE INDEX IF NOT EXISTS idx_git_edges_dst ON git_edges(dst_entity_id);
CREATE INDEX IF NOT EXISTS idx_git_edges_jaccard ON git_edges(jaccard DESC);

-- Component-level coupling
CREATE TABLE IF NOT EXISTS git_component_edges (
    src_component   TEXT NOT NULL,
    dst_component   TEXT NOT NULL,
    depth           INTEGER NOT NULL,
    pair_count      REAL NOT NULL,
    jaccard         REAL NOT NULL,
    file_pair_count INTEGER NOT NULL,
    PRIMARY KEY (src_component, dst_component, depth)
);

-- Clustering runs and results
CREATE TABLE IF NOT EXISTS git_cluster_runs (
    cluster_run_id  TEXT PRIMARY KEY,
    task_id         TEXT REFERENCES analysis_tasks(task_id),
    algorithm       TEXT NOT NULL,
    parameters_json TEXT,
    cluster_count   INTEGER,
    modularity      REAL,
    state           TEXT DEFAULT 'pending',
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS git_clusters (
    cluster_run_id  TEXT NOT NULL REFERENCES git_cluster_runs(cluster_run_id),
    cluster_id      INTEGER NOT NULL,
    entity_id       INTEGER NOT NULL REFERENCES entities(entity_id),
    PRIMARY KEY (cluster_run_id, cluster_id, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_git_clusters_run ON git_clusters(cluster_run_id);

-- Clustering snapshots (saved results)
CREATE TABLE IF NOT EXISTS git_cluster_snapshots (
    snapshot_id     TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    algorithm       TEXT NOT NULL,
    result_json     TEXT NOT NULL,
    tags_json       TEXT,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Validation log
CREATE TABLE IF NOT EXISTS git_validation_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id         TEXT NOT NULL,
    commit_oid      TEXT,
    issue_type      TEXT NOT NULL,
    severity        TEXT NOT NULL,
    token_value     TEXT,
    expected_value  TEXT,
    message         TEXT NOT NULL,
    author          TEXT,
    committed_at    INTEGER,
    subject         TEXT,
    cursor_position INTEGER,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_git_validation_task ON git_validation_log(task_id);

-- ─────────────────────────────────────────────────────────────────────
-- DEPENDENCY ANALYZER: Specific tables (prefixed dep_)
-- ─────────────────────────────────────────────────────────────────────

-- Import detail (richer than generic relationship)
CREATE TABLE IF NOT EXISTS dep_imports (
    import_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    src_entity_id   INTEGER NOT NULL REFERENCES entities(entity_id),
    dst_entity_id   INTEGER NOT NULL REFERENCES entities(entity_id),
    import_type     TEXT NOT NULL,       -- 'internal','external','stdlib'
    symbols_json    TEXT,                -- ["Class1", "func2"] or NULL for wildcard
    line_number     INTEGER,
    is_dynamic      BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_dep_imports_src ON dep_imports(src_entity_id);
CREATE INDEX IF NOT EXISTS idx_dep_imports_dst ON dep_imports(dst_entity_id);
CREATE INDEX IF NOT EXISTS idx_dep_imports_type ON dep_imports(import_type);

-- Detected circular dependency cycles
CREATE TABLE IF NOT EXISTS dep_cycles (
    cycle_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id         TEXT NOT NULL,
    chain_json      TEXT NOT NULL,       -- ["file_a.py", "file_b.py", "file_a.py"]
    length          INTEGER NOT NULL,
    severity        TEXT DEFAULT 'warning',
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────────
-- SEMANTIC ANALYZER: Specific tables (prefixed sem_)
-- ─────────────────────────────────────────────────────────────────────

-- Extracted tokens per entity
CREATE TABLE IF NOT EXISTS sem_tokens (
    token_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id       INTEGER NOT NULL REFERENCES entities(entity_id),
    token           TEXT NOT NULL,
    token_type      TEXT,                -- 'class_name','method_name','variable','comment'
    tf_idf          REAL,
    is_business     BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_sem_tokens_entity ON sem_tokens(entity_id);
CREATE INDEX IF NOT EXISTS idx_sem_tokens_token ON sem_tokens(token);

-- Discovered domains
CREATE TABLE IF NOT EXISTS sem_domains (
    domain_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id         TEXT NOT NULL,
    label           TEXT NOT NULL,
    description     TEXT,
    entity_count    INTEGER DEFAULT 0,
    coherence_score REAL,
    top_terms_json  TEXT,               -- ["payment","invoice","billing"]
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Domain membership
CREATE TABLE IF NOT EXISTS sem_domain_members (
    domain_id       INTEGER NOT NULL REFERENCES sem_domains(domain_id),
    entity_id       INTEGER NOT NULL REFERENCES entities(entity_id),
    affinity        REAL NOT NULL,       -- 0.0-1.0
    PRIMARY KEY (domain_id, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_sem_members_entity ON sem_domain_members(entity_id);

-- ─────────────────────────────────────────────────────────────────────
-- INTELLIGENCE: Risk scores (computed from all sources)
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS intel_risk_scores (
    entity_id       INTEGER NOT NULL REFERENCES entities(entity_id),
    task_id         TEXT NOT NULL,
    overall_risk    REAL NOT NULL,       -- 0.0-10.0
    coupling_risk   REAL DEFAULT 0.0,
    dependency_risk REAL DEFAULT 0.0,
    churn_risk      REAL DEFAULT 0.0,
    semantic_risk   REAL DEFAULT 0.0,
    signals_json    TEXT,               -- detailed signal list
    computed_at     TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (entity_id, task_id)
);
CREATE INDEX IF NOT EXISTS idx_risk_overall ON intel_risk_scores(overall_risk DESC);
```

### 4.3 Entity Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                   ENTITY LIFECYCLE                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Git Analyzer runs first:                                           │
│    → Creates entities for every file (kind='file')                  │
│    → qualified_name = file path                                     │
│    → Writes git_edges + relationships (CO_CHANGED)                  │
│                                                                     │
│  Dep Analyzer runs second:                                          │
│    → Reuses existing file entities (lookup by qualified_name)       │
│    → Creates new entities for external packages (kind='external')   │
│    → Creates entities for classes/functions if parsed               │
│    → Writes dep_imports + relationships (IMPORTS, DEPENDS_ON)       │
│                                                                     │
│  Semantic Analyzer runs third:                                      │
│    → Reuses existing entities                                       │
│    → Writes sem_tokens per entity                                   │
│    → Writes relationships (SIMILAR_TO)                              │
│    → Creates sem_domains + sem_domain_members                       │
│                                                                     │
│  Intelligence runs last:                                            │
│    → Reads all relationships                                        │
│    → Computes intel_risk_scores                                     │
│    → Writes cross-source relationships                              │
│                                                                     │
│  Key rule: get_or_create_entity(qualified_name, kind)               │
│    → If exists, return entity_id                                    │
│    → If not, INSERT and return entity_id                            │
│    → This prevents duplication across analyzers                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. API Design

### 5.1 Router Structure

The orchestrator exposes a single FastAPI app. Each router maps to a feature domain. Routers **proxy** to analyzer APIs — they do not contain business logic.

```
app.py
  ├── /repos                        → routers/repos.py         (orchestrator owns)
  ├── /repos/{id}/analyzers         → routers/analyzers.py     (orchestrator owns)
  ├── /repos/{id}/git/...           → routers/git.py           (proxies to GitAPI)
  ├── /repos/{id}/deps/...          → routers/deps.py          (proxies to DepAPI)
  ├── /repos/{id}/semantic/...      → routers/semantic.py      (proxies to SemanticAPI)
  ├── /repos/{id}/graph/...         → routers/graph.py         (orchestrator: NetworkX)
  ├── /repos/{id}/risk/...          → routers/risk.py          (proxies to IntelAPI)
  └── /repos/{id}/intelligence/...  → routers/intelligence.py  (proxies to IntelAPI)
```

### 5.2 Full Endpoint Catalog

```
──────────────────────────────────────────────────────────────────────────
REPOS (orchestrator owns)
──────────────────────────────────────────────────────────────────────────
GET    /repos                              List all repositories
POST   /repos                              Create repository
DELETE /repos/{repo_id}                    Delete repository
GET    /repos/{repo_id}                    Get repo details

──────────────────────────────────────────────────────────────────────────
ANALYZERS (orchestrator owns, dispatches to plugins)
──────────────────────────────────────────────────────────────────────────
GET    /repos/{repo_id}/analyzers                      List available analyzers + status
POST   /repos/{repo_id}/analyzers/{type}/run           Start an analyzer (async → task_id)
GET    /repos/{repo_id}/analyzers/{type}/status         Get latest task status
GET    /repos/{repo_id}/analyzers/tasks                All tasks history
GET    /repos/{repo_id}/analyzers/tasks/{task_id}      Specific task detail

──────────────────────────────────────────────────────────────────────────
GIT (proxy to git-analyzer API)
──────────────────────────────────────────────────────────────────────────
GET    /repos/{repo_id}/git/files/tree                 File tree
GET    /repos/{repo_id}/git/files                      List files (search, filter)
GET    /repos/{repo_id}/git/files/{path}/details       File details (churn, authors, etc.)
GET    /repos/{repo_id}/git/files/{path}/history       Commit history for file
GET    /repos/{repo_id}/git/files/{path}/lineage       Rename/move history
GET    /repos/{repo_id}/git/files/{path}/activity      Activity charts data
GET    /repos/{repo_id}/git/files/{path}/authors       Author breakdown for file
GET    /repos/{repo_id}/git/files/{path}/commits       Commit list for file
GET    /repos/{repo_id}/git/folders/{path}/details     Folder-level stats
GET    /repos/{repo_id}/git/folders                    List folders

GET    /repos/{repo_id}/git/coupling                   Coupled files for a path
GET    /repos/{repo_id}/git/coupling/graph             Coupling graph (nodes+edges)
GET    /repos/{repo_id}/git/coupling/evidence          Commits where pair co-changed
GET    /repos/{repo_id}/git/coupling/components        Component-level coupling
GET    /repos/{repo_id}/git/coupling/edges             Raw coupling edges (export)

GET    /repos/{repo_id}/git/hotspots                   Files ranked by risk
GET    /repos/{repo_id}/git/authors                    Author statistics
GET    /repos/{repo_id}/git/dashboard                  Summary stats
GET    /repos/{repo_id}/git/trends                     Trend data over time
GET    /repos/{repo_id}/git/timeline                   Timeline evolution

POST   /repos/{repo_id}/git/clustering/run             Run clustering algorithm
GET    /repos/{repo_id}/git/clustering/algorithms      List clustering algorithms
GET    /repos/{repo_id}/git/clustering/snapshots       List saved snapshots
POST   /repos/{repo_id}/git/clustering/snapshots       Save snapshot
GET    /repos/{repo_id}/git/clustering/snapshots/{id}  Get snapshot
PUT    /repos/{repo_id}/git/clustering/snapshots/{id}  Update snapshot
DELETE /repos/{repo_id}/git/clustering/snapshots/{id}  Delete snapshot
GET    /repos/{repo_id}/git/clustering/snapshots/{id}/edges  Snapshot edges
GET    /repos/{repo_id}/git/clustering/compare         Compare two snapshots

GET    /repos/{repo_id}/git/validation/stats           Validation statistics
GET    /repos/{repo_id}/git/validation/log             Validation log entries

──────────────────────────────────────────────────────────────────────────
DEPS (proxy to dep-analyzer API)
──────────────────────────────────────────────────────────────────────────
GET    /repos/{repo_id}/deps/graph                     Import graph (nodes+edges)
GET    /repos/{repo_id}/deps/files/{path}/imports      What file imports / imported by
GET    /repos/{repo_id}/deps/circular                  Circular dependency chains
GET    /repos/{repo_id}/deps/external                  External packages used
GET    /repos/{repo_id}/deps/stats                     Summary statistics

──────────────────────────────────────────────────────────────────────────
SEMANTIC (proxy to semantic-analyzer API)
──────────────────────────────────────────────────────────────────────────
GET    /repos/{repo_id}/semantic/domains               All discovered domains
GET    /repos/{repo_id}/semantic/domains/{id}          Domain detail
GET    /repos/{repo_id}/semantic/files/{path}/classify  Domain classification for file
GET    /repos/{repo_id}/semantic/files/{path}/similar   Semantically similar files
GET    /repos/{repo_id}/semantic/files/{path}/tokens    Extracted tokens for file
GET    /repos/{repo_id}/semantic/bridges               Bridge entities (multi-domain)

──────────────────────────────────────────────────────────────────────────
GRAPH (orchestrator owns — queries unified relationships table)
──────────────────────────────────────────────────────────────────────────
GET    /repos/{repo_id}/graph/entities                 Search/filter entities
GET    /repos/{repo_id}/graph/entities/{id}            Entity detail with all signals
GET    /repos/{repo_id}/graph/relationships            Query relationships
GET    /repos/{repo_id}/graph/neighbors/{entity_id}    Neighborhood subgraph
GET    /repos/{repo_id}/graph/path                     Shortest path between entities
GET    /repos/{repo_id}/graph/stats                    Graph-level stats (centrality etc.)

──────────────────────────────────────────────────────────────────────────
RISK & INTELLIGENCE (proxy to project-intelligence API)
──────────────────────────────────────────────────────────────────────────
GET    /repos/{repo_id}/risk/overview                  Overall risk scorecard
GET    /repos/{repo_id}/risk/files                     Per-file risk scores
GET    /repos/{repo_id}/risk/folders                   Per-folder risk aggregation

GET    /repos/{repo_id}/intelligence/dashboard         Combined dashboard from all sources
GET    /repos/{repo_id}/intelligence/architecture      Architecture map (domains + deps)
GET    /repos/{repo_id}/intelligence/correlations      Coupling correlation across sources
```

### 5.3 Sync vs Async Pattern

```
┌─────────────────────────────────────────────────────────────────────┐
│                     SYNC vs ASYNC                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ASYNC (long-running → status in DB):                               │
│  ─────────────────────────────────────                              │
│  POST /repos/{id}/analyzers/{type}/run                              │
│    → Returns { task_id, status: "pending" }                         │
│    → Analyzer runs in BackgroundTask                                │
│    → Updates analysis_tasks row: progress, stage, state             │
│    → Frontend polls GET /repos/{id}/analyzers/{type}/status         │
│                                                                     │
│  POST /repos/{id}/git/clustering/run                                │
│    → Returns { task_id, status: "pending" }                         │
│    → Clustering runs in background (can be slow for large graphs)   │
│    → Frontend polls until completed, then fetches result            │
│                                                                     │
│  SYNC (fast queries → immediate response):                          │
│  ──────────────────────────────────────────                         │
│  All GET endpoints                                                  │
│    → Direct DB queries                                              │
│    → Return data immediately                                        │
│    → Some may use in-memory caching (graph builder)                 │
│                                                                     │
│  Pattern for async:                                                 │
│    1. POST → create task row (pending) → start background job       │
│    2. Background job: update state=running, progress=0.3, ...       │
│    3. On complete: state=completed, store results                   │
│    4. On error: state=failed, store error message                   │
│    5. GET status → read task row → return current state             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.4 Router Implementation Pattern

```python
# platform/code_intel/routers/git.py

from fastapi import APIRouter, Depends, Query
from code_intel.registry import registry
from code_intel.config import get_repo_paths

router = APIRouter(prefix="/repos/{repo_id}/git", tags=["git"])


@router.get("/coupling")
def get_coupling(
    repo_id: str,
    path: str = Query(...),
    metric: str = Query("jaccard"),
    min_weight: float = Query(0.0),
    limit: int = Query(50),
):
    """Proxy to git-analyzer's coupling query."""
    paths = get_repo_paths(repo_id)
    api = registry.get_git_api()
    return api.get_file_coupling(
        paths.db_path, path,
        metric=metric, min_weight=min_weight, limit=limit,
    )


@router.get("/coupling/graph")
def get_coupling_graph(
    repo_id: str,
    path: str = Query(...),
    metric: str = Query("jaccard"),
    min_weight: float = Query(0.1),
    limit: int = Query(200),
):
    paths = get_repo_paths(repo_id)
    api = registry.get_git_api()
    return api.get_coupling_graph(
        paths.db_path, path,
        metric=metric, min_weight=min_weight, limit=limit,
    )


# ... same pattern for all git endpoints ...
```

---

## 6. Frontend Architecture

### 6.1 Design Principles

1. **Feature-based organization** — each analyzer gets its own feature folder
2. **API 1-1 proxy** — `frontend/src/api/git.ts` maps exactly to `/repos/{id}/git/*` endpoints
3. **Shared components** — UI primitives reused across all features
4. **Cross-linking** — any file name or entity is clickable, navigates to detail view

### 6.2 Information Architecture & Routes

```
/                                          → Redirect to /repos
/repos                                     → RepoList
/repos/:id                                → Redirect to /repos/:id/dashboard
/repos/:id/dashboard                       → IntelligenceDashboard (combined)
/repos/:id/git                             → Redirect to /repos/:id/git/coupling
/repos/:id/git/coupling                    → CouplingGraph
/repos/:id/git/files                       → FileTree
/repos/:id/git/files/:path                 → FileDetail
/repos/:id/git/folders/:path               → FolderDetail
/repos/:id/git/hotspots                    → HotspotsView
/repos/:id/git/clustering                  → ClusteringWorkspace
/repos/:id/git/timeline                    → TimeMachine
/repos/:id/git/authors                     → AuthorStats
/repos/:id/deps                            → Redirect to /repos/:id/deps/graph
/repos/:id/deps/graph                      → ImportGraph
/repos/:id/deps/external                   → ExternalPackages
/repos/:id/deps/circular                   → CircularDeps
/repos/:id/deps/files/:path                → FileImportDetail
/repos/:id/semantic                        → Redirect to /repos/:id/semantic/domains
/repos/:id/semantic/domains                → DomainMap
/repos/:id/semantic/domains/:id            → DomainDetail
/repos/:id/semantic/files/:path            → FileSemanticDetail
/repos/:id/semantic/bridges                → BridgeEntities
/repos/:id/graph                           → KnowledgeGraphExplorer
/repos/:id/graph/entities/:id              → EntityDetail (all signals)
/repos/:id/risk                            → RiskOverview
/repos/:id/risk/files                      → RiskFileTable
/repos/:id/risk/folders                    → RiskTreemap
/repos/:id/settings                        → AnalyzerSettings (configs + run)
```

### 6.3 Frontend Component Tree

```
frontend/src/
│
├── api/                              # 1-1 mapping to backend routers
│   ├── client.ts                     # Axios instance, interceptors, error types
│   ├── repos.ts                      # getRepos, createRepo, deleteRepo
│   ├── analyzers.ts                  # listAnalyzers, runAnalyzer, getStatus
│   ├── git.ts                        # getCoupling, getCouplingGraph, getHotspots, ...
│   ├── deps.ts                       # getImportGraph, getCircularDeps, ...
│   ├── semantic.ts                   # getDomains, classifyFile, getSimilar, ...
│   ├── graph.ts                      # getEntities, getNeighbors, getPath, ...
│   ├── risk.ts                       # getRiskOverview, getRiskFiles, ...
│   └── intelligence.ts               # getDashboard, getArchitecture, ...
│
├── types/                            # TypeScript types (mirrors backend models)
│   ├── repo.ts                       # RepoInfo
│   ├── analyzer.ts                   # AnalyzerInfo, TaskStatus, TaskResult
│   ├── entity.ts                     # Entity, Relationship, RelKind
│   ├── git.ts                        # CoupledFile, ClusterResult, HotspotFile, etc.
│   ├── deps.ts                       # ImportInfo, CircularDep, ExternalPackage
│   ├── semantic.ts                   # Domain, DomainMember, SemanticToken
│   ├── graph.ts                      # GraphNode, GraphEdge, PathResult
│   └── risk.ts                       # RiskScore, RiskSignal
│
├── features/                         # Feature modules (1 per concern)
│   │
│   ├── repos/                        # Repository management
│   │   ├── RepoList.tsx
│   │   ├── RepoCard.tsx
│   │   ├── CreateRepoModal.tsx
│   │   └── index.ts
│   │
│   ├── dashboard/                    # Combined intelligence dashboard
│   │   ├── Dashboard.tsx             # Main layout with widget grid
│   │   ├── StatCards.tsx             # Top-level metrics (files, commits, risk, ...)
│   │   ├── AnalyzerStatusPanel.tsx   # Run status for each analyzer
│   │   ├── RiskSignalsWidget.tsx     # Top risk files mini-list
│   │   ├── DomainOverviewWidget.tsx  # Domain summary mini-chart
│   │   ├── TrendChart.tsx            # Multi-line area chart
│   │   └── index.ts
│   │
│   ├── git/                          # Git coupling features
│   │   ├── CouplingGraph.tsx         # D3 force-directed coupling graph
│   │   ├── FileTree.tsx              # Folder tree explorer
│   │   ├── FileDetail.tsx            # Comprehensive file detail panel
│   │   ├── FolderDetail.tsx          # Folder-level stats
│   │   ├── HotspotsView.tsx         # Hotspot table/chart
│   │   ├── AuthorStats.tsx           # Author analysis
│   │   ├── TimeMachine.tsx           # Temporal evolution
│   │   ├── CouplingEvidence.tsx      # Commits where pair co-changed
│   │   │
│   │   ├── clustering/              # Full clustering workspace
│   │   │   ├── ClusteringWorkspace.tsx
│   │   │   ├── ClusteringHub.tsx
│   │   │   ├── SnapshotDetail.tsx
│   │   │   └── ...
│   │   │
│   │   └── index.ts
│   │
│   ├── deps/                         # Dependency analysis features
│   │   ├── DepsLayout.tsx            # Tab container (Graph, External, Circular)
│   │   ├── ImportGraph.tsx           # D3 force graph — imports as edges
│   │   ├── ExternalPackages.tsx      # Treemap of external deps
│   │   ├── CircularDeps.tsx          # Cycle list with path highlighting
│   │   ├── FileImportDetail.tsx      # Side panel: what imports what
│   │   └── index.ts
│   │
│   ├── semantic/                     # Semantic domain features
│   │   ├── SemanticLayout.tsx        # Tab container (Map, List, Bridges)
│   │   ├── DomainMap.tsx             # D3 bubble/pack chart
│   │   ├── DomainDetail.tsx          # Files, terms, cross-coupling
│   │   ├── DomainList.tsx            # Table view of all domains
│   │   ├── BridgeEntities.tsx        # Multi-domain entities
│   │   ├── FileSemanticDetail.tsx    # Classification + tokens for a file
│   │   ├── DomainBadge.tsx           # Reusable domain tag
│   │   └── index.ts
│   │
│   ├── graph/                        # Unified knowledge graph
│   │   ├── KnowledgeGraph.tsx        # Main layout: graph + sidebar
│   │   ├── GraphCanvas.tsx           # D3 multi-edge renderer
│   │   ├── EntityDetail.tsx          # All signals for one entity
│   │   ├── PathFinder.tsx            # From → To shortest path
│   │   ├── GraphFilters.tsx          # Source type, weight, kind toggles
│   │   └── index.ts
│   │
│   ├── risk/                         # Risk analysis features
│   │   ├── RiskLayout.tsx            # Tab container
│   │   ├── RiskOverview.tsx          # Scorecard + gauge
│   │   ├── RiskTreemap.tsx           # D3 treemap by folder
│   │   ├── RiskFileTable.tsx         # Sortable table of risky files
│   │   ├── RiskSignalBadge.tsx       # Signal pill component
│   │   └── index.ts
│   │
│   └── settings/                     # Per-repo analyzer configuration
│       ├── SettingsLayout.tsx
│       ├── GitSettings.tsx           # Git analysis config form
│       ├── DepsSettings.tsx          # Dependency analysis config form
│       ├── SemanticSettings.tsx      # Semantic analysis config form
│       ├── AnalyzerRunPanel.tsx      # Run/status controls
│       └── index.ts
│
├── shared/                           # Reusable UI primitives
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Modal.tsx
│   ├── Badge.tsx
│   ├── Tabs.tsx
│   ├── Table.tsx
│   ├── Tooltip.tsx
│   ├── Spinner.tsx
│   ├── ErrorBoundary.tsx
│   ├── EmptyState.tsx
│   └── index.ts
│
├── hooks/
│   ├── useAnalyzerStatus.ts          # Poll analyzer status
│   ├── useGraphData.ts               # Fetch + cache graph subsets
│   ├── useDebounce.ts
│   ├── useLocalStorage.ts
│   └── useClickOutside.ts
│
├── stores/
│   ├── repoStore.ts                  # Current repo context
│   ├── filterStore.ts                # Global filters (existing)
│   └── graphFilterStore.ts           # Graph source/weight filters
│
├── lib/
│   └── utils.ts                      # cn(), formatters, etc.
│
├── config/
│   └── navigation.ts                 # Tab/route definitions
│
├── design-tokens/
│   └── ...                           # Theme values
│
├── App.tsx                           # Route definitions
└── main.tsx                          # Entry point
```

### 6.4 Navigation & UX Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       NAVIGATION STRUCTURE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  TOP BAR (always visible in repo context):                              │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ ← MyProject │ Dashboard │ Git ▾ │ Deps │ Semantic │ Graph │    │   │
│  │             │           │       │      │          │       │    │   │
│  │             │           │ Sub:  │      │          │       │    │   │
│  │             │           │ Coupling     │          │       │    │   │
│  │             │           │ Files        │          │ Risk  │    │   │
│  │             │           │ Hotspots     │          │       │    │   │
│  │             │           │ Clustering   │          │ ⚙️    │    │   │
│  │             │           │ Timeline     │          │       │    │   │
│  │             │           │ Authors      │          │       │    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  FLOW:                                                                  │
│                                                                         │
│  1. Landing: /repos → pick a repo                                       │
│                                                                         │
│  2. Dashboard: /repos/:id/dashboard                                     │
│     Shows combined view from all analyzers.                             │
│     Cards link to feature-specific views.                               │
│     If analyzer not run → shows "Run Analysis" prompt.                  │
│                                                                         │
│  3. Feature deep-dive: click into any feature tab                       │
│     Each feature is self-contained with its own sub-navigation.         │
│                                                                         │
│  4. Cross-linking:                                                      │
│     - File path (anywhere) → click → /repos/:id/git/files/:path        │
│     - Domain badge → click → /repos/:id/semantic/domains/:id           │
│     - Risk badge → click → /repos/:id/risk (filtered)                  │
│     - "View in graph" → /repos/:id/graph?entity=:id                    │
│     - Entity in graph → sidebar with all signals                        │
│                                                                         │
│  5. Settings: /repos/:id/settings                                       │
│     Configure and run each analyzer independently.                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.5 Screen Wireframes

#### Dashboard (Combined Intelligence)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back   MyProject   Dashboard  Git ▾  Deps  Semantic  Graph  Risk ⚙️ │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │  1,240   │ │  8,500   │ │  45      │ │  4       │ │  6.2     │     │
│  │  Files   │ │  Commits │ │  Authors │ │  Domains │ │  Risk/10 │     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│                                                                         │
│  ┌─ Analyzers ─────────────────────────────────────────────────────┐   │
│  │  ✅ Git Coupling     2h ago   1,240 files   8,500 edges         │   │
│  │  ✅ Dependencies     2h ago   3,200 imports  45 externals       │   │
│  │  ✅ Semantic          1h ago   4 domains     0.78 coherence     │   │
│  │  ✅ Intelligence      1h ago   risk computed                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─ Top Risks ─────────────────┐ ┌─ Domains ──────────────────────┐   │
│  │  🔴 src/core/engine.py  9.2 │ │  ● Payment    24 files         │   │
│  │  🟠 src/api/routes.py   7.8 │ │  ● Auth       18 files         │   │
│  │  🟠 src/models/user.py  7.1 │ │  ● Orders     31 files         │   │
│  │  [View all →]                │ │  [View all →]                  │   │
│  └──────────────────────────────┘ └────────────────────────────────┘   │
│                                                                         │
│  ┌─ Trends ────────────────────────────────────────────────────────┐   │
│  │  [area chart: commits, coupling, risk over time]                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Knowledge Graph

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Knowledge Graph                                                        │
│                                                                         │
│  ┌─ Filters ──────────────────────────────────────────────────────────┐│
│  │ [✓ Git] [✓ Deps] [✓ Semantic]   Kind: [All ▾]   Min: [0.3 ━●━]  ││
│  │ 🔍 [Search entity...                                         ]    ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌─────────────────────────────────────┬───────────────────────────────┐│
│  │                                     │ 📄 payment.py                 ││
│  │    D3 graph                         │                               ││
│  │    ── blue edges = git coupling     │ Language: python               ││
│  │    ── green edges = imports         │ Domain: Payment (0.95)         ││
│  │    ── purple edges = similar        │ Risk: 🟡 5.2                  ││
│  │                                     │                               ││
│  │    Nodes colored by domain          │ Relationships:                 ││
│  │    Nodes sized by degree            │  🔗 Co-changes: 8 files       ││
│  │                                     │  📦 Imports: 5                ││
│  │                                     │  📦 Imported by: 3            ││
│  │                                     │  🏷️ Similar: 4                ││
│  │                                     │                               ││
│  │                                     │ Risk signals:                  ││
│  │                                     │  🟡 High fan-out              ││
│  │                                     │  ✅ No circular deps           ││
│  └─────────────────────────────────────┴───────────────────────────────┘│
│                                                                         │
│  Path: [payment.py] → [user.py]  Via: [Any ▾]  [Find →]               │
│  Result: payment.py → order.py → auth.py → user.py (3 hops)           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Dependencies Explorer

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Dependencies    [Import Graph]  [External]  [Circular]                │
│                                                                         │
│  Filters: Language [All ▾]  Direction [Both ▾]  Min imports [1]        │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                 │   │
│  │    D3 force graph                                               │   │
│  │    Nodes = files (colored by folder)                            │   │
│  │    Edges = import relationships (directed arrows)               │   │
│  │    Red highlighted = files in circular dependencies             │   │
│  │                                                                 │   │
│  │    Click node → detail panel below                              │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─ src/services/payment.py ───────────────────────────────────────┐   │
│  │  Imports (5):                     Imported by (3):               │   │
│  │  ├─ src/models/order.py           ├─ src/api/routes.py          │   │
│  │  ├─ src/models/invoice.py         ├─ src/workers/billing.py     │   │
│  │  ├─ src/utils/validators.py       └─ tests/test_payment.py      │   │
│  │  ├─ stripe (external)                                           │   │
│  │  └─ logging (stdlib)                                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Semantic Domain Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Semantic Domains    [Map]  [List]  [Bridges]                          │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                 │   │
│  │    D3 bubble chart                                              │   │
│  │    Each bubble = domain (sized by file count)                   │   │
│  │    Lines between bubbles = cross-domain coupling                │   │
│  │    Colors = domain identity                                     │   │
│  │                                                                 │   │
│  │    ┌──────────┐                                                 │   │
│  │    │ Payment  │──────┐                                          │   │
│  │    │  24 files│      │ cross-coupling                           │   │
│  │    └──────────┘      ▼                                          │   │
│  │              ┌──────────────┐    ┌────────┐                     │   │
│  │              │   Orders     │────│  Auth  │                     │   │
│  │              │   31 files   │    │18 files│                     │   │
│  │              └──────────────┘    └────────┘                     │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Click a domain to see detail: files, top terms, coherence, bridges    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Risk Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Risk Map    [Overview]  [Files]  [Folders]                            │
│                                                                         │
│  Risk Score: 6.2 / 10  ━━━━━━━━━━━━●━━━━━━━━━                         │
│                                                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                      │
│  │ 🔗 5.8  │ │ 📦 7.1  │ │ 🔥 4.5  │ │ 🏷️ 6.0  │                      │
│  │Coupling │ │Dep Risk │ │  Churn  │ │Semantic │                       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘                      │
│                                                                         │
│  ┌─ Treemap (folders by risk) ─────────────────────────────────────┐   │
│  │  ┌──────────────────┬────────────────┬──────────────────────┐   │   │
│  │  │  src/core (🔴)   │ src/api (🟠)   │  src/models (🟢)     │   │   │
│  │  │  risk: 8.1       │ risk: 6.5      │  risk: 3.2           │   │   │
│  │  ├──────────────────┼────────────────┤                      │   │   │
│  │  │ src/services(🟠) │ src/utils (🟡) │                      │   │   │
│  │  └──────────────────┴────────────────┴──────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  File                    Risk   Signals                                 │
│  src/core/engine.py      9.2    🔗 High coupling | 📦 Circular dep     │
│  src/api/routes.py       7.8    🔥 High churn | 🏷️ 3 domains           │
│  src/models/user.py      7.1    📦 High fan-out | 🔗 God class         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Data Flow

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

---

## 8. What Moves Where (Migration Map)

Current `lfca/` module → new project locations:

| Current File | New Location | Notes |
|---|---|---|
| `lfca/api.py` | Split → `platform/code_intel/routers/*.py` | Each endpoint group becomes a router |
| `lfca/storage.py` | Split → `platform/code_intel/storage.py` (shared) + `git_analyzer/api.py` (git queries) | Storage factory stays in platform; query logic moves to analyzer |
| `lfca/schema.py` | → `platform/code_intel/schema.py` | Unified schema owned by platform |
| `lfca/config.py` | Split → `platform/code_intel/config.py` (RepoPaths) + `git_analyzer/config.py` (CouplingConfig) | |
| `lfca/extract.py` | → `git_analyzer/extract.py` | |
| `lfca/edges.py` | → `git_analyzer/edges.py` | |
| `lfca/changesets.py` | → `git_analyzer/changesets.py` | |
| `lfca/git.py` | → `git_analyzer/git.py` | |
| `lfca/mirror.py` | → `git_analyzer/mirror.py` | |
| `lfca/sync.py` | → `git_analyzer/sync.py` | |
| `lfca/runner.py` | → `platform/code_intel/orchestrator.py` (task dispatch) + `git_analyzer/plugin.py` (git pipeline) | |
| `lfca/clustering/` | → `git_analyzer/clustering/` | Clustering is git-specific for now |
| `lfca/logging_utils.py` | → `platform/code_intel/logging_utils.py` | Shared utility |
| `frontend/src/api.ts` | Split → `frontend/src/api/*.ts` | One file per router |
| `frontend/src/components/` | → `frontend/src/features/` | Reorganized by feature |

---

## 9. Implementation Roadmap

### Phase 1: Project Scaffolding & Split (2-3 weeks)

| Task | Effort | Notes |
|------|--------|-------|
| Create monorepo structure (platform/, git-analyzer/, frontend/) | 1d | pyproject.toml for each |
| Define interfaces (analyzer.py, git_analyzer.py, types.py) | 2d | The critical design step |
| Implement platform schema.py (unified DB) | 1d | |
| Implement registry + orchestrator | 1d | |
| Move git code to git-analyzer/ | 2d | Mechanical move + adapt imports |
| Implement GitPlugin + GitAPI | 3d | Wrap existing logic behind interfaces |
| Implement platform routers (proxy layer) | 2d | 1-1 mapping from old api.py |
| Verify all existing features work | 2d | End-to-end testing |

### Phase 2: Dependency Analyzer (2-3 weeks)

| Task | Effort | Notes |
|------|--------|-------|
| Define DepAnalyzerAPI interface | 1d | |
| Python import parser (ast module) | 2d | |
| TypeScript import parser (regex) | 2d | |
| DepPlugin + DepAPI implementation | 2d | |
| Platform router: deps.py | 1d | |
| Frontend: DepsLayout + ImportGraph + CircularDeps | 4d | |
| Tests | 2d | |

### Phase 3: Semantic Analyzer (3-4 weeks)

| Task | Effort | Notes |
|------|--------|-------|
| Define SemanticAnalyzerAPI interface | 1d | |
| Token extraction (tree-sitter / AST) | 3d | |
| TF-IDF + cosine similarity | 2d | |
| Domain clustering + labeling | 2d | |
| SemanticPlugin + SemanticAPI | 2d | |
| Platform router: semantic.py | 1d | |
| Frontend: SemanticLayout + DomainMap + DomainDetail | 4d | |
| Tests | 2d | |

### Phase 4: Intelligence & Unified Views (2-3 weeks)

| Task | Effort | Notes |
|------|--------|-------|
| project-intelligence: risk model | 2d | |
| project-intelligence: cross-coupling correlations | 2d | |
| Platform: graph router (NetworkX queries) | 2d | |
| Platform: intelligence + risk routers | 1d | |
| Frontend: KnowledgeGraph explorer | 4d | |
| Frontend: RiskMap + RiskTreemap | 3d | |
| Frontend: Combined Dashboard | 2d | |
| Tests | 2d | |

### Phase 5: Polish & Extend (ongoing)

- C#/Java parsers
- Ownership analyzer (extract from git author data)
- Complexity analyzer (cyclomatic complexity)
- Architecture map visualization
- Export to Excalidraw
- CLI for headless analysis

---

## 10. Technology Decisions

| Decision | Chosen | Rationale | Migration Path |
|----------|--------|-----------|---------------|
| Project structure | Python packages in monorepo | Simple, shared venv, `pip install -e .` | Extract to separate repos + PyPI if team grows |
| Inter-project comms | Direct Python calls | Zero overhead, type-safe | Add HTTP/gRPC if deployed as microservices |
| Database | SQLite (one per repo) | Zero-ops, fast, proven | Migrate to PostgreSQL if multi-user/concurrent |
| Graph queries | NetworkX in-memory | Fast for <100K nodes, Python-native | Swap to Neo4j/Memgraph for large graphs |
| Async tasks | FastAPI BackgroundTasks | Already works, simple | Add Celery/ARQ for multi-worker |
| Caching | Python lru_cache | Single process | Add Redis for multi-process |
| AST parsing | tree-sitter (+ ast for Python) | Multi-language, well-maintained | — |
| Semantic embedding | TF-IDF + cosine similarity | Fast, no GPU, interpretable | Add CodeBERT for higher accuracy |
| Frontend framework | React + Vite + TailwindCSS | Already in use, proven | — |
| Visualization | D3.js | Already in use, flexible | — |
| State management | React state + Zustand | Lightweight | — |

---

## 11. Extensibility Guide

### Adding a New Analyzer

1. **Create project**: `my-analyzer/` with `pyproject.toml` + `my_analyzer/` package
2. **Define interface**: Add `MyAnalyzerAPI(ABC)` in `platform/code_intel/interfaces/my_analyzer.py`
3. **Implement plugin**: `my_analyzer/plugin.py` → subclass `BaseAnalyzer` + implement `MyAnalyzerAPI`
4. **Register**: Add import to `platform/code_intel/app.py` → `register_analyzers()`
5. **Add router**: `platform/code_intel/routers/my.py` → proxy to `MyAnalyzerAPI`
6. **Add frontend**: `frontend/src/features/my/` + `frontend/src/api/my.ts`
7. **The orchestrator, graph queries, and risk model automatically pick up new relationships**

### Adding a New Language Parser (within dep-analyzer or semantic-analyzer)

1. Create `dep_analyzer/parsers/my_language_parser.py`
2. Subclass `BaseParser`, implement `parse_imports()`, `parse_entities()`
3. Register by file extension in parser factory
4. Both analyzers automatically use it

### Adding a New Relationship Type

1. Add constant to `RelKind` in `code_intel/interfaces/types.py`
2. Write relationships with the new kind from your analyzer
3. Knowledge graph, risk model, and graph queries automatically include it
4. Add filtering option in `GraphFilters.tsx` frontend component
