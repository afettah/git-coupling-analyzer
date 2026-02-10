# AI-Assisted Code Review with Coupling Awareness

## Pain / Problem

Code review is becoming a **bottleneck**. The speech states it directly: *"Code review is becoming a bottleneck."* As teams adopt AI agents that generate code faster, the volume of PRs increases but human review capacity stays constant.

The deeper problem is that reviewers don't know **what to focus on**. A 200-line diff might have 180 lines of safe mechanical changes and 20 lines that subtly break a coupled module — but the reviewer has no way to know which 20 lines matter without deep codebase knowledge.

Current AI code review tools (GitHub Copilot, CodeRabbit, etc.) analyze the diff in isolation. They don't know that the modified file is tightly coupled to 5 other files that weren't changed — and *should* have been.

LFCA has exactly the data needed to make code review **coupling-aware**: it knows which files historically change together, which files have strong dependency links, and which files are at the center of the coupling graph.

## Idea

Build a **Coupling-Aware Code Review Assistant** that enhances PR review by:

1. **Coupling check**: For each modified file, check if tightly coupled files were also modified. Flag missing co-changes.
2. **Risk scoring**: Score each file in the diff by coupling density, change frequency, and number of dependents.
3. **Review focus**: Rank diff sections by risk so reviewers look at the dangerous parts first.
4. **Structured criteria**: Apply project-specific review rules (from a configurable checklist), not generic advice.
5. **Constrained suggestions**: Limit AI-generated suggestions to what was explicitly asked — no unsolicited refactoring.

## Expected Added Value

| Dimension | Impact |
|---|---|
| **Review speed** | Reviewers focus on high-risk sections first — skip safe mechanical changes. |
| **Coupling awareness** | Catches "missing co-changes" that no other review tool detects. |
| **Consistency** | Structured criteria ensure every PR is reviewed against the same checklist. |
| **Reduced noise** | Constrained suggestions eliminate the "AI suggested 47 style changes" problem. |
| **Knowledge transfer** | Junior reviewers get coupling context that normally lives only in senior heads. |

## Pseudo Front Screens

### Screen 1 — PR Review Dashboard
```
┌────────────────────────────────────────────────────────────────┐
│  🔍 PR #347 Review — "Refactor agent initialization"           │
│  Author: @dev1  Branch: refactor/agent-init  Files: 12         │
│                                                                │
│  ── Coupling Alerts ──                                         │
│  ⚠️  manager.py was modified but its coupled partner            │
│     registry.py (coupling: 0.84) was NOT modified.             │
│     Last 50 changes to manager.py: 42 also touched registry.py │
│     → Consider reviewing registry.py for needed updates.       │
│                                                                │
│  ── Risk Map ──                                                │
│  File                        Risk    Reason                    │
│  ─────────────────────────   ─────   ────────────────────────  │
│  🔴 src/agent/manager.py     High    12 dependents, 0.84 coup  │
│  🔴 src/core/config.py       High    8 dependents, high churn  │
│  🟡 src/agent/codeact.py     Medium  5 dependents              │
│  🟢 src/agent/prompts/x.py   Low     1 dependent, leaf node    │
│  🟢 tests/test_agent.py      Low     test file, no dependents  │
│  ...                                                           │
│                                                                │
│  [Review high-risk first]  [Show all files]  [View coupling]   │
└────────────────────────────────────────────────────────────────┘
```

### Screen 2 — File Review with Coupling Context
```
┌────────────────────────────────────────────────────────────────┐
│  🔍 src/agent/manager.py — Risk: 🔴 High                       │
│                                                                │
│  ── Coupling Context ──                                        │
│  This file is coupled to:                                      │
│    registry.py (0.84) ⚠️ NOT in this PR                        │
│    codeact_agent.py (0.71) ✅ modified in this PR               │
│    __init__.py (0.65) ✅ modified in this PR                    │
│                                                                │
│  ── Diff (showing high-risk sections first) ──                 │
│                                                                │
│  L42-58  🔴 High risk — modifies register() used by 8 files    │
│  ┌─────────────────────────────────────────────────┐           │
│  │ - def register(self, agent_cls):                │           │
│  │ + def register(self, agent_cls, priority=0):    │           │
│  │ +     self._agents[agent_cls.name] = (agent_cls,│           │
│  │ +                                    priority)  │           │
│  └─────────────────────────────────────────────────┘           │
│  💬 AI note: Signature change affects all callers of           │
│     register(). Check: browsing_agent.py, micro_agent.py.      │
│                                                                │
│  L112-115  🟢 Low risk — internal logging change               │
│  ┌─────────────────────────────────────────────────┐           │
│  │ - logger.info("Agent loaded")                   │           │
│  │ + logger.info(f"Agent {name} loaded")           │           │
│  └─────────────────────────────────────────────────┘           │
│                                                                │
│  [Approve file]  [Request changes]  [Next high-risk file →]    │
└────────────────────────────────────────────────────────────────┘
```

