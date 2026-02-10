# Codebase Health Dashboard

## Pain / Problem

Engineering teams have no single place to answer the question: **"How healthy is our codebase right now?"** They check test coverage in one tool, code complexity in another, dependency freshness in a third, and coupling data in LFCA. None of these tools talk to each other, and none trend over time.

The speech implicitly identifies several health signals:
- **Coupling hotspots**: files with too many coupling edges are architectural risks.
- **Change frequency**: files that change constantly may need refactoring.
- **Dependency depth**: deep dependency chains make changes risky.
- **Code review bottlenecks**: PRs waiting too long for review signal process problems.

LFCA already computes coupling, dependency, and change data. The missing piece is a **unified dashboard** that aggregates these signals into an actionable health score with trends.

## Idea

Build a **Codebase Health Dashboard** that aggregates signals from LFCA's analyzers and external tools into a single view with:

1. **Health score**: A composite metric (0-100) based on coupling density, churn rate, dependency depth, and test coverage.
2. **Hotspot map**: Visual heatmap of files ranked by "risk" (high coupling + high churn + low coverage).
3. **Trend charts**: Track health metrics over time (per sprint, per month).
4. **Alerts**: Automatic alerts when a metric crosses a threshold (e.g., coupling density spike after a merge).
5. **Drill-down**: Click any metric to see the contributing files and recommended actions.

## Expected Added Value

| Dimension | Impact |
|---|---|
| **Visibility** | One place to see codebase health — no more jumping between tools. |
| **Proactive** | Catch architectural drift before it becomes an emergency. |
| **Trending** | See if the codebase is getting healthier or sicker over time. |
| **Actionable** | Every metric links to specific files and recommended actions. |
| **Team accountability** | Shared dashboard makes code health a team-wide concern. |

## Pseudo Front Screens

### Screen 1 — Health Overview
```
┌────────────────────────────────────────────────────────────────┐
│  📊 Codebase Health — openhands                                │
│                                                                │
│  Overall Score: 72 / 100  (↑3 from last month)                │
│                                                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Coupling  │  │  Churn   │  │  Depth   │  │ Coverage │      │
│  │  Density  │  │  Rate    │  │  Max     │  │  (est.)  │      │
│  │           │  │          │  │          │  │          │      │
│  │   🟡 65   │  │  🟢 78   │  │  🟡 61   │  │  🔴 54   │      │
│  │  (↓2)     │  │  (↑5)    │  │  (→0)    │  │  (↑1)    │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│                                                                │
│  ── Trend (last 6 months) ──                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  80 ┤                                                    │  │
│  │  70 ┤      ●────●────●────●                              │  │
│  │  60 ┤ ●───●                                              │  │
│  │  50 ┤                                                    │  │
│  │     └──Sep──Oct──Nov──Dec──Jan──Feb──                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ⚠️  Alerts:                                                   │
│  • Coupling density increased 12% in src/agent/ this sprint    │
│  • 3 files exceed churn threshold (>20 changes/month)          │
│                                                                │
│  [View Hotspots]  [Configure Thresholds]  [Export Report]      │
└────────────────────────────────────────────────────────────────┘
```

### Screen 2 — Hotspot Map
```
┌────────────────────────────────────────────────────────────────┐
│  🔥 Hotspot Map — Top risk files                                │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  [Treemap visualization]                                 │  │
│  │  Size = file size  |  Color = risk score                 │  │
│  │                                                          │  │
│  │  ┌────────────────────┐  ┌───────────┐  ┌────────┐      │  │
│  │  │   🔴 manager.py     │  │ 🟡 config │  │🟢 utils│      │  │
│  │  │   risk: 89          │  │ risk: 62  │  │risk:28 │      │  │
│  │  │   coup:0.84 churn:45│  │           │  │        │      │  │
│  │  └────────────────────┘  └───────────┘  └────────┘      │  │
│  │  ┌───────────────┐  ┌────────────┐                       │  │
│  │  │ 🔴 codeact.py  │  │ 🟡 sandbox │                       │  │
│  │  │ risk: 82       │  │ risk: 58   │                       │  │
│  │  └───────────────┘  └────────────┘                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  Risk = 0.4*coupling + 0.3*churn + 0.2*depth + 0.1*complexity │
│                                                                │
│  File                  Coupling  Churn  Depth  Risk             │
│  ────────────────────  ────────  ─────  ─────  ────             │
│  agent/manager.py      0.84      45     4      89               │
│  agent/codeact.py      0.71      38     3      82               │
│  core/config.py        0.65      22     2      62               │
│                                                                │
│  [Plan refactoring for top hotspots]                           │
└────────────────────────────────────────────────────────────────┘
```

## Pseudo High Level Flow

```
1. User opens Health Dashboard for a repository
2. Backend computes health metrics:
       │
       ├── Coupling density: avg coupling edges per file (from LFCA)
       ├── Churn rate: avg changes per file per month (from git log)
       ├── Dependency depth: max import chain length (from dep graph)
       ├── Coverage estimate: heuristic from test file ratio
       └── Composite score: weighted average of sub-scores
       │
3. Compute trends:
       │
       ├── Run metrics at each historical snapshot (monthly)
       └── Store in time-series format
       │
4. Identify hotspots:
       │
       ├── Per-file risk = weighted(coupling, churn, depth, complexity)
       ├── Rank files by risk score
       └── Group into severity buckets (red/yellow/green)
       │
5. Check alert thresholds:
       │
       ├── Metric crossed threshold? → generate alert
       └── Metric trending badly? → generate warning
       │
6. Render dashboard:
       │
       ├── Score cards with sub-metrics and arrows
       ├── Trend charts (D3 line chart)
       ├── Hotspot treemap (D3 treemap)
       ├── Alert list
       └── Drill-down links
```

## High Level Design

```
┌──────────────────────────────────────────────────────────────┐
│                       Frontend (React)                        │
│                                                              │
│  HealthOverview ──► HotspotMap ──► MetricDrillDown           │
│       │                 │                │                     │
│  (scores + trends)  (treemap)      (files + actions)          │
└──────────┬──────────────┬────────────────┬───────────────────┘
           │  REST API     │               │
┌──────────▼──────────────▼────────────────▼───────────────────┐
│                     Backend (FastAPI)                          │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │  Metric         │  │  Hotspot       │  │  Alert         │  │
│  │  Calculator     │  │  Ranker        │  │  Engine        │  │
│  │                 │  │                │  │                │  │
│  │ - Coupling dens │  │ - Per-file     │  │ - Threshold    │  │
│  │ - Churn rate    │  │   risk score   │  │   checks       │  │
│  │ - Dep depth     │  │ - Severity     │  │ - Trend detect │  │
│  │ - Coverage est  │  │   bucketing    │  │ - Notification │  │
│  │ - Composite     │  │ - Treemap data │  │                │  │
│  └───────┬─────────┘  └───────┬────────┘  └───────┬────────┘  │
│          │                    │                    │           │
│  ┌───────▼────────────────────▼────────────────────▼────────┐  │
│  │                 LFCA Data Layer                            │  │
│  │  coupling edges + file_stats + dependency graph + git log │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Responsibility |
|---|---|
| **Metric Calculator** | Computes coupling density, churn rate, dependency depth, coverage estimate, and composite score. |
| **Hotspot Ranker** | Computes per-file risk scores, ranks and buckets files, generates treemap data. |
| **Alert Engine** | Checks metrics against thresholds, detects negative trends, generates notifications. |
| **LFCA Data Layer** | Coupling edges, file stats, dependency graph, git log data. Already exists. |
