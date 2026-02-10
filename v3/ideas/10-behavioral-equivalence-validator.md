# Behavioral Equivalence Validator

## Pain / Problem

After any large-scale code change — refactoring, migration, AI-generated fix — the fundamental question is: **"Does the code still do the same thing?"** Existing test suites help, but they're never complete. The speech notes: *"Beyond regression tests: add unit tests (even AI-generated ones). Validate subprogram behavior. The goal is observational equivalence, not necessarily identical code."*

The problem is especially acute for:
- **Legacy codebases** with low test coverage — tests pass but don't cover the changed paths.
- **AI-generated changes** — the agent might "fix" a TODO by subtly altering behavior.
- **Refactoring** — the intent is to change structure without changing behavior, but there's no automated way to verify this.

LFCA knows which files changed and which files are coupled to them. What's missing is a way to **automatically generate equivalence checks** for the changed behavior.

## Idea

Build a **Behavioral Equivalence Validator** that:

1. **Identifies** the public interface of each changed file (exported functions, class methods, API endpoints).
2. **Generates** property-based tests or snapshot tests that capture the behavior *before* the change.
3. **Runs** the same tests *after* the change and compares outputs.
4. **Reports** behavioral differences — not just "test passed/failed" but "function X now returns Y instead of Z for input W."

The validator works at three levels:
- **Function level**: Compare input/output pairs for individual functions.
- **Module level**: Compare the observable API of a module.
- **Integration level**: Compare HTTP responses, database queries, or message bus outputs.

## Expected Added Value

| Dimension | Impact |
|---|---|
| **Confidence** | Know with certainty that a refactoring didn't change behavior. |
| **Coverage gap fill** | Auto-generated tests cover paths that manual tests miss. |
| **AI safety net** | Verify AI-generated changes maintain behavioral equivalence. |
| **Legacy-friendly** | Works even in codebases with zero existing tests. |
| **Diff-level precision** | Reports exactly which behaviors changed, not just pass/fail. |

## Pseudo Front Screens

### Screen 1 — Validator Setup
```
┌─────────────────────────────────────────────────────────┐
│  🔬 Behavioral Equivalence Validator                     │
│                                                         │
│  Repository: [openhands ▼]                              │
│  Compare:    [main] vs [refactor/agent-init]            │
│                                                         │
│  Changed files: 12 files                                │
│  Public interfaces detected: 34 functions, 8 classes    │
│                                                         │
│  Validation level:                                      │
│    [✓] Function-level (input/output comparison)         │
│    [✓] Module-level (API surface snapshot)              │
│    [ ] Integration-level (HTTP/DB comparison)           │
│                                                         │
│  Test generation:                                       │
│    Strategy: [● Property-based  ○ Snapshot  ○ Both]     │
│    Max tests per function: [20]                         │
│                                                         │
│  [Generate & Run Equivalence Tests]                     │
└─────────────────────────────────────────────────────────┘
```

### Screen 2 — Equivalence Report
```
┌───────────────────────────────────────────────────────────────┐
│  🔬 Equivalence Report — main vs refactor/agent-init          │
│                                                               │
│  Summary: 34 functions checked | 31 equivalent | 3 different  │
│                                                               │
│  ✅ Equivalent (31):                                           │
│     agent.register()           20/20 tests pass               │
│     agent.unregister()         20/20 tests pass               │
│     config.load()              20/20 tests pass               │
│     ... 28 more                                               │
│                                                               │
│  ⚠️  Behavioral Differences (3):                               │
│                                                               │
│  1. agent.Manager.get_priority()                              │
│     ┌─────────────────────────────────────────────────────┐   │
│     │ Input:  agent_name="codeact"                        │   │
│     │ Before: returns None                                │   │
│     │ After:  returns 0                                   │   │
│     │ Impact: 6 callers in 4 files (via coupling graph)   │   │
│     └─────────────────────────────────────────────────────┘   │
│     Verdict: ⚠️  Changed default — may be intentional         │
│                                                               │
│  2. config.Config.__init__()                                  │
│     ┌─────────────────────────────────────────────────────┐   │
│     │ Input:  Config(timeout=None)                        │   │
│     │ Before: raises KeyError                             │   │
│     │ After:  sets timeout=30 (default)                   │   │
│     │ Impact: 3 callers in 2 files                        │   │
│     └─────────────────────────────────────────────────────┘   │
│     Verdict: ⚠️  Error handling changed — review required     │
│                                                               │
│  [Accept all differences]  [Mark as bugs]  [Export report]    │
└───────────────────────────────────────────────────────────────┘
```

## Pseudo High Level Flow

```
1. User selects two branches/commits to compare
2. System identifies changed files (git diff)
3. For each changed file:
       │
       a. Extract public interface:
            ├── Parse AST for exported functions/classes
            ├── Identify parameters and return types
            └── Note any coupled callers (from LFCA)
       │
       b. Generate equivalence tests:
            ├── Property-based: generate random inputs, compare outputs
            ├── Snapshot: capture return values for known inputs
            └── Edge cases: null, empty, boundary values
       │
4. Run tests on BEFORE version (checkout base branch):
       │
       ├── Execute all generated tests
       └── Record outputs as "expected" baseline
       │
5. Run tests on AFTER version (checkout target branch):
       │
       ├── Execute same tests
       └── Record outputs as "actual"
       │
6. Compare BEFORE vs AFTER:
       │
       ├── Match: function is behaviorally equivalent ✅
       ├── Mismatch: behavioral difference detected ⚠️
       │     ├── Record specific input that differs
       │     ├── Record before/after outputs
       │     └── Look up impact via LFCA coupling graph
       │
7. Generate equivalence report:
       │
       ├── Equivalent functions (with test count)
       ├── Different functions (with specific diffs and impact)
       └── Overall equivalence score
       │
8. User reviews differences:
       │
       ├── Accept (intentional change)
       ├── Flag as bug (unintentional change)
       └── Request investigation
```

## High Level Design

```
┌──────────────────────────────────────────────────────────────┐
│                       Frontend (React)                        │
│                                                              │
│  ValidatorSetup ──► EquivalenceReport ──► DiffDetail         │
│       │                    │                    │              │
│  (branch select)    (summary + diffs)     (specific input/   │
│                                            output pairs)      │
└──────────┬─────────────────┬────────────────────┬────────────┘
           │  REST API        │                   │
┌──────────▼─────────────────▼────────────────────▼────────────┐
│                     Backend (FastAPI)                          │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │  Interface      │  │  Test          │  │  Comparator    │  │
│  │  Extractor      │  │  Generator     │  │                │  │
│  │                 │  │                │  │ - Run before   │  │
│  │ - AST parser    │  │ - Property     │  │ - Run after    │  │
│  │ - Export finder │  │   -based       │  │ - Diff outputs │  │
│  │ - Type resolver │  │ - Snapshot     │  │ - Score        │  │
│  │                 │  │ - Edge case    │  │ - Impact via   │  │
│  │                 │  │   generator    │  │   LFCA         │  │
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
| **Interface Extractor** | Parses AST of changed files, extracts public functions/classes/methods with signatures. |
| **Test Generator** | Generates property-based, snapshot, and edge-case tests for each public interface. |
| **Comparator** | Runs tests on both branches, diffs outputs, computes equivalence score, resolves impact via LFCA. |
| **LFCA Data Layer** | Coupling edges (to compute impact of differences), dependency graph, file identity. |
