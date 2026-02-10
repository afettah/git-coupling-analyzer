# Change Impact Propagation Analysis

## Pain / Problem

A developer modifies a file and submits a PR. The CI runs tests and they pass — but a week later, a subtle bug surfaces in a seemingly unrelated module. The root cause? The modified file was **logically coupled** to the broken module through shared data patterns, co-change history, or transitive dependencies that no static import graph captures.

Today, code review relies on the reviewer's mental model of the codebase. Static analysis catches direct import breakages but misses **behavioral coupling** — files that historically change together because they share implicit contracts. LFCA already computes these coupling edges, but they sit in Parquet files, unused at the moment a developer actually needs them: **when they're about to push a change**.

## Idea

Build a **Change Impact Analyzer** that, given a set of modified files (from a git diff or staged changes), queries the LFCA coupling graph and dependency graph to compute a **propagation map** — a ranked list of files likely to be affected by the change, with confidence scores and historical evidence.

The result is presented as an interactive ripple diagram: the changed files at the center, direct dependents in the first ring, logically coupled files in the second ring, and transitive impacts in outer rings. Each file shows *why* it's flagged (import dependency, co-change history, shared author pattern) and *how strongly* coupled it is.

## Expected Added Value

| Dimension | Impact |
|---|---|
| **Bug prevention** | Surface hidden coupling before code reaches production. |
| **Smarter reviews** | Reviewers know exactly which modules to inspect beyond the diff. |
| **Test targeting** | Run only the tests that cover the impact zone — faster CI. |
| **Onboarding** | New developers instantly see the "blast radius" of any file. |
| **Architecture health** | Repeated large impact zones reveal unhealthy coupling hotspots. |

## Pseudo Front Screens

### Screen 1 — Impact Analysis Trigger
```
┌────────────────────────────────────────────────────────┐
│  💥 Change Impact Analysis                              │
│                                                        │
│  Repository:  [openhands ▼]                            │
│                                                        │
│  Source:  ● Git diff (HEAD vs main)                    │
│           ○ Manual file selection                      │
│           ○ PR #347                                    │
│                                                        │
│  Changed files detected:                               │
│    📄 src/agent/codeact_agent.py       (+42 / -18)     │
│    📄 src/agent/prompts/system.py      (+5  / -5)      │
│    📄 src/core/config.py               (+12 / -3)      │
│                                                        │
│  [Analyze Impact]                                      │
└────────────────────────────────────────────────────────┘
```

### Screen 2 — Ripple Diagram
```
┌────────────────────────────────────────────────────────────┐
│  💥 Impact Map — 3 changed → 24 potentially affected       │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                                                      │  │
│  │            ○ ○           ○                            │  │
│  │          ○       ○     ○   ○                          │  │
│  │        ○   ● ● ●   ○       ○                          │  │
│  │          ○       ○     ○   ○                          │  │
│  │            ○ ○           ○                            │  │
│  │                                                      │  │
│  │  ● Changed  ◉ Direct dep  ○ Coupled  ○ Transitive    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  Risk     File                        Coupling   Reason    │
│  ──────   ──────────────────────────  ────────   ──────    │
│  🔴 0.92  src/agent/manager.py        direct     imports   │
│  🔴 0.88  tests/test_codeact.py       co-change  87% hist  │
│  🟡 0.71  src/runtime/sandbox.py      coupled    63% hist  │
│  🟡 0.65  src/core/state.py           transitive 2-hop     │
│  🟢 0.34  src/ui/components/agent.tsx  weak       31% hist  │
│  ...                                                       │
│                                                            │
│  [Export report]  [Suggest tests to run]  [Add to PR]      │
└────────────────────────────────────────────────────────────┘
```

### Screen 3 — File Detail Drill-Down
```
┌────────────────────────────────────────────────────────────┐
│  🔍 src/agent/manager.py — Impact Detail                   │
│                                                            │
│  Coupling to changed files:                                │
│    → codeact_agent.py   score: 0.92  (import + 87% co-Δ)  │
│    → config.py          score: 0.65  (import)              │
│                                                            │
│  Historical co-change evidence:                            │
│    Last 50 commits touching codeact_agent.py:              │
│    43 of them (86%) also touched manager.py                │
│                                                            │
│  Suggested action:                                         │
│    ⚠ Review this file for side-effects.                    │
│    🧪 Run: pytest tests/test_agent_manager.py              │
│                                                            │
│  [View coupling history]  [Open in editor]                 │
└────────────────────────────────────────────────────────────┘
```

## Pseudo High Level Flow

```
1. User triggers impact analysis:
       │
       ├── From UI: select repo + diff source
       ├── From CLI: `lfca impact --diff HEAD~1`
       └── From CI hook: automatic on PR creation
       │
2. System extracts the list of changed files from git diff
3. For each changed file, query:
       │
       ├── Static dependency graph → direct importers/importees
       ├── LFCA coupling edges → co-change partners (above threshold)
       └── Transitive closure (up to depth N, default 2)
       │
4. Compute impact score per affected file:
       │
       score = w1 * dependency_strength
             + w2 * coupling_score
             + w3 * recency_factor
             + w4 * change_frequency
       │
5. Rank affected files by impact score
6. Build ripple diagram (center = changed, rings = impact layers)
7. Present results in UI with:
       │
       ├── Interactive ripple diagram
       ├── Ranked file table with scores and reasons
       ├── Drill-down per file with historical evidence
       └── Suggested test commands
       │
8. Optional: push impact report as PR comment
```

## High Level Design

```
┌──────────────────────────────────────────────────────────────┐
│                        Frontend (React)                       │
│                                                              │
│  ImpactTrigger ──► RippleDiagram ──► FileDetailPanel         │
│       │                 │                   │                 │
│  (diff source)   (D3 concentric graph)  (coupling evidence)  │
└──────────┬──────────────┬───────────────────┬────────────────┘
           │    REST API   │                  │
┌──────────▼──────────────▼───────────────────▼────────────────┐
│                      Backend (FastAPI)                         │
│                                                              │
│  ┌───────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │  Diff Parser   │  │ Impact Scorer  │  │  Report Builder │  │
│  │                │  │                │  │                 │  │
│  │ - git diff     │  │ - BFS/DFS on   │  │ - Ripple JSON   │  │
│  │ - PR files API │  │   dep + coupling│  │ - Markdown      │  │
│  │ - Manual input │  │   graphs       │  │ - PR comment    │  │
│  │                │  │ - Score formula │  │ - Test suggest  │  │
│  └───────┬────────┘  └───────┬────────┘  └────────┬────────┘  │
│          │                   │                     │           │
│  ┌───────▼───────────────────▼─────────────────────▼────────┐  │
│  │                 LFCA Data Layer                            │  │
│  │  edges_file_topk.parquet  │  dependency graph  │  git log │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Responsibility |
|---|---|
| **Diff Parser** | Extracts changed file list from git diff, PR API, or manual input. |
| **Impact Scorer** | Traverses coupling + dependency graphs, computes per-file impact scores with weighted formula. |
| **Report Builder** | Generates the ripple diagram data, ranked table, and optional PR comment / CI report. |
| **LFCA Data Layer** | Provides coupling edges, dependency graph, file identity. Already exists. |