### Screen 3 — Review Checklist
```
┌─────────────────────────────────────────────────────────────┐
│  📋 Review Checklist for PR #347                             │
│                                                             │
│  Project rules (from .lfca/review-rules.yaml):              │
│                                                             │
│  ✅ No TODO/FIXME comments introduced                        │
│  ✅ All new functions have docstrings                         │
│  ⚠️  Missing type hints on 2 new functions                   │
│     → src/agent/manager.py:42 register()                    │
│     → src/agent/manager.py:78 unregister()                  │
│  ✅ No deprecated API usage                                  │
│  ✅ Test coverage: 3 new test cases added                    │
│  ⚠️  Coupled file not updated (registry.py)                  │
│                                                             │
│  Overall: 4/6 pass — 2 warnings                             │
│                                                             │
│  [Auto-fix warnings]  [Approve with warnings]               │
└─────────────────────────────────────────────────────────────┘
```

## Pseudo High Level Flow

```
1. PR is created or updated
2. Review assistant is triggered:
       │
       ├── Webhook (GitHub/GitLab)
       ├── Manual trigger from UI
       └── CI pipeline step
       │
3. Fetch PR data:
       │
       ├── Changed files list
       ├── Diff content
       └── PR metadata (author, branch, description)
       │
4. Coupling analysis:
       │
       For each changed file:
         a. Query LFCA coupling edges (top-k partners)
         b. Check if coupled files are also in the PR
         c. If missing → flag as coupling alert
         d. Compute risk score:
              score = dependents_count * w1
                    + coupling_density * w2
                    + change_frequency * w3
       │
5. Structured review:
       │
       ├── Load project review rules (.lfca/review-rules.yaml)
       ├── Run static checks (type hints, docstrings, deprecated APIs)
       ├── Run LLM review only on high-risk sections
       └── Generate checklist with pass/fail per rule
       │
6. Present results:
       │
       ├── Coupling alerts (missing co-changes)
       ├── Risk-ranked file list
       ├── Per-file diff with high-risk sections highlighted
       ├── Review checklist with pass/fail
       └── Optional: post as PR comment
       │
7. Reviewer acts on results:
       │
       ├── Focus review on high-risk files
       ├── Request changes for coupling alerts
       └── Auto-fix minor issues (if configured)
```

## High Level Design

```
┌──────────────────────────────────────────────────────────────┐
│                       Frontend (React)                        │
│                                                              │
│  PRDashboard ──► FileReview ──► ReviewChecklist              │
│       │               │               │                       │
│  (risk map)    (diff + coupling)  (rules + pass/fail)         │
└──────────┬────────────┬───────────────┬──────────────────────┘
           │  REST API   │              │
┌──────────▼────────────▼───────────────▼──────────────────────┐
│                     Backend (FastAPI)                          │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │  Coupling       │  │  Risk Scorer   │  │  Review        │  │
│  │  Checker        │  │                │  │  Engine        │  │
│  │                 │  │ - Dependent    │  │                │  │
│  │ - Query edges   │  │   count        │  │ - Rule loader  │  │
│  │ - Find missing  │  │ - Coupling     │  │ - Static       │  │
│  │   co-changes    │  │   density      │  │   checks       │  │
│  │ - Generate      │  │ - Change       │  │ - LLM review   │  │
│  │   alerts        │  │   frequency    │  │ - Checklist    │  │
│  └───────┬─────────┘  └───────┬────────┘  └───────┬────────┘  │
│          │                    │                    │           │
│  ┌───────▼────────────────────▼────────────────────▼────────┐  │
│  │                 LFCA Data Layer                            │  │
│  │  coupling edges + dependency graph + change history       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  GitHub / GitLab Integration                              │  │
│  │  - Webhook receiver  - PR API  - Comment poster           │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Responsibility |
|---|---|
| **Coupling Checker** | Queries LFCA edges for each changed file, flags missing coupled files. |
| **Risk Scorer** | Computes per-file risk score from dependents, coupling density, and churn. |
| **Review Engine** | Loads project review rules, runs static + LLM checks, generates checklist. |
| **GitHub/GitLab Integration** | Receives webhooks, fetches PR data, posts review comments. |
| **LFCA Data Layer** | Coupling edges, dependency graph, change history. Already exists. |
