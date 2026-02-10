# Merge Conflict Prevention & Resolution

## Pain / Problem

In any team with more than two developers, merge conflicts are a daily friction. The cost isn't just the time to resolve — it's the **risk of incorrect resolution** that introduces subtle bugs. The speech captures both sides: *"Prevent conflicts: partition tasks so agents modify independent code regions"* and *"Resolve conflicts: agents can be surprisingly effective at resolving merge conflicts when prompted to consider original commit intent."*

The problem is worse with AI agents. When multiple agents work on the same codebase, they have no awareness of each other. Each agent works on its own branch, and when their PRs land, conflicts erupt. Today, a human must manually resolve these — defeating the purpose of agent-driven automation.

LFCA already knows which files are coupled and which files depend on each other. This data can be used **proactively** (prevent conflicts before they happen) and **reactively** (resolve conflicts intelligently when they do happen).

## Idea

Build a **Conflict Prevention & Resolution System** with two modes:

### Prevention Mode
Before assigning work to developers or agents, analyze the coupling graph to identify **conflict zones** — sets of files likely to be modified by multiple tasks. Warn the planner and suggest repartitioning.

### Resolution Mode
When a merge conflict occurs, use the coupling graph and commit intent to **auto-resolve** conflicts. The system provides the conflicting hunks along with:
- The original intent of each branch (from commit messages or PR descriptions).
- The coupling context (what else each branch modified and why).
- A suggested resolution with explanation.

## Expected Added Value

| Dimension | Impact |
|---|---|
| **Prevention** | Detect conflict-prone assignments before work begins. |
| **Speed** | Auto-resolve simple conflicts (70%+ of real-world conflicts are trivial). |
| **Quality** | Intent-aware resolution produces better results than git's 3-way merge. |
| **Agent-friendly** | Enables true parallel agent execution without human merge overhead. |
| **Learning** | Tracks conflict patterns over time to improve batching strategies. |

## Pseudo Front Screens

### Screen 1 — Conflict Risk Analysis (Prevention)
```
┌────────────────────────────────────────────────────────────────┐
│  ⚠️  Conflict Risk Analysis                                    │
│                                                                │
│  Active work streams:                                          │
│    🔵 PR #341 — Refactor agent init (12 files, @dev1)          │
│    🟣 PR #345 — Update config system (8 files, @dev2)          │
│    🟠 Agent batch B3 — Remove TODOs (22 files)                 │
│                                                                │
│  ── Conflict Zones ──                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  [Graph: overlapping files highlighted in red]            │  │
│  │                                                          │  │
│  │  🔴 src/core/config.py — touched by PR#341 AND PR#345    │  │
│  │  🔴 src/agent/manager.py — touched by PR#341 AND batch B3│  │
│  │  🟡 src/agent/__init__.py — PR#341, weak coupling to B3  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  Risk level: 🔴 HIGH — 2 direct overlaps, 1 coupling overlap   │
│                                                                │
│  Recommendations:                                              │
│    1. Merge PR#341 before PR#345 (config.py conflict)          │
│    2. Exclude manager.py from batch B3 (PR#341 overlap)        │
│    3. Sequence: PR#341 → PR#345 → B3                           │
│                                                                │
│  [Apply recommendations]  [Ignore]  [Custom reorder]           │
└────────────────────────────────────────────────────────────────┘
```

