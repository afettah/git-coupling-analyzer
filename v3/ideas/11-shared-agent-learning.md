# Shared Learning Across Agents

## Pain / Problem

When multiple AI agents work on a codebase, each agent starts from scratch. Agent A discovers that "files in `runtime/` use `# type: ignore` comments intentionally — don't remove them." Agent B, working on a different batch, doesn't know this and removes them all, breaking the type-checking workflow.

The speech outlines four context-sharing strategies, each with tradeoffs:
1. **Full context sharing** — bloats context windows, slows agents.
2. **Human-curated notes** — high quality but requires human effort.
3. **Shared learning file** — agents update a shared file, but in-progress agents won't see updates.
4. **Direct message passing** — dynamic but complex and risky.

None of these are implemented in LFCA today. The project coordinates batches but has no mechanism for agents to learn from each other.

## Idea

Build a **Shared Learning System** that combines the best of strategies 2, 3, and 4:

1. **Learning Store**: A structured knowledge base (not a flat file) where agents record discoveries, gotchas, and patterns.
2. **Auto-classification**: Each learning entry is tagged by scope (file, folder, module, global) and type (constraint, pattern, gotcha, tip).
3. **Context injection**: When an agent starts a new batch, relevant learnings are automatically injected into its prompt — filtered by the files it will touch.
4. **Human curation**: Humans can review, edit, and approve/reject learnings in a PR-like interface.
5. **Coupling-aware relevance**: Use LFCA coupling edges to determine which learnings are relevant to which files.

## Expected Added Value

| Dimension | Impact |
|---|---|
| **Knowledge retention** | Discoveries aren't lost when an agent session ends. |
| **Error prevention** | Agent B avoids Agent A's mistakes without human mediation. |
| **Targeted context** | Only relevant learnings are injected — no context bloat. |
| **Quality control** | Human curation layer filters out noise and incorrect learnings. |
| **Coupling-aware** | Learnings about file A are surfaced when working on file B (if coupled). |

## Pseudo Front Screens

