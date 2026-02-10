# Dependency-Aware Task Decomposition

## Pain / Problem

When a tech lead breaks a large migration or feature into JIRA tickets, the decomposition is usually based on **intuition and folder structure** — not on actual code dependencies. This leads to:

- Tickets that block each other unexpectedly (file A in Ticket 1 depends on file B in Ticket 2).
- Developers discovering mid-sprint that their task can't be completed until another task finishes.
- Merge conflicts when two developers unknowingly modify tightly coupled files.

The speech highlights this clearly: *"Instead of hundreds of files, we now manage a smaller number of logical units"* and *"A well-decomposed task should be small enough to complete in one commit, executable in parallel, verifiable by a human, and clearly ordered by dependency."*

LFCA already has the coupling and dependency data to automate this decomposition — but currently it's only used for visualization, not for task planning.

## Idea

Build a **Task Decomposition Engine** that takes a high-level task description and a set of target files, then uses the LFCA dependency and coupling graphs to produce an **optimal task breakdown** with:

- **Tasks** that respect module boundaries (no file appears in two tasks).
- **Dependency ordering** (topological sort so leaf modules come first).
- **Parallel lanes** for tasks with no mutual dependencies.
- **One-shot sizing** — each task is small enough for a single developer/agent to complete without context switching.

The output is a visual **Gantt-like dependency chart** showing which tasks can run in parallel and which must be sequential.

## Expected Added Value

| Dimension | Impact |
|---|---|
| **Planning accuracy** | Tasks reflect real code structure, not guesswork. |
| **Fewer blockers** | Dependency-ordered tasks eliminate surprise blocking. |
| **Maximum parallelism** | Independent tasks are identified and can run concurrently. |
| **Right-sized tasks** | Each task fits in one PR, one review session, one agent run. |
| **Exportable** | Generate JIRA tickets, GitHub issues, or agent prompts directly. |

## Pseudo Front Screens

### Screen 1 — Task Definition
```
┌─────────────────────────────────────────────────────────┐
│  📋 Task Decomposition                                   │
│                                                         │
│  Repository: [openhands ▼]                              │
│                                                         │
│  Task description:                                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Migrate all agent modules from unittest to      │    │
│  │ pytest. Update fixtures, assertions, and         │    │
│  │ remove unittest.TestCase inheritance.            │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  Scope:  ○ Entire repo                                  │
│          ● Selected folders: [src/agent/] [tests/agent/]│
│                                                         │
│  Constraints:                                           │
│    Max files per task: [15]                              │
│    Strategy: [Dependency-first ▼]                       │
│                                                         │
│  [Generate Decomposition]                               │
└─────────────────────────────────────────────────────────┘
```

### Screen 2 — Task Graph
```
┌───────────────────────────────────────────────────────────────┐
│  📋 Decomposition — 67 files → 6 tasks                        │
│                                                               │
│  Lane 1  ┌──────────┐              ┌──────────┐              │
│          │ Task 1    │──────────────│ Task 4   │              │
│          │ 11 files  │              │ 14 files │              │
│          │ leaf utils│              │ agent core│             │
│          └──────────┘              └──────────┘              │
│                                          │                    │
│  Lane 2  ┌──────────┐  ┌──────────┐     │    ┌──────────┐   │
│          │ Task 2    │──│ Task 5   │─────┘────│ Task 6   │   │
│          │ 12 files  │  │ 9 files  │          │ 8 files  │   │
│          │ helpers   │  │ handlers │          │ integ.   │   │
│          └──────────┘  └──────────┘          └──────────┘   │
│                                                               │
│  Lane 3  ┌──────────┐                                        │
│          │ Task 3    │                                        │
│          │ 13 files  │                                        │
│          │ test utils│                                        │
│          └──────────┘                                        │
│                                                               │
│  ──► = dependency   Tasks 1,2,3 can start in parallel         │
│                                                               │
│  [Export as GitHub Issues]  [Export as Agent Prompts]          │
│  [Adjust task boundaries]  [View file list per task]          │
└───────────────────────────────────────────────────────────────┘
```

