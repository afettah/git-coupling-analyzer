# Scaffolding Migration Planner

## Pain / Problem

Large-scale migrations (framework upgrade, state management change, API redesign) are terrifying because they require **the application to keep working throughout the migration**. You can't simply rip out the old system and drop in the new one — that creates a broken state that might last weeks.

The speech describes the scaffolding strategy: *"Introduce a scaffold layer. Allow old and new systems to coexist. Use feature flags or environment variables. Migrate components incrementally. Validate equivalence. Remove the scaffold once complete."*

Today, teams plan scaffolding migrations on whiteboards and in documents. There's no tool that understands the codebase structure and can **generate a concrete scaffolding plan** with specific adapter files, feature flags, and a migration order based on the real dependency graph.

## Idea

Build a **Scaffolding Migration Planner** that:

1. **Analyzes** the current codebase to identify all usage points of the old system (e.g., every component using Redux).
2. **Generates** a scaffold layer — adapter/wrapper code that lets old and new systems coexist.
3. **Plans** an incremental migration order based on the dependency graph (leaf components first, core last).
4. **Tracks** migration progress with a visual "old vs. new" map.
5. **Validates** behavioral equivalence at each step (old and new produce the same output).

## Expected Added Value

| Dimension | Impact |
|---|---|
| **Zero-downtime migration** | App works at every intermediate step — no "big bang" switchover. |
| **Concrete plan** | Instead of vague "migrate to Zustand," get a file-by-file plan with adapter code. |
| **Dependency-aware order** | Migrate in the right sequence — no "migrated component depends on unmigrated one." |
| **Progress visibility** | See exactly how far along the migration is at any point. |
| **Rollback safety** | Feature flags mean any step can be rolled back instantly. |

## Pseudo Front Screens

### Screen 1 — Migration Setup
```
┌─────────────────────────────────────────────────────────┐
│  🏗️  Scaffolding Migration Planner                       │
│                                                         │
│  Repository: [frontend-app ▼]                           │
│                                                         │
│  Migration type:                                        │
│    ○ Framework upgrade (e.g., React 17→18)              │
│    ● State management (e.g., Redux → Zustand)           │
│    ○ API layer (e.g., REST → GraphQL)                   │
│    ○ Custom                                             │
│                                                         │
│  Old system pattern:                                    │
│    Import: [import { connect } from 'react-redux']      │
│    Usage:  [connect(mapState)(Component)]                │
│                                                         │
│  New system:                                            │
│    Import: [import { useStore } from './store']          │
│    Usage:  [const state = useStore(selector)]            │
│                                                         │
│  [Scan Codebase]                                        │
└─────────────────────────────────────────────────────────┘
```

### Screen 2 — Migration Plan
```
┌───────────────────────────────────────────────────────────────┐
│  🏗️  Migration Plan — 47 components to migrate                │
│                                                               │
│  ── Scaffold Layer (auto-generated) ──                        │
│  📄 src/scaffold/stateAdapter.ts  (bridges Redux ↔ Zustand)   │
│  📄 src/scaffold/featureFlags.ts  (controls old/new toggle)   │
│  📄 src/scaffold/equivalenceTest.ts (validates same output)   │
│                                                               │
│  ── Migration Phases ──                                       │
│                                                               │
│  Phase 1: Leaf components (no dependents)         14 files    │
│    ├── UserAvatar.tsx (0 deps)                                │
│    ├── StatusBadge.tsx (0 deps)                               │
│    └── ... 12 more                                            │
│                                                               │
│  Phase 2: Mid-level components                    18 files    │
│    ├── UserCard.tsx (→ Phase 1: UserAvatar)                   │
│    ├── NotificationList.tsx (→ Phase 1: StatusBadge)          │
│    └── ... 16 more                                            │
│                                                               │
│  Phase 3: Core components                         11 files    │
│    ├── AppShell.tsx (→ Phase 2: many)                         │
│    └── ... 10 more                                            │
│                                                               │
│  Phase 4: Remove scaffold                          3 files    │
│    ├── Delete stateAdapter.ts                                 │
│    ├── Delete featureFlags.ts                                 │
│    └── Remove old redux dependency                            │
│                                                               │
│  [Generate scaffold code]  [Start Phase 1]  [Export plan]     │
└───────────────────────────────────────────────────────────────┘
```

