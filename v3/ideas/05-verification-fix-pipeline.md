# Verification-Fix Pipeline

## Pain / Problem

Large-scale code modifications today follow a **fire-and-forget** pattern: a developer (or AI agent) applies changes across many files, runs the full test suite, and hopes everything passes. When it doesn't, the developer has to manually triage which changes caused which failures — an exhausting, error-prone process.

The speech introduces a much better pattern: **separate verification from fixing**. First, scan each batch of files to determine *whether* a change is needed. Then, apply fixes *only where needed*. This avoids unnecessary modifications (which introduce risk) and focuses effort on the files that actually need work.

LFCA can see the entire codebase structure but currently has no concept of "verification" or "fix" stages. Adding this two-stage pipeline would turn it from a passive analysis tool into an **active migration orchestrator**.

## Idea

Build a **Verification-Fix Pipeline** as a first-class feature of LFCA. Users define a **verification rule** (e.g., "no `TODO` comments", "all functions have type hints", "no deprecated API usage") and a **fix strategy** (e.g., "remove TODOs", "add type hints with AI", "replace deprecated calls").

The pipeline runs in two stages:
1. **Verify**: scan each batch and mark it green (compliant) or red (needs fixing).
2. **Fix**: for red batches, apply the fix strategy, then re-verify.

The key principle from the speech: *"Don't use an LLM when a static tool will do the job better."* The pipeline supports **hybrid verification** — static tools (grep, mypy, eslint) for deterministic checks, and LLMs for fuzzy/subjective evaluations.

## Expected Added Value

| Dimension | Impact |
|---|---|
| **Efficiency** | Only touch files that actually need changes — skip compliant files entirely. |
| **Safety** | Unchanged files have zero risk of regression. |
| **Visibility** | The green/red map gives instant progress visibility across the codebase. |
| **Cost control** | LLM calls are expensive — verification-first reduces fix invocations by 40-70%. |
| **Iterative** | Re-run verification after fixing to confirm compliance — iterates until green. |

## Pseudo Front Screens

### Screen 1 — Pipeline Configuration
```
┌─────────────────────────────────────────────────────────┐
│  ✅ Verification-Fix Pipeline                            │
│                                                         │
│  Repository: [openhands ▼]                              │
│  Batching:   [Use existing batches ▼] (8 batches)       │
│                                                         │
│  ── Verification Rule ──                                │
│  Type: [● Static  ○ LLM  ○ Hybrid]                     │
│  Tool: [grep ▼]                                         │
│  Pattern: [TODO|FIXME|HACK]                             │
│  Expected: [No matches in any file]                     │
│                                                         │
│  ── Fix Strategy ──                                     │
│  Mode: [● LLM agent  ○ Script  ○ Manual]               │
│  Prompt: [Remove all TODO/FIXME/HACK comments.          │
│           If the comment describes needed work, convert  │
│           it to a GitHub issue reference instead.]       │
│                                                         │
│  ── Execution ──                                        │
│  Order: [Dependency-first ▼]                            │
│  Parallelism: [3] concurrent batches                    │
│                                                         │
│  [Run Verification Only]  [Run Full Pipeline]           │
└─────────────────────────────────────────────────────────┘
```

### Screen 2 — Verification Map
```
┌───────────────────────────────────────────────────────────────┐
│  ✅ Verification Results — 5 green, 3 red                     │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  [Dependency Graph — nodes colored green/red]            │  │
│  │                                                         │  │
│  │     🟢 B1 ──── 🟢 B3 ──── 🔴 B6                        │  │
│  │     🟢 B2 ──── 🔴 B5 ──── 🔴 B8                        │  │
│  │     🟢 B4 ─────────────────┘                            │  │
│  │                🟢 B7                                     │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  Batch   Status   Files  Issues   Action                      │
│  ─────   ──────   ─────  ──────   ──────                      │
│  B1      🟢 Pass  12     0        —                           │
│  B2      🟢 Pass  18     0        —                           │
│  B3      🟢 Pass  22     0        —                           │
│  B5      🔴 Fail  9      4 TODOs  [Fix] [View details]       │
│  B6      🔴 Fail  15     7 TODOs  [Fix] [View details]       │
│  B8      🔴 Fail  8      2 TODOs  [Fix] [View details]       │
│  ...                                                          │
│                                                               │
│  [Fix All Red Batches]  [Re-verify All]  [Export Report]      │
└───────────────────────────────────────────────────────────────┘
```

