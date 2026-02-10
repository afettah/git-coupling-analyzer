# Smart Refactoring Batching

## Pain / Problem

When a team decides to perform a large-scale refactoring (rename a pattern, extract interfaces, migrate a library), the codebase is too large for one developer — or one AI agent — to handle in a single pass. Files are interdependent: touching one file without updating its dependents produces broken imports, type errors, and test failures. Without structure, developers either attempt a risky "big-bang" commit or make random small PRs that constantly conflict with each other.

Today, engineers mentally partition the work, but this is error-prone, doesn't scale, and ignores the coupling graph that our project already computes.

## Idea

Leverage the **logical coupling graph** and **static dependency graph** already produced by LFCA to automatically partition a refactoring task into **dependency-safe batches**. Each batch groups files that can be modified together without breaking files outside the batch. Batches are ordered topologically so that leaf-level modules are refactored first, and core modules last.

The user selects a refactoring intent (e.g., "replace all `datetime.utcnow()` with `datetime.now(timezone.utc)`"), the system computes the affected file set, groups them into batches using the coupling/dependency graph, and presents a visual batch plan the user can review and adjust before execution.

## Expected Added Value

| Dimension | Impact |
|---|---|
| **Risk reduction** | Each batch is self-contained — a failed batch doesn't corrupt unrelated code. |
| **Parallelism** | Independent batches can be assigned to different developers or agents simultaneously. |
| **Reviewability** | Small, logically grouped PRs are easier to review than a 200-file mega-PR. |
| **Traceability** | The coupling graph provides an auditable reason for why files were grouped together. |
| **Reusability** | Batching logic is reusable across any refactoring task — not tied to one migration. |

## Pseudo Front Screens

### Screen 1 — Refactoring Task Setup
```
┌─────────────────────────────────────────────────────┐
│  🔧 New Refactoring Task                            │
│                                                     │
│  Repository:  [openhands ▼]                         │
│  Task type:   [Code pattern replacement ▼]          │
│  Description: [Replace datetime.utcnow() with       │
│                datetime.now(timezone.utc)]           │
│                                                     │
│  Scope filter (optional):                           │
│    Folders:   [src/agent/  ]  [+ Add folder]        │
│    File ext:  [*.py]                                 │
│                                                     │
│  [Scan Affected Files]                              │
└─────────────────────────────────────────────────────┘
```

### Screen 2 — Batch Plan Review
```
┌───────────────────────────────────────────────────────────┐
│  📦 Batch Plan — 142 files → 8 batches                    │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  [Interactive Dependency Graph]                      │  │
│  │  Nodes colored by batch. Edges show dependencies.   │  │
│  │  Click a batch to highlight its files.               │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  Batch 1 (leaf)    12 files   0 deps    [▶ Start]         │
│  Batch 2 (leaf)    18 files   0 deps    [▶ Start]         │
│  Batch 3           22 files   → B1      [⏳ Waiting]      │
│  Batch 4           15 files   → B1, B2  [⏳ Waiting]      │
│  ...                                                      │
│  Batch 8 (core)     9 files   → B6, B7  [⏳ Waiting]      │
│                                                           │
│  Batching strategy: [Dependency-first ▼]                  │
│  [Adjust batches manually]  [Execute all]                 │
└───────────────────────────────────────────────────────────┘
```

### Screen 3 — Batch Execution Progress
```
┌───────────────────────────────────────────────────────────┐
│  🚀 Execution — Batch 3 / 8                               │
│                                                           │
│  ✅ Batch 1   12/12 files   PR #341 merged                │
│  ✅ Batch 2   18/18 files   PR #342 merged                │
│  🔄 Batch 3   14/22 files   PR #343 in progress           │
│  ⏳ Batch 4   waiting on B1, B2                            │
│  ...                                                      │
│  Overall: ████████░░░░░░░░ 42%                            │
│                                                           │
│  [Pause]  [View PR #343]  [Skip Batch]                    │
└───────────────────────────────────────────────────────────┘
```

## Pseudo High Level Flow

```
1. User creates a refactoring task (description + scope)
2. System scans repository for affected files
       │
       ├── Static analysis: grep / AST match for target pattern
       └── Coupling expansion: include logically coupled files (from LFCA edges)
       │
3. System builds a sub-graph of affected files + their dependencies
4. Batching algorithm partitions the sub-graph:
       │
       ├── Strategy: topological layers (leaf → core)
       ├── Constraint: no batch depends on a file in a later batch
       └── Optimization: balance batch sizes (min 5, max 30 files)
       │
5. User reviews the batch plan on the visual graph
6. User can drag files between batches or split/merge batches
7. Execution begins (manual or automated):
       │
       For each batch (in topological order):
         a. Create a git branch / worktree
         b. Apply the refactoring to batch files
         c. Run verification (tests, linter, type-check)
         d. If green → open PR
         e. If red → flag for human review
         f. On PR merge → unlock dependent batches
       │
8. Dashboard tracks overall progress (green/red/pending)
```

## High Level Design

```
┌──────────────────────────────────────────────────────────┐
│                       Frontend (React)                    │
│                                                          │
│  RefactoringWizard ──► BatchPlanView ──► ExecutionDash   │
│        │                    │                  │          │
│  (task setup)    (graph + batch table)  (progress + PRs) │
└──────────┬───────────────────┬──────────────────┬────────┘
           │  REST / WebSocket │                  │
┌──────────▼───────────────────▼──────────────────▼────────┐
│                     Backend (FastAPI)                      │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Refactoring  │  │   Batching   │  │   Execution    │  │
│  │   Scanner    │  │   Engine     │  │   Orchestrator │  │
│  │              │  │              │  │                │  │
│  │ - AST match  │  │ - Topo sort  │  │ - Git worktree │  │
│  │ - Grep match │  │ - Coupling   │  │ - Apply patch  │  │
│  │ - Coupling   │  │   weighting  │  │ - Run checks   │  │
│  │   expansion  │  │ - Size       │  │ - Open PR      │  │
│  │              │  │   balancing  │  │ - Track status │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘  │
│         │                 │                   │           │
│  ┌──────▼─────────────────▼───────────────────▼────────┐  │
│  │              LFCA Data Layer                         │  │
│  │  coupling edges (parquet) + dependency graph + git   │  │
│  └─────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Responsibility |
|---|---|
| **Refactoring Scanner** | Finds all files matching the refactoring pattern; expands the set using LFCA coupling edges. |
| **Batching Engine** | Partitions the file set into topologically ordered, size-balanced batches using the dependency graph. |
| **Execution Orchestrator** | Manages git branches/worktrees, applies changes, runs verification, opens PRs, tracks batch state. |
| **LFCA Data Layer** | Provides coupling edges, dependency graph, and file identity (rename-aware). Already exists in the project. |