### Screen 3 — Migration Progress
```
┌───────────────────────────────────────────────────────────────┐
│  🏗️  Migration Progress — Phase 2 in progress                 │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  [Component Tree — colored by migration status]          │  │
│  │                                                         │  │
│  │  🟢 = migrated (new system)                              │  │
│  │  🔴 = unmigrated (old system)                            │  │
│  │  🟡 = scaffold active (adapter bridging)                 │  │
│  │                                                         │  │
│  │       AppShell 🔴                                        │  │
│  │      /         \                                         │  │
│  │  UserCard 🟡    NotifList 🟡                              │  │
│  │   /                \                                     │  │
│  │ UserAvatar 🟢    StatusBadge 🟢                           │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  Phase 1: ██████████ 14/14  ✅ Complete                       │
│  Phase 2: ████░░░░░░  8/18  🔄 In progress                   │
│  Phase 3: ░░░░░░░░░░  0/11  ⏳ Waiting                       │
│  Phase 4: ░░░░░░░░░░  0/3   ⏳ Waiting                       │
│                                                               │
│  Equivalence tests: 22/22 passing ✅                          │
│                                                               │
│  [Migrate next component]  [Run equivalence tests]            │
└───────────────────────────────────────────────────────────────┘
```

## Pseudo High Level Flow

```
1. User defines migration (old system pattern + new system pattern)
2. System scans codebase:
       │
       ├── Find all files using old system (AST/grep)
       ├── Build dependency graph of affected files
       └── Identify leaf → mid → core layers
       │
3. Generate scaffold layer:
       │
       ├── Adapter module (bridges old API to new API)
       ├── Feature flag module (toggle old/new per component)
       └── Equivalence test template (verify same behavior)
       │
4. Compute migration phases:
       │
       ├── Phase 1: leaf components (no dependents using old system)
       ├── Phase 2..N: next dependency layer
       ├── Phase N+1: remove scaffold and old system
       └── Each phase: list of files + migration instructions
       │
5. For each phase:
       │
       a. Migrate files:
            ├── Replace old pattern with new pattern
            ├── Add scaffold adapter where needed
            └── Set feature flag for migrated component
       │
       b. Validate:
            ├── Run equivalence tests (old path vs new path)
            ├── Run existing test suite
            └── Manual smoke test (if configured)
       │
       c. If all green → commit, move to next phase
       d. If failure → rollback via feature flag, investigate
       │
6. Final phase: remove scaffold, feature flags, old dependency
7. Celebration 🎉
```

## High Level Design

```
┌──────────────────────────────────────────────────────────────┐
│                       Frontend (React)                        │
│                                                              │
│  MigrationWizard ──► MigrationPlan ──► ProgressTracker       │
│       │                   │                   │               │
│  (old/new config)   (phases + scaffold)  (tree + status)      │
└──────────┬────────────────┬───────────────────┬──────────────┘
           │  REST API       │                  │
┌──────────▼────────────────▼───────────────────▼──────────────┐
│                     Backend (FastAPI)                          │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │  Pattern        │  │  Scaffold      │  │  Migration     │  │
│  │  Scanner        │  │  Generator     │  │  Executor      │  │
│  │                 │  │                │  │                │  │
│  │ - AST matching  │  │ - Adapter code │  │ - Phase mgmt   │  │
│  │ - Grep matching │  │ - Feature flag │  │ - Apply change │  │
│  │ - Dep graph     │  │   module       │  │ - Run equiv    │  │
│  │   extraction    │  │ - Equiv test   │  │   tests        │  │
│  │                 │  │   template     │  │ - Rollback     │  │
│  └───────┬─────────┘  └───────┬────────┘  └───────┬────────┘  │
│          │                    │                    │           │
│  ┌───────▼────────────────────▼────────────────────▼────────┐  │
│  │                 LFCA Data Layer                            │  │
│  │  dependency graph + coupling edges + file identity        │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Responsibility |
|---|---|
| **Pattern Scanner** | Finds all usages of old system, builds sub-graph of affected files. |
| **Scaffold Generator** | Generates adapter code, feature flags, and equivalence test templates. |
| **Migration Executor** | Manages phase-by-phase migration, applies changes, runs validation, handles rollback. |
| **LFCA Data Layer** | Dependency graph, coupling edges, file identity. Already exists. |