### Screen 3 — Fix Progress
```
┌───────────────────────────────────────────────────────────────┐
│  🔧 Fixing Red Batches — 1/3 complete                         │
│                                                               │
│  B5  🟢 Fixed → Re-verified → PASS   PR #351                 │
│  B6  🔄 Fixing... agent running (3/7 issues resolved)         │
│  B8  ⏳ Queued (depends on B5)                                │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  B6 Fix Log:                                            │  │
│  │  ✅ Removed TODO in src/agent/manager.py:42              │  │
│  │  ✅ Converted FIXME to issue #892 in runtime/sandbox.py  │  │
│  │  ✅ Removed HACK in core/state.py:118                    │  │
│  │  🔄 Processing src/agent/codeact_agent.py:201...         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  [Pause]  [Skip B8]  [View PR #351]                           │
└───────────────────────────────────────────────────────────────┘
```

## Pseudo High Level Flow

```
1. User configures pipeline:
       │
       ├── Select repository and batches
       ├── Define verification rule (static tool, LLM prompt, or hybrid)
       └── Define fix strategy (LLM agent, script, or manual)
       │
2. VERIFICATION STAGE:
       │
       For each batch (in dependency order):
         a. Collect files in the batch
         b. Run verification:
              │
              ├── Static: execute tool (grep, mypy, eslint) → parse output
              ├── LLM: send files + prompt → parse verdict (pass/fail + issues)
              └── Hybrid: run static first, then LLM for remaining checks
              │
         c. Mark batch as green (pass) or red (fail + issue list)
       │
3. Present verification map (green/red graph)
4. User reviews and optionally adjusts scope
       │
5. FIX STAGE (for red batches only):
       │
       For each red batch (in dependency order, with parallelism limit):
         a. Create git worktree / branch
         b. Apply fix strategy:
              │
              ├── LLM agent: spawn agent with files + issues + fix prompt
              ├── Script: run transformation script
              └── Manual: assign to developer
              │
         c. Re-verify the batch
         d. If green → open PR
         e. If still red → retry or flag for human review
       │
6. Iterate until all batches are green
7. Dashboard shows overall progress and PR links
```

## High Level Design

```
┌──────────────────────────────────────────────────────────────┐
│                       Frontend (React)                        │
│                                                              │
│  PipelineConfig ──► VerificationMap ──► FixProgress          │
│       │                   │                   │               │
│  (rules + strategy)  (green/red graph)   (fix log + PRs)     │
└──────────┬────────────────┬───────────────────┬──────────────┘
           │  REST / WS     │                   │
┌──────────▼────────────────▼───────────────────▼──────────────┐
│                     Backend (FastAPI)                          │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │  Verification   │  │    Fix         │  │  Pipeline      │  │
│  │  Engine         │  │    Engine      │  │  Orchestrator  │  │
│  │                 │  │                │  │                │  │
│  │ - Static runner │  │ - LLM agent   │  │ - Stage mgmt   │  │
│  │   (grep, mypy,  │  │   spawner     │  │ - Batch order  │  │
│  │   eslint)       │  │ - Script      │  │ - Parallelism  │  │
│  │ - LLM verifier  │  │   executor    │  │ - Retry logic  │  │
│  │ - Hybrid router │  │ - Git worktree│  │ - Progress     │  │
│  │ - Result parser │  │ - PR creator  │  │   tracking     │  │
│  └───────┬─────────┘  └───────┬────────┘  └───────┬────────┘  │
│          │                    │                    │           │
│  ┌───────▼────────────────────▼────────────────────▼────────┐  │
│  │                 LFCA Data Layer                            │  │
│  │  batch definitions + coupling edges + file identity       │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Responsibility |
|---|---|
| **Verification Engine** | Runs static tools or LLM prompts against file batches, parses results into pass/fail + issue list. |
| **Fix Engine** | Spawns LLM agents or scripts to apply fixes, manages git worktrees, creates PRs. |
| **Pipeline Orchestrator** | Coordinates verify → fix → re-verify cycle, manages batch ordering and parallelism. |
| **LFCA Data Layer** | Provides batch definitions, coupling edges, file identity. Already exists. |
