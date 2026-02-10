# Multi-Agent Orchestration for Code Tasks

## Pain / Problem

A single AI coding agent hits a hard wall with large codebases: **context window limits**. The speech states it clearly: *"Nearly 400 Python files, approximately 60,000 lines of code — this is far too large for a single agent to process within one context window."*

But naively spawning multiple agents creates new problems:
- Agents modify the same files → **merge conflicts**.
- Agents make contradictory assumptions → **inconsistent changes**.
- Agents duplicate work → **wasted compute and cost**.
- No visibility into what each agent is doing → **chaos**.

Teams attempting multi-agent workflows today do it manually: splitting work by hand, running agents in separate terminals, and praying nothing conflicts. There's no orchestration layer that understands code structure.

## Idea

Build a **Multi-Agent Orchestrator** integrated into LFCA that leverages the dependency and coupling graphs to **assign, isolate, coordinate, and monitor** multiple AI agents working on the same codebase simultaneously.

The orchestrator:
1. **Partitions** the work using LFCA batches (no two agents touch the same file).
2. **Isolates** each agent in its own git worktree (no interference).
3. **Sequences** dependent batches (agent B starts only after agent A's batch is verified).
4. **Shares context** between agents (configurable: shared learning file, curated notes, or message passing).
5. **Monitors** all agents in a unified dashboard with real-time status.

## Expected Added Value

| Dimension | Impact |
|---|---|
| **Throughput** | N agents = roughly N× speed on independent batches. |
| **Safety** | Dependency-aware partitioning prevents merge conflicts by design. |
| **Visibility** | Single dashboard shows all agent activity, progress, and issues. |
| **Cost efficiency** | Smaller, focused tasks have higher one-shot success rates → fewer retries. |
| **Scalability** | Works for 10-file repos and 1000-file repos — batch count scales, not complexity. |

## Pseudo Front Screens

### Screen 1 — Orchestrator Setup
```
┌─────────────────────────────────────────────────────────────┐
│  🤖 Multi-Agent Orchestration                                │
│                                                             │
│  Repository:  [openhands ▼]                                 │
│  Task:        [Remove TODO/FIXME comments ▼]                │
│  Batches:     8 (from dependency-first strategy)            │
│                                                             │
│  ── Agent Configuration ──                                  │
│  Agent type:     [OpenHands CodeAct ▼]                      │
│  Max concurrent: [3]                                        │
│  Timeout/batch:  [10 min]                                   │
│                                                             │
│  ── Context Sharing ──                                      │
│  Strategy: [○ None  ● Shared learning file  ○ Message bus]  │
│  Learning file: [.openhands/agents.md]                      │
│                                                             │
│  ── Isolation ──                                            │
│  Method: [● Git worktree  ○ Docker container  ○ Branch]     │
│                                                             │
│  [Launch Orchestration]                                     │
└─────────────────────────────────────────────────────────────┘
```

### Screen 2 — Live Dashboard
```
┌───────────────────────────────────────────────────────────────────┐
│  🤖 Orchestration Dashboard — 3 agents active                     │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  [Dependency Graph]                                         │  │
│  │                                                             │  │
│  │   🟢B1(done) ──── 🔵B3(agent-2) ──── ⚪B6(queued)          │  │
│  │   🔵B2(agent-1) ── ⚪B5(queued)  ──── ⚪B8(queued)         │  │
│  │   🟢B4(done) ──────────────────────────┘                   │  │
│  │                    🔵B7(agent-3)                             │  │
│  │                                                             │  │
│  │  🟢 Done  🔵 Active  ⚪ Queued  🔴 Failed                   │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Agent     Batch   Progress        Status         Time            │
│  ───────   ─────   ──────────────  ────────────   ────            │
│  agent-1   B2      14/18 files     Fixing...      4m 12s          │
│  agent-2   B3      ✅ Verifying    Almost done    6m 30s          │
│  agent-3   B7      8/11 files      Fixing...      3m 45s          │
│                                                                   │
│  Completed: 2/8 batches | PRs: #341, #344                        │
│  Queue: B5 (waiting B2), B6 (waiting B3), B8 (waiting B5,B6)     │
│                                                                   │
│  [View agent-1 log]  [Pause all]  [Add agent]                    │
└───────────────────────────────────────────────────────────────────┘
```

### Screen 3 — Agent Detail / Context Sharing
```
┌─────────────────────────────────────────────────────────┐
│  🤖 Agent-2 — Batch 3                                    │
│                                                         │
│  Status: Verifying (re-check after fix)                 │
│  Worktree: /tmp/oh-worktree-b3/                         │
│  Branch: fix/batch-3-todos                              │
│                                                         │
│  ── Shared Learning ──                                  │
│  Discoveries from other agents:                         │
│    • agent-1: "Some TODOs reference issue tracker —     │
│      convert to `# See: #123` instead of removing"      │
│    • agent-3: "Files in runtime/ use # type: ignore —   │
│      don't remove those, they're intentional"           │
│                                                         │
│  ── Agent Output (last 10 lines) ──                     │
│  > Scanning 22 files for TODO/FIXME patterns...         │
│  > Found 0 remaining issues.                            │
│  > Verification: PASS ✅                                 │
│  > Creating pull request...                             │
│                                                         │
│  [View full log]  [Send message to agent]  [Kill agent] │
└─────────────────────────────────────────────────────────┘
```

## Pseudo High Level Flow

```
1. User configures orchestration (task, batches, agent settings)
2. Orchestrator initializes:
       │
       ├── Load batch definitions from LFCA
       ├── Compute execution order (topological sort)
       └── Identify initial parallel set (batches with no deps)
       │
3. For each batch in the initial parallel set (up to max concurrent):
       │
       a. Create isolated environment:
            ├── Git worktree on fresh branch
            └── Copy shared context file (if configured)
       │
       b. Spawn agent with:
            ├── Task prompt + batch-specific file list
            ├── Shared learning context
            └── Verification command
       │
       c. Monitor agent:
            ├── Stream stdout to dashboard
            ├── Track file modification progress
            └── Detect completion or failure
       │
4. On agent completion:
       │
       ├── If SUCCESS:
       │     a. Run verification on modified files
       │     b. If green → create PR, mark batch done
       │     c. Update shared learning file
       │     d. Unlock dependent batches → schedule next agents
       │
       ├── If FAILURE:
       │     a. Log failure reason
       │     b. Retry once with adjusted prompt
       │     c. If still fails → mark batch as needs-human-review
       │
5. Continue until all batches complete or human intervenes
6. Final report: PRs created, success rate, time per batch
```

## High Level Design

```
┌──────────────────────────────────────────────────────────────┐
│                       Frontend (React)                        │
│                                                              │
│  OrchestratorSetup ──► LiveDashboard ──► AgentDetail         │
│       │                     │                 │               │
│  (config)           (graph + agents)    (log + context)       │
└──────────┬──────────────────┬─────────────────┬──────────────┘
           │  REST / WebSocket │                │
┌──────────▼──────────────────▼─────────────────▼──────────────┐
│                     Backend (FastAPI)                          │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │  Orchestrator   │  │  Agent Manager │  │  Context       │  │
│  │  Core           │  │                │  │  Broker        │  │
│  │                 │  │ - Spawn agent  │  │                │  │
│  │ - Topo schedule │  │ - Git worktree │  │ - Shared file  │  │
│  │ - Parallelism   │  │ - Monitor      │  │ - Curated      │  │
│  │ - Retry logic   │  │ - Kill/restart │  │   notes        │  │
│  │ - Progress      │  │ - Collect      │  │ - Message      │  │
│  │   tracking      │  │   output       │  │   passing      │  │
│  └───────┬─────────┘  └───────┬────────┘  └───────┬────────┘  │
│          │                    │                    │           │
│  ┌───────▼────────────────────▼────────────────────▼────────┐  │
│  │                 LFCA Data Layer                            │  │
│  │  batch definitions + dependency order + file identity     │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Responsibility |
|---|---|
| **Orchestrator Core** | Schedules batches in topological order, manages parallelism, handles retries and completion. |
| **Agent Manager** | Creates git worktrees, spawns agents, monitors output, collects results. |
| **Context Broker** | Manages context sharing between agents (shared file, curated notes, or message bus). |
| **LFCA Data Layer** | Provides batch definitions, dependency ordering, file identity. Already exists. |