### Screen 1 — Learning Store Dashboard
```
┌────────────────────────────────────────────────────────────────┐
│  🧠 Shared Learning Store — openhands                          │
│                                                                │
│  Entries: 23 total | 18 approved | 3 pending | 2 rejected     │
│                                                                │
│  ── Recent Learnings ──                                        │
│                                                                │
│  🟢 APPROVED | Scope: runtime/*  | Type: Constraint            │
│  "Files in runtime/ use `# type: ignore` intentionally.        │
│   Do NOT remove these comments."                               │
│  Source: agent-1, Batch 2  |  Approved by: @dev1               │
│                                                                │
│  🟢 APPROVED | Scope: global  | Type: Pattern                  │
│  "TODO comments referencing issue numbers (#NNN) should be     │
│   converted to `# See: github.com/org/repo/issues/NNN`        │
│   rather than deleted."                                        │
│  Source: agent-3, Batch 7  |  Approved by: @dev2               │
│                                                                │
│  🟡 PENDING | Scope: agent/prompts/*  | Type: Gotcha           │
│  "Prompt files use triple-quoted strings that look like        │
│   comments but are actually template content."                 │
│  Source: agent-2, Batch 3  |  Awaiting review                  │
│                                                                │
│  [Review pending]  [Add learning manually]  [Export]           │
└────────────────────────────────────────────────────────────────┘
```

### Screen 2 — Context Injection Preview
```
┌────────────────────────────────────────────────────────────────┐
│  🧠 Context for Batch 5 — 9 files in src/agent/                │
│                                                                │
│  Learnings that will be injected (4):                          │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Directly relevant (scope match):                         │  │
│  │   1. "TODO → issue reference conversion" (global)        │  │
│  │   2. "Prompt triple-quotes are content" (agent/prompts)  │  │
│  │                                                          │  │
│  │ Coupled-file relevant (LFCA coupling):                   │  │
│  │   3. "type: ignore in runtime/" — coupling score 0.72    │  │
│  │      (agent/manager.py ↔ runtime/sandbox.py)             │  │
│  │   4. "Config defaults changed" — coupling score 0.65     │  │
│  │      (agent/codeact.py ↔ core/config.py)                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  Context tokens: ~450 (well within budget)                     │
│                                                                │
│  [Edit context]  [Remove irrelevant]  [Proceed to agent]       │
└────────────────────────────────────────────────────────────────┘
```

### Screen 3 — Learning Review (Human Curation)
```
┌─────────────────────────────────────────────────────────────┐
│  🧠 Review Learning — agent-2, Batch 3                       │
│                                                             │
│  Original entry:                                            │
│  "Prompt files use triple-quoted strings that look like     │
│   comments but are actually template content. Don't strip   │
│   or modify them."                                          │
│                                                             │
│  Scope: agent/prompts/*                                     │
│  Type: Gotcha                                               │
│  Evidence: agent-2 initially removed a triple-quote block   │
│  and verification failed (template became empty).           │
│                                                             │
│  ── Edit ──                                                 │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Prompt files (agent/prompts/*.py) contain triple-  │     │
│  │ quoted strings that are template content, not       │     │
│  │ comments. Never modify or remove them.              │     │
│  └────────────────────────────────────────────────────┘     │
│                                                             │
│  [Approve]  [Reject]  [Request more detail]                 │
└─────────────────────────────────────────────────────────────┘
```

## Pseudo High Level Flow

```
1. Agent records a learning during execution:
       │
       ├── Agent encounters an issue or discovers a pattern
       ├── Agent writes structured entry: { scope, type, text, evidence }
       └── Entry is saved to Learning Store with status "pending"
       │
2. Learning Store processes entry:
       │
       ├── Auto-tag with file scope (from agent's batch files)
       ├── Auto-classify type (constraint, pattern, gotcha, tip)
       └── Queue for human review
       │
3. Human reviews (optional, but recommended):
       │
       ├── Approve → learning becomes active
       ├── Edit → refine wording/scope, then approve
       └── Reject → learning is archived
       │
4. When a new agent starts a batch:
       │
       a. Collect batch's file list
       b. Query Learning Store:
            ├── Direct scope match (learning scope ⊆ batch files)
            └── Coupling relevance (learning scope coupled to batch files via LFCA)
       │
       c. Rank by relevance and recency
       d. Inject top-N learnings into agent prompt
       │
5. Agent works with injected context
6. If agent records new learnings → cycle repeats
```

## High Level Design

```
┌──────────────────────────────────────────────────────────────┐
│                       Frontend (React)                        │
│                                                              │
│  LearningDashboard ──► ReviewPanel ──► InjectionPreview      │
│       │                     │                 │               │
│  (all entries)        (approve/reject)   (per-batch context)  │
└──────────┬──────────────────┬─────────────────┬──────────────┘
           │  REST API         │                │
┌──────────▼──────────────────▼─────────────────▼──────────────┐
│                     Backend (FastAPI)                          │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │  Learning       │  │  Relevance     │  │  Injection     │  │
│  │  Store          │  │  Engine        │  │  Service       │  │
│  │                 │  │                │  │                │  │
│  │ - CRUD entries  │  │ - Scope match  │  │ - Build prompt │  │
│  │ - Auto-classify │  │ - Coupling     │  │   context      │  │
│  │ - Status mgmt   │  │   relevance    │  │ - Token budget │  │
│  │ - History       │  │ - Recency rank │  │ - Format       │  │
│  └───────┬─────────┘  └───────┬────────┘  └───────┬────────┘  │
│          │                    │                    │           │
│  ┌───────▼────────────────────▼────────────────────▼────────┐  │
│  │                 LFCA Data Layer                            │  │
│  │  coupling edges (for relevance) + file identity           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  SQLite / JSON Store                                      │  │
│  │  learnings table: id, scope, type, text, status, source   │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Responsibility |
|---|---|
| **Learning Store** | Persists learnings with metadata (scope, type, status, source agent). |
| **Relevance Engine** | Determines which learnings are relevant to a batch using scope matching and LFCA coupling edges. |
| **Injection Service** | Builds the context block injected into agent prompts, respecting token budgets. |
| **LFCA Data Layer** | Coupling edges for coupling-aware relevance. Already exists. |