### Screen 3 — Task Detail
```
┌─────────────────────────────────────────────────────────┐
│  📄 Task 4 — Agent Core Migration                        │
│                                                         │
│  Files (14):                                            │
│    src/agent/codeact_agent.py                           │
│    src/agent/browsing_agent.py                          │
│    src/agent/manager.py                                 │
│    tests/agent/test_codeact.py                          │
│    ...                                                  │
│                                                         │
│  Depends on: Task 1 (leaf utils must be migrated first) │
│  Blocks: Task 6 (integration tests)                     │
│                                                         │
│  Instructions:                                          │
│    1. Remove unittest.TestCase from test classes         │
│    2. Replace self.assert* with plain assert             │
│    3. Convert setUp/tearDown to pytest fixtures          │
│    4. Run: pytest tests/agent/ -x                       │
│                                                         │
│  [Edit instructions]  [Assign to agent]  [Create issue] │
└─────────────────────────────────────────────────────────┘
```

## Pseudo High Level Flow

```
1. User defines task (description + file scope + constraints)
2. System resolves file scope:
       │
       ├── Folder glob → file list
       └── Coupling expansion → include tightly coupled files
       │
3. Build a sub-graph from dependency + coupling edges
4. Apply decomposition algorithm:
       │
       ├── Topological layering (leaf → core)
       ├── Community detection (group tightly coupled files)
       ├── Size balancing (split large groups, merge tiny ones)
       └── Constraint: no file in two tasks
       │
5. Compute dependency edges between tasks
6. Identify parallel lanes (tasks with no mutual dependency path)
7. Generate per-task context:
       │
       ├── File list
       ├── Dependencies (which tasks must finish first)
       ├── Auto-generated instructions (from task description + file context)
       └── Verification command (test command, lint command)
       │
8. Present as interactive task graph
9. User can:
       │
       ├── Adjust boundaries (drag files between tasks)
       ├── Export as GitHub Issues / JIRA tickets
       ├── Export as agent prompts for multi-agent execution
       └── Start execution (manual or automated)
```

## High Level Design

```
┌──────────────────────────────────────────────────────────────┐
│                       Frontend (React)                        │
│                                                              │
│  TaskWizard ──► TaskGraph (DAG) ──► TaskDetail               │
│      │              │                     │                   │
│  (scope + desc)  (Gantt/DAG view)   (files + instructions)   │
└──────────┬──────────┬─────────────────────┬──────────────────┘
           │  REST    │                     │
┌──────────▼──────────▼─────────────────────▼──────────────────┐
│                      Backend (FastAPI)                         │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │ Scope Resolver  │  │ Decomposition  │  │   Exporter     │  │
│  │                 │  │   Engine       │  │                │  │
│  │ - Glob files    │  │ - Topo sort    │  │ - GitHub Issue │  │
│  │ - Coupling      │  │ - Community    │  │ - JIRA         │  │
│  │   expansion     │  │   detection    │  │ - Agent prompt │  │
│  │                 │  │ - Size balance │  │ - Markdown     │  │
│  └───────┬─────────┘  └───────┬────────┘  └───────┬────────┘  │
│          │                    │                    │           │
│  ┌───────▼────────────────────▼────────────────────▼────────┐  │
│  │                 LFCA Data Layer                            │  │
│  │  coupling edges + dependency graph + file identity        │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Responsibility |
|---|---|
| **Scope Resolver** | Resolves folder globs to files, expands via coupling edges. |
| **Decomposition Engine** | Core algorithm: topological layering + community detection + size balancing. |
| **Exporter** | Serializes tasks to GitHub Issues, JIRA, agent prompts, or plain markdown. |
| **LFCA Data Layer** | Coupling edges, dependency graph, file identity. Already exists. |