### Screen 2 — Conflict Resolution
```
┌────────────────────────────────────────────────────────────────┐
│  🔧 Merge Conflict Resolution — PR #345 into main              │
│                                                                │
│  Conflicts: 2 files, 3 hunks                                  │
│                                                                │
│  ── src/core/config.py (2 hunks) ──                            │
│                                                                │
│  Hunk 1 / L42-55:                                              │
│  ┌────────────────────────────────────────────────┐            │
│  │ <<<<<<< main (from PR #341)                    │            │
│  │   self.timeout = config.get("timeout", 30)     │            │
│  │   self.retries = config.get("retries", 3)      │            │
│  │ =======                                        │            │
│  │   self.timeout = config.timeout                 │            │
│  │   self.retries = config.retries                 │            │
│  │ >>>>>>> pr-345                                  │            │
│  └────────────────────────────────────────────────┘            │
│                                                                │
│  Branch intents:                                               │
│    main (PR#341): "Migrated to dict-based config access"       │
│    PR#345: "Replaced dict access with typed config attrs"      │
│                                                                │
│  💡 Suggested resolution:                                      │
│  ┌────────────────────────────────────────────────┐            │
│  │   self.timeout = config.timeout                 │            │
│  │   self.retries = config.retries                 │            │
│  └────────────────────────────────────────────────┘            │
│  Reason: PR#345's typed attrs supersede PR#341's dict access.  │
│  Both intend to modernize config. PR#345 is the later intent.  │
│                                                                │
│  [Accept suggestion]  [Edit manually]  [Keep ours]  [Keep theirs] │
└────────────────────────────────────────────────────────────────┘
```

## Pseudo High Level Flow

```
PREVENTION MODE:
1. System monitors active PRs and agent batches
2. For each pair of work streams:
       │
       ├── Check for direct file overlap
       ├── Check for coupling overlap (file A in stream 1 coupled to file B in stream 2)
       └── Compute conflict risk score
       │
3. If risk > threshold:
       │
       ├── Flag conflict zone in dashboard
       ├── Suggest ordering (which PR should merge first)
       └── Suggest repartitioning (move conflicting files to one stream)
       │
4. User applies recommendations or overrides

RESOLUTION MODE:
1. Merge conflict detected (git merge fails)
2. For each conflicting hunk:
       │
       a. Extract both versions
       b. Gather context:
            ├── Commit messages from both branches
            ├── PR descriptions
            ├── Coupling data (what else changed in each branch)
            └── Dependency info (who imports this file)
       │
       c. Send to LLM with structured prompt:
            "Given these two changes with these intents,
             produce a merged version that preserves both intents.
             If intents conflict, prefer the more recent one."
       │
       d. Present suggestion with explanation
       │
3. User accepts, edits, or rejects each suggestion
4. Log resolution pattern for future learning
```

## High Level Design

```
┌──────────────────────────────────────────────────────────────┐
│                       Frontend (React)                        │
│                                                              │
│  ConflictRiskView ──► ConflictResolver                       │
│       │                      │                                │
│  (overlap map +         (hunk-by-hunk                         │
│   recommendations)       resolution UI)                       │
└──────────┬───────────────────┬───────────────────────────────┘
           │  REST API          │
┌──────────▼───────────────────▼───────────────────────────────┐
│                     Backend (FastAPI)                          │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────────┐              │
│  │  Risk Analyzer    │  │  Conflict Resolver    │              │
│  │  (Prevention)     │  │  (Resolution)         │              │
│  │                   │  │                       │              │
│  │ - Monitor active  │  │ - Parse conflict      │              │
│  │   work streams    │  │   markers             │              │
│  │ - Overlap detect  │  │ - Gather intent       │              │
│  │ - Coupling overlap│  │   context             │              │
│  │ - Risk scoring    │  │ - LLM resolution      │              │
│  │ - Recommendations │  │ - Apply & verify      │              │
│  └────────┬──────────┘  └──────────┬────────────┘              │
│           │                        │                          │
│  ┌────────▼────────────────────────▼──────────────────────┐    │
│  │                 LFCA Data Layer                          │    │
│  │  coupling edges + commit history + file identity        │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Responsibility |
|---|---|
| **Risk Analyzer** | Monitors active work streams, detects file/coupling overlaps, computes risk, suggests ordering. |
| **Conflict Resolver** | Parses git conflict markers, gathers context from both branches, uses LLM to suggest resolution. |
| **LFCA Data Layer** | Coupling edges, commit history, file identity. Already exists. |
