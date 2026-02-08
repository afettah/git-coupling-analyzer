# Smart Clustering — Comprehensive Redesign

**Date**: 2026-02-07  
**Scope**: Complete redesign of the clustering feature — backend, frontend, API, schemas, UX  
**Philosophy**: Best-in-class project understanding for large codebases. Explainable, smart, customizable.  
**Retrocompatibility**: None required — rewrite from scratch where needed.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State & Critical Issues](#2-current-state--critical-issues)
3. [Target Architecture](#3-target-architecture)
4. [Backend Redesign](#4-backend-redesign)
5. [API Redesign](#5-api-redesign)
6. [Frontend Redesign](#6-frontend-redesign)
7. [Smart Features](#7-smart-features)
8. [File-by-File Action Plan](#8-file-by-file-action-plan)
9. [Data Model & Schema](#9-data-model--schema)
10. [UX Flows](#10-ux-flows)

---

## 1. Executive Summary

The clustering feature is the **central intelligence page** of the platform — the place where engineers go to understand the hidden structure of their codebase. Today it's broken, shallow, and unexplainable. This redesign transforms it into a **smart, opinionated, and self-explanatory** analysis tool.

### Core Design Principles

| Principle | What it means |
|-----------|---------------|
| **Explainable by default** | Every cluster comes with a *why* — coupling reasons, shared history, key commits |
| **Smart defaults** | Auto-detect project size, recommend algorithm & parameters. Zero-config first run |
| **Quality-aware** | Every clustering result includes quality scores. Bad clusterings are flagged, not hidden |
| **Progressive disclosure** | Simple overview first → drill into any cluster → see per-file coupling evidence |
| **Big-project ready** | O(V+E) algorithms by default, streaming edge loading, pagination everywhere |

---

## 2. Current State & Critical Issues

### 2.1 Critical Bugs

| Bug | Severity | Location | Root Cause |
|-----|----------|----------|------------|
| **Clustering page renders ProjectDashboard instead of running clustering** | 🔴 BLOCKER | `src/frontend/src/features/dashboard/ProjectDashboard.tsx:243,440` | Navigation goes to `/repos/{id}/clustering` but router expects `/repos/{id}/git/clustering` |
| **Snapshot edges endpoint is a stub** | 🔴 HIGH | `src/platform/code_intel/routers/git.py:756-758` | Returns hardcoded `{"edges": []}` — inter-cluster visualization impossible |
| **Compare snapshots endpoint is a stub** | 🔴 HIGH | `src/platform/code_intel/routers/git.py:761-770` | Returns hardcoded empty structure — comparison feature broken |
| **Folder filtering is broken** | 🟡 MEDIUM | `src/git-analyzer/git_analyzer/api.py:473,511` | `folders` param accepted but never applied to edge filtering |
| **insights.py never called** | 🟡 MEDIUM | `src/git-analyzer/git_analyzer/clustering/insights.py` | `calculate_cluster_insights()` defined but never invoked by `run_clustering()` |

### 2.2 Missing Capabilities

| Gap | Impact |
|-----|--------|
| **No explanation of why files cluster together** | Users can't trust or understand results |
| **No quality metrics** (silhouette, cohesion, isolation) | No way to know if a clustering is good or bad |
| **No auto-tuning / parameter recommendation** | Users must guess parameters blindly |
| **No internal vs external coupling ratio** | Can't assess cluster boundary quality |
| **No cluster evolution / drift tracking** | Can't see how architecture changes over time |
| **No smart presets** based on project characteristics | Every run requires manual configuration |
| **3 of 5 algorithms return empty metrics** | Components, Hierarchical, Label Propagation |

### 2.3 Code to Delete / Rewrite

| What | Action | Why |
|------|--------|-----|
| `routers/git.py` lines 756-770 (stub endpoints) | **DELETE & REWRITE** | Stubs returning hardcoded empty data — replace with real implementation |
| `ClusterRequest` model in `routers/git.py:619` | **REWRITE** | Missing fields, doesn't support presets or auto-tune |
| `git_clustering_snapshots` schema | **REWRITE** | Missing quality metrics, explanation data, evolution tracking |
| `insights.py` | **REWRITE** | Good intent, but never integrated — merge into clustering pipeline |
| `ClusteringView.tsx` | **REWRITE** | No smart defaults, no presets, no project-aware configuration |
| `ClusterInsights.tsx` | **REWRITE** | Surface-level data, no coupling explanations |
| `naming.ts` | **REWRITE** | Token-frequency only — needs semantic awareness |
| `ClusteringHub.tsx` comparison section | **REWRITE** | Only 4 summary numbers, no cluster-level diff |

---

## 3. Target Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLUSTERING PIPELINE                          │
│                                                                     │
│  ┌──────────┐   ┌──────────────┐   ┌────────────┐   ┌───────────┐ │
│  │ Smart    │──▶│ Algorithm    │──▶│ Quality    │──▶│ Explain   │ │
│  │ Defaults │   │ Execution    │   │ Assessment │   │ Engine    │ │
│  └──────────┘   └──────────────┘   └────────────┘   └───────────┘ │
│       │                                                     │       │
│       ▼                                                     ▼       │
│  ┌──────────┐                                      ┌───────────┐   │
│  │ Project  │                                      │ Snapshot  │   │
│  │ Profiler │                                      │ + Persist │   │
│  └──────────┘                                      └───────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND UX                                  │
│                                                                     │
│  ┌──────────┐   ┌──────────────┐   ┌────────────┐   ┌───────────┐ │
│  │ Smart    │   │ Results +    │   │ Cluster    │   │ Evolution │ │
│  │ Launcher │   │ Quality Bar  │   │ Explorer   │   │ Timeline  │ │
│  └──────────┘   └──────────────┘   └────────────┘   └───────────┘ │
│                                                                     │
│  ┌──────────┐   ┌──────────────┐   ┌────────────┐   ┌───────────┐ │
│  │ Explain  │   │ Compare      │   │ City View  │   │ Export    │ │
│  │ Panels   │   │ Deep Diff    │   │ (enhanced) │   │ & Share   │ │
│  └──────────┘   └──────────────┘   └────────────┘   └───────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Backend Redesign

### 4.1 Project Profiler (NEW)

> **Purpose**: Auto-detect project characteristics to recommend optimal clustering parameters.

**File**: `src/git-analyzer/git_analyzer/clustering/profiler.py` (NEW)

```python
@dataclass
class ProjectProfile:
    file_count: int
    edge_count: int
    avg_degree: float          # avg edges per file
    density: float             # edge_count / max_possible_edges
    commit_count: int
    active_authors: int
    dominant_languages: list[str]
    size_tier: Literal["small", "medium", "large", "huge"]  # <100, <1000, <5000, 5000+
    recommended_algorithm: str
    recommended_params: dict
    recommended_min_weight: float
    confidence: float          # 0-1, how confident we are in recommendations

def profile_project(db_path: Path) -> ProjectProfile:
    """Analyze project characteristics and recommend clustering parameters."""
    # Query entities count, edge stats, commit history
    # Apply heuristics per size_tier
    # Return actionable recommendations
```

**Heuristics**:

| Size Tier | Algorithm | min_weight | resolution | Rationale |
|-----------|-----------|------------|------------|-----------|
| small (<100 files) | louvain | 0.05 | 1.2 | More edges needed, higher resolution for fine clusters |
| medium (100-1000) | louvain | 0.1 | 1.0 | Balanced defaults |
| large (1000-5000) | louvain | 0.15 | 0.8 | Fewer edges, coarser clusters to avoid noise |
| huge (5000+) | louvain | 0.2 | 0.6 | Aggressive filtering, focus on strong signals |

### 4.2 Quality Assessment Engine (NEW)

> **Purpose**: Score every clustering result with standard quality metrics.

**File**: `src/git-analyzer/git_analyzer/clustering/quality.py` (NEW)

```python
@dataclass
class ClusterQuality:
    # Global metrics
    modularity: float              # -0.5 to 1.0 (from graph)
    silhouette_score: float        # -1 to 1 (mean across files)
    coverage: float                # % of files assigned to clusters (vs noise)
    balance: float                 # 0-1, how evenly sized clusters are (entropy-based)
    
    # Per-cluster metrics
    cluster_scores: list[ClusterScore]
    
    # Human-readable verdict
    verdict: Literal["excellent", "good", "fair", "poor"]
    verdict_reasons: list[str]

@dataclass
class ClusterScore:
    cluster_id: int
    cohesion: float        # avg internal coupling
    separation: float      # avg external coupling
    ratio: float           # cohesion / separation (higher = better boundary)
    size_percentile: float # relative size in distribution
    
def assess_quality(
    clusters: ClusterResult,
    edges: list[Edge],
    file_count: int,
) -> ClusterQuality:
    """Compute comprehensive quality metrics for a clustering result."""
```

**Quality Verdict Logic**:
```
excellent: modularity > 0.5 AND silhouette > 0.4 AND coverage > 0.9
good:      modularity > 0.3 AND silhouette > 0.2 AND coverage > 0.7
fair:      modularity > 0.1 AND coverage > 0.5
poor:      everything else
```

### 4.3 Explanation Engine (NEW)

> **Purpose**: Generate human-readable explanations for why files cluster together.

**File**: `src/git-analyzer/git_analyzer/clustering/explain.py` (NEW)

```python
@dataclass
class ClusterExplanation:
    cluster_id: int
    name: str                          # Smart-generated name
    name_confidence: float             # 0-1
    summary: str                       # "12 files in src/auth/ that change together in login-related commits"
    top_coupling_pairs: list[CouplingPair]  # Strongest internal edges with context
    shared_commit_themes: list[str]    # Common commit message patterns
    common_authors: list[str]          # Who works on these files
    folder_breakdown: dict[str, int]   # Folder → file count
    architectural_role: str            # "Core module", "Cross-cutting concern", "Test suite", etc.
    
@dataclass
class CouplingPair:
    file_a: str
    file_b: str
    coupling_score: float
    co_change_count: int
    reason: str              # "Changed together in 47 commits, primarily by 2 authors"

def explain_cluster(
    cluster: dict,
    edges: list[Edge],
    commits_df: pd.DataFrame,
    entities: list[Entity],
) -> ClusterExplanation:
    """Generate rich explanation for a single cluster."""
```

**Architectural Role Detection** (heuristic):
```
- >80% files in same folder depth-2 → "Cohesive module: {folder}"
- >50% test files → "Test suite for {matched_source_folder}"
- Files span 5+ folders → "Cross-cutting concern"
- All files are configs/schemas → "Configuration layer"
- High coupling with many external edges → "Integration hub"
```

### 4.4 Rewrite: `run_clustering()` Pipeline

**File**: `src/git-analyzer/git_analyzer/api.py` — rewrite `run_clustering()` (lines 466-548)

```python
def run_clustering(
    self,
    db_path: Path,
    *,
    algorithm: str = "louvain",
    weight_column: str = "jaccard",
    min_weight: float = 0.1,
    folders: list[str] | None = None,     # FIX: actually implement filtering
    params: dict | None = None,
    auto_tune: bool = False,              # NEW: use profiler recommendations
    explain: bool = True,                 # NEW: generate explanations
    quality: bool = True,                 # NEW: compute quality metrics
) -> ClusteringResult:
    
    # Step 1: Profile project (if auto_tune)
    if auto_tune:
        profile = profile_project(db_path)
        algorithm = profile.recommended_algorithm
        min_weight = profile.recommended_min_weight
        params = profile.recommended_params
    
    # Step 2: Load & filter edges  
    edges = self._load_edges(db_path, weight_column, min_weight)
    if folders:
        edges = [e for e in edges if _matches_folders(e, folders)]  # FIX
    
    # Step 3: Run algorithm
    algo = get_algorithm(algorithm)
    result = algo.run(edges, file_ids, file_map, params or {})
    
    # Step 4: Quality assessment (NEW)
    quality_report = None
    if quality:
        quality_report = assess_quality(result, edges, len(file_ids))
    
    # Step 5: Explanations (NEW)
    explanations = []
    if explain:
        for cluster in result.clusters:
            explanations.append(explain_cluster(cluster, edges, ...))
    
    # Step 6: Persist (enhanced)
    self._persist_clustering(db_path, result, quality_report, explanations)
    
    # Step 7: Return enriched result
    return ClusteringResult(
        result=result,
        quality=quality_report,
        explanations=explanations,
        profile=profile if auto_tune else None,
    )
```

### 4.5 Rewrite: Algorithm Metrics

All algorithms should return quality-relevant metrics. Update each:

**`src/git-analyzer/git_analyzer/clustering/louvain.py`** — already returns modularity ✅, add:
- `num_iterations`: how many passes Louvain took
- `partition_sizes`: distribution of cluster sizes

**`src/git-analyzer/git_analyzer/clustering/components.py`** — currently returns nothing ❌, add:
- `num_components`: total connected components found
- `largest_component_size`: biggest cluster
- `isolated_files`: files with no connections

**`src/git-analyzer/git_analyzer/clustering/hierarchical.py`** — currently returns nothing ❌, add:
- `linkage_method`: which method was used
- `cophenetic_correlation`: how well the dendrogram preserves distances
- `merge_distances`: list of merge thresholds (for dendrogram viz)

**`src/git-analyzer/git_analyzer/clustering/dbscan.py`** — returns noise_count ✅, add:
- `core_samples_count`: number of core points
- `silhouette_score`: if sklearn available

### 4.6 Smart Cluster Naming (Backend)

> Move naming to backend for consistency and richer context access.

**File**: `src/git-analyzer/git_analyzer/clustering/naming.py` (NEW)

```python
def name_cluster(
    file_paths: list[str],
    edges: list[Edge],
    commits: list[dict] | None = None,
) -> tuple[str, float]:  # (name, confidence)
    """Generate a smart name for a cluster.
    
    Strategy (in priority order):
    1. Common folder prefix (>70% files share it) → use folder name
    2. Common file pattern (e.g., *_test.py, *.schema.ts) → use pattern
    3. Dominant domain token from paths → use token
    4. Commit message theme extraction → use theme
    5. Fallback: "Cluster {id}" with confidence=0.0
    """
```

---

## 5. API Redesign

### 5.1 Delete These Endpoints (stubs)

| Endpoint | File | Lines | Action |
|----------|------|-------|--------|
| `GET /clustering/snapshots/{id}/edges` | `routers/git.py` | 756-758 | **DELETE** stub, replace with real implementation |
| `GET /clustering/compare` | `routers/git.py` | 761-770 | **DELETE** stub, replace with real implementation |

### 5.2 Rewrite: ClusterRequest Model

**File**: `src/platform/code_intel/routers/git.py` — replace `ClusterRequest` (line 619)

```python
class ClusterRequest(BaseModel):
    # Preset mode (recommended for most users)
    preset: Literal["auto", "quick", "balanced", "deep"] | None = "auto"
    
    # Manual override (advanced users)
    algorithm: str | None = None           # None = use preset/auto
    weight_column: str = "jaccard"
    min_weight: float | None = None        # None = use preset/auto
    params: dict = {}
    
    # Scope
    folders: list[str] = []                # Filter to specific folders
    exclude_patterns: list[str] = []       # Glob patterns to exclude (e.g., "**/*_test.*")
    
    # Feature flags
    explain: bool = True                   # Generate explanations
    quality: bool = True                   # Compute quality metrics

class ClusterResponse(BaseModel):
    run_id: str
    algorithm: str
    parameters: dict
    cluster_count: int
    clusters: list[ClusterData]
    quality: QualityReport | None
    explanations: list[ClusterExplanation] | None
    profile: ProjectProfile | None         # If auto-tune was used
    
class QualityReport(BaseModel):
    modularity: float
    silhouette_score: float
    coverage: float
    balance: float
    verdict: str                          # "excellent" | "good" | "fair" | "poor"
    verdict_reasons: list[str]
    cluster_scores: list[ClusterScore]

class ClusterData(BaseModel):
    id: int
    label: str
    size: int
    files: list[str]
    cohesion: float                        # Internal coupling avg
    separation: float                      # External coupling avg
    quality_ratio: float                   # cohesion / separation
    explanation: ClusterExplanation | None
```

### 5.3 New Endpoints

```
# Project profiling & recommendations
GET  /repos/{id}/git/clustering/profile
  → Returns: ProjectProfile with recommended params
  → Use case: "What should I configure?" before running

# Run clustering (enhanced)
POST /repos/{id}/git/clustering/run
  → Body: ClusterRequest (with preset support)
  → Returns: ClusterResponse (with quality + explanations)
  → Note: auto-saves as snapshot if quality >= "fair"

# Explain a specific cluster
GET  /repos/{id}/git/clustering/snapshots/{sid}/clusters/{cid}/explain
  → Returns: detailed ClusterExplanation with coupling evidence
  → Use case: "Why are these files together?"

# Cluster coupling graph (edges between clusters)
GET  /repos/{id}/git/clustering/snapshots/{sid}/graph
  → Returns: { nodes: ClusterNode[], edges: ClusterEdge[] }
  → Use case: Inter-cluster visualization, understand cluster relationships

# Deep comparison between two snapshots
GET  /repos/{id}/git/clustering/compare?base={sid1}&head={sid2}
  → Returns: ComparisonResult with per-cluster diff
  → Shows: stable, merged, split, dissolved, new clusters
  → Use case: "How did our architecture change?"

# Quality assessment for existing snapshot
GET  /repos/{id}/git/clustering/snapshots/{sid}/quality
  → Returns: QualityReport
  → Use case: Evaluate saved snapshots

# Snapshot list (enhanced with quality badges)
GET  /repos/{id}/git/clustering/snapshots
  → Returns: list with quality verdict, cluster_count, coverage
```

### 5.4 Presets Resolution

When `preset` is provided, resolve it server-side using the Project Profiler:

| Preset | Behavior |
|--------|----------|
| `auto` | Profile project → pick best algorithm + params automatically |
| `quick` | `components` algorithm, high min_weight → fast, coarse clusters |
| `balanced` | `louvain` with profiler-tuned resolution → recommended for most |
| `deep` | `louvain` with low min_weight + high resolution → fine-grained, slower |

---

## 6. Frontend Redesign

### 6.1 Fix: Navigation Bug

**File**: `src/frontend/src/features/dashboard/ProjectDashboard.tsx`  
**Lines**: 243, 440  
**Fix**: Change `/repos/${repo.id}/clustering` → `/repos/${repo.id}/git/clustering`

### 6.2 Rewrite: Smart Launcher (ClusteringView.tsx)

**File**: `src/frontend/src/features/git/ClusteringView.tsx` — **REWRITE**

Replace the current manual-only form with a **two-mode launcher**:

```
┌─────────────────────────────────────────────────────┐
│  🚀 Run Clustering Analysis                         │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ SMART MODE (Recommended)                     │    │
│  │                                              │    │
│  │  Your project: 1,247 files · 12,340 commits │    │
│  │                                              │    │
│  │  ○ Quick    — Fast overview (~2s)            │    │
│  │  ● Balanced — Best results (~15s)            │    │
│  │  ○ Deep     — Maximum detail (~45s)          │    │
│  │                                              │    │
│  │  Scope: [All files ▾] or [Select folders...] │    │
│  │                                              │    │
│  │  [ ▶ Run Analysis ]                          │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ▸ Advanced settings (algorithm, weight, params...) │
│    └── Collapsed by default, expands to full form   │
└─────────────────────────────────────────────────────┘
```

**Key changes**:
- Call `GET /clustering/profile` on mount to get project stats & recommendations
- Default to "Balanced" preset with visual indication of recommended option
- Show estimated time based on profile
- Folder scope picker with file tree (reuse existing tree components)
- Advanced mode collapsed by default — opens full algorithm/param configuration
- Name field with auto-generated suggestion based on timestamp + preset

### 6.3 Rewrite: Results Overview with Quality Bar

**File**: `src/frontend/src/features/git/clustering/SnapshotDetail.tsx` — **REWRITE**

Add a **quality summary bar** at the top of every snapshot view:

```
┌─────────────────────────────────────────────────────────┐
│  📊 Clustering Results — "Auth & Payments Refactor"     │
│                                                         │
│  Quality: ████████░░ Good (0.72)                        │
│  Modularity: 0.45 · Silhouette: 0.31 · Coverage: 92%   │
│  💡 "Strong boundaries. 3 clusters could be split       │
│      further for better cohesion."                      │
│                                                         │
│  ┌─────┬───────────┬──────────┬────────────┐            │
│  │ All │ Clusters  │ City     │ Diagram    │            │
│  └─────┴───────────┴──────────┴────────────┘            │
└─────────────────────────────────────────────────────────┘
```

### 6.4 Rewrite: Cluster Cards with Explanation

**File**: `src/frontend/src/features/git/clustering/components/ClusterCard.tsx` — **REWRITE**

Each cluster card should show:

```
┌─────────────────────────────────────────────┐
│  📁 Authentication Module           Good ●  │
│  14 files · 3 folders · cohesion: 0.78      │
│                                             │
│  WHY: Files share 89% of commits. Primary   │
│  authors: @alice, @bob. Core folder:        │
│  src/auth/                                  │
│                                             │
│  🔥 Hot files: auth_service.py, jwt.py      │
│  🔗 Strongly coupled to: "API Gateway" (3)  │
│                                             │
│  [ Explore ] [ Explain ] [ Files ▾ ]        │
└─────────────────────────────────────────────┘
```

### 6.5 New: Cluster Explanation Panel

**File**: `src/frontend/src/features/git/clustering/components/ClusterExplainPanel.tsx` (NEW)

A slide-out or modal panel that shows deep explanation for a cluster:

```
┌──────────────────────────────────────────────────────┐
│  🔍 Why "Authentication Module"?                      │
│                                                       │
│  COUPLING EVIDENCE                                    │
│  ┌──────────────┬──────────────┬────────┐            │
│  │ auth_svc.py  │ jwt_utils.py │  0.89  │ 47 commits │
│  │ auth_svc.py  │ middleware.py│  0.72  │ 31 commits │
│  │ jwt_utils.py │ tokens.py   │  0.68  │ 28 commits │
│  └──────────────┴──────────────┴────────┘            │
│                                                       │
│  SHARED HISTORY                                       │
│  • "Fix auth token refresh" (23 files, @alice)       │
│  • "Add OAuth2 support" (18 files, @bob)             │
│  • "Security patch: JWT validation" (8 files)        │
│                                                       │
│  ARCHITECTURAL ROLE                                   │
│  Cohesive module — 85% of files in src/auth/         │
│                                                       │
│  QUALITY                                              │
│  Cohesion: 0.78 · Separation: 0.12 · Ratio: 6.5x    │
│  ✅ Well-isolated module with strong internal bonds   │
└──────────────────────────────────────────────────────┘
```

### 6.6 Rewrite: Deep Comparison View

**File**: `src/frontend/src/features/git/clustering/ClusteringHub.tsx` — rewrite comparison section

Replace the current 4-number summary with a **cluster-level diff view**:

```
┌────────────────────────────────────────────────────────────┐
│  📊 Compare: "v1.2 baseline" → "After refactor"           │
│                                                            │
│  Summary: 8 stable · 2 merged · 1 split · 1 new · 1 gone │
│                                                            │
│  ┌─────────────────────┬─────────────────────────────────┐ │
│  │ STABLE (8)          │ Auth Module ✅ (14→14 files)    │ │
│  │                     │ API Gateway ✅ (8→9 files, +1)  │ │
│  │                     │ ...                              │ │
│  ├─────────────────────┼─────────────────────────────────┤ │
│  │ MERGED (2→1)        │ "Payments" + "Billing"          │ │
│  │                     │ → "Payments & Billing" (22 files)│ │
│  ├─────────────────────┼─────────────────────────────────┤ │
│  │ SPLIT (1→2)         │ "Utilities" →                   │ │
│  │                     │   "String Utils" (5 files)      │ │
│  │                     │   "Date Utils" (4 files)        │ │
│  ├─────────────────────┼─────────────────────────────────┤ │
│  │ NEW (1)             │ "GraphQL Layer" (7 files) 🆕    │ │
│  ├─────────────────────┼─────────────────────────────────┤ │
│  │ DISSOLVED (1)       │ "Legacy Auth" (6 files) 💀      │ │
│  │                     │ → absorbed into "Auth Module"   │ │
│  └─────────────────────┴─────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### 6.7 Enhanced: Inter-Cluster Graph View

**File**: `src/frontend/src/features/git/clustering/views/ClustersTab.tsx` — add graph view mode

Add a **force-directed graph** where:
- Nodes = clusters (sized by file count)
- Edges = coupling between clusters (weighted by avg cross-cluster coupling)
- Colors = quality score (green=good boundary, red=blurry boundary)
- Click node → navigate to cluster detail

Use the new `GET /clustering/snapshots/{sid}/graph` endpoint.

### 6.8 Type System Updates

**File**: `src/frontend/src/features/git/clustering/types/index.ts` — **REWRITE**

Add these types:

```typescript
interface ClusterData {
  id: number;
  label: string;
  size: number;
  files: string[];
  file_ids: number[];
  
  // NEW: Quality metrics
  cohesion: number;
  separation: number;
  qualityRatio: number;
  
  // NEW: Explanation
  explanation?: ClusterExplanation;
  architecturalRole?: string;
}

interface ClusterExplanation {
  summary: string;
  nameConfidence: number;
  topCouplingPairs: CouplingPair[];
  sharedCommitThemes: string[];
  commonAuthors: string[];
  folderBreakdown: Record<string, number>;
  architecturalRole: string;
}

interface CouplingPair {
  fileA: string;
  fileB: string;
  couplingScore: number;
  coChangeCount: number;
  reason: string;
}

interface QualityReport {
  modularity: number;
  silhouetteScore: number;
  coverage: number;
  balance: number;
  verdict: "excellent" | "good" | "fair" | "poor";
  verdictReasons: string[];
  clusterScores: ClusterScore[];
}

interface ClusterScore {
  clusterId: number;
  cohesion: number;
  separation: number;
  ratio: number;
  sizePercentile: number;
}

interface ProjectProfile {
  fileCount: number;
  edgeCount: number;
  avgDegree: number;
  density: number;
  sizeTier: "small" | "medium" | "large" | "huge";
  recommendedAlgorithm: string;
  recommendedParams: Record<string, any>;
  recommendedMinWeight: number;
  confidence: number;
}

interface ComparisonResult {
  base: SnapshotSummary;
  head: SnapshotSummary;
  stable: ClusterDiff[];
  merged: ClusterMerge[];
  split: ClusterSplit[];
  new: ClusterData[];
  dissolved: ClusterData[];
  overallDrift: number;        // 0-1, how much architecture changed
}

interface ClusterDiff {
  baseCluster: ClusterData;
  headCluster: ClusterData;
  filesAdded: string[];
  filesRemoved: string[];
  couplingDelta: number;
}
```

---

## 7. Smart Features

### 7.1 Auto-Tune with Feedback Loop

When `preset: "auto"` is used:
1. Profile project → get initial recommendation
2. Run clustering with recommended params
3. Assess quality of result
4. If quality < "fair", try alternative params (lower min_weight, different resolution)
5. Return best result with explanation of what was tried

This happens server-side in `run_clustering()` when `auto_tune=True`.

### 7.2 Smart Naming Strategy (Backend)

Move naming from frontend (`utils/naming.ts`) to backend (`clustering/naming.py`):

1. **Folder dominance** (>70% share a prefix) → `"src/auth" → "Auth Module"`
2. **File pattern** (>50% match pattern) → `"*_test.py" → "Test Suite: Auth"`
3. **Tech layer** (all same extension + layer) → `"*.controller.ts" → "Controllers"`
4. **Commit theme** (extract most common tokens from commit messages) → `"Payment Processing"`
5. **Fallback** → `"Cluster {id}: {top_folder}"`

Frontend `naming.ts` becomes a thin wrapper that just formats the backend-generated name.

### 7.3 Architectural Hints

Detect and label clusters with architectural roles:

| Pattern | Role | Icon |
|---------|------|------|
| >80% in one folder at depth 2 | `Cohesive Module` | 📦 |
| >50% `*_test.*` or `*_spec.*` | `Test Suite` | 🧪 |
| Spans 5+ top-level folders | `Cross-cutting Concern` | 🔀 |
| All `*.config.*`, `*.env.*`, `*.yml` | `Configuration Layer` | ⚙️ |
| High external coupling, low internal | `Integration Hub` | 🔗 |
| Very small (2-3 files), high coupling | `Tight Pair` | 🤝 |

### 7.4 Quality Badges on Snapshots

Every saved snapshot shows a quality badge in the list:

```
🟢 Excellent  — Modularity > 0.5, clear boundaries
🔵 Good       — Solid structure, minor improvements possible  
🟡 Fair       — Usable but some clusters overlap
🔴 Poor       — Consider re-running with different parameters
```

---

## 8. File-by-File Action Plan

### Backend — New Files

| File | Purpose |
|------|---------|
| `src/git-analyzer/git_analyzer/clustering/profiler.py` | Project profiler with size detection and param recommendation |
| `src/git-analyzer/git_analyzer/clustering/quality.py` | Quality assessment engine (modularity, silhouette, cohesion/separation) |
| `src/git-analyzer/git_analyzer/clustering/explain.py` | Explanation engine for cluster composition |
| `src/git-analyzer/git_analyzer/clustering/naming.py` | Smart cluster naming with confidence scores |
| `src/git-analyzer/git_analyzer/clustering/compare.py` | Deep snapshot comparison (stable/merged/split/dissolved/new) |

### Backend — Files to Rewrite

| File | What to Change |
|------|----------------|
| `src/git-analyzer/git_analyzer/api.py` | Rewrite `run_clustering()` to integrate profiler, quality, explain, naming. Fix folder filtering. |
| `src/git-analyzer/git_analyzer/clustering/insights.py` | **DELETE** — merge useful logic into `explain.py` |
| `src/git-analyzer/git_analyzer/clustering/components.py` | Add quality metrics to `run()` return |
| `src/git-analyzer/git_analyzer/clustering/hierarchical.py` | Add quality metrics to `run()` return |
| `src/git-analyzer/git_analyzer/clustering/louvain.py` | Add partition_sizes, num_iterations to metrics |
| `src/git-analyzer/git_analyzer/clustering/dbscan.py` | Add core_samples_count, silhouette to metrics |
| `src/git-analyzer/git_analyzer/clustering/base.py` | Extend `ClusterResult` dataclass with quality + explanation fields |
| `src/platform/code_intel/routers/git.py` | Rewrite `ClusterRequest`/response models. Delete stub endpoints. Add new endpoints (profile, explain, graph, compare, quality). |
| `src/platform/code_intel/schema.py` | Rewrite clustering tables (see §9) |

### Frontend — Files to Rewrite

| File | What to Change |
|------|----------------|
| `src/frontend/src/features/git/ClusteringView.tsx` | **REWRITE** — Smart launcher with presets, profile display, folder picker |
| `src/frontend/src/features/git/clustering/SnapshotDetail.tsx` | **REWRITE** — Add quality bar, explanation panels |
| `src/frontend/src/features/git/clustering/components/ClusterCard.tsx` | **REWRITE** — Add explanation summary, quality indicator, architectural role |
| `src/frontend/src/features/git/clustering/components/ClusterInsights.tsx` | **REWRITE** — Use backend explanations instead of surface stats |
| `src/frontend/src/features/git/clustering/ClusteringHub.tsx` | Rewrite comparison section with deep diff view |
| `src/frontend/src/features/git/clustering/views/ClustersTab.tsx` | Add inter-cluster graph view mode |
| `src/frontend/src/features/git/clustering/types/index.ts` | **REWRITE** — Add quality, explanation, profile, comparison types |
| `src/frontend/src/features/git/clustering/utils/naming.ts` | Simplify to thin wrapper over backend naming |
| `src/frontend/src/features/git/clustering/hooks/useSnapshots.ts` | Extend to include quality data in snapshot list |
| `src/frontend/src/api/git.ts` | Add new API calls: profile, explain, graph, compare, quality |

### Frontend — New Files

| File | Purpose |
|------|---------|
| `src/frontend/src/features/git/clustering/components/ClusterExplainPanel.tsx` | Deep explanation slide-out panel |
| `src/frontend/src/features/git/clustering/components/QualityBar.tsx` | Quality summary bar with metrics and verdict |
| `src/frontend/src/features/git/clustering/components/ComparisonView.tsx` | Deep snapshot comparison UI |
| `src/frontend/src/features/git/clustering/views/GraphView.tsx` | Inter-cluster force-directed graph |
| `src/frontend/src/features/git/clustering/hooks/useProfile.ts` | Hook for project profile API |
| `src/frontend/src/features/git/clustering/hooks/useExplain.ts` | Hook for cluster explanation API |

### Files to Delete

| File | Why |
|------|-----|
| `src/git-analyzer/git_analyzer/clustering/insights.py` | Replaced by `explain.py` with richer logic |

### Bug Fixes (Immediate)

| File | Fix |
|------|-----|
| `src/frontend/src/features/dashboard/ProjectDashboard.tsx:243,440` | Change navigation path from `/repos/${id}/clustering` to `/repos/${id}/git/clustering` |
| `src/platform/code_intel/routers/git.py:635-640` | Pass `folders` from ClusterRequest to `api.run_clustering()` |

---

## 9. Data Model & Schema

### 9.1 Rewrite: Clustering Tables

**File**: `src/platform/code_intel/schema.py` — replace lines 146-178

```sql
-- ═══════════════════════════════════════════════════
-- CLUSTERING TABLES (v2 — full rewrite)
-- ═══════════════════════════════════════════════════

-- Drop old tables (no retrocompatibility needed)
DROP TABLE IF EXISTS git_cluster_members;
DROP TABLE IF EXISTS git_clusters;
DROP TABLE IF EXISTS git_cluster_runs;
DROP TABLE IF EXISTS git_clustering_snapshots;

-- Clustering run metadata (one row per execution)
CREATE TABLE IF NOT EXISTS git_cluster_runs (
    run_id          TEXT PRIMARY KEY,
    algorithm       TEXT NOT NULL,
    preset          TEXT,                          -- "auto", "quick", "balanced", "deep", NULL
    params_json     TEXT NOT NULL DEFAULT '{}',
    weight_column   TEXT NOT NULL DEFAULT 'jaccard',
    min_weight      REAL NOT NULL DEFAULT 0.1,
    folders_json    TEXT,                           -- scope filter applied
    
    -- Results summary
    cluster_count   INTEGER NOT NULL,
    file_count      INTEGER NOT NULL,              -- total files clustered
    noise_count     INTEGER NOT NULL DEFAULT 0,    -- files not assigned
    
    -- Quality metrics (computed post-clustering)
    modularity      REAL,
    silhouette      REAL,
    coverage        REAL,
    balance         REAL,
    verdict         TEXT,                           -- "excellent"/"good"/"fair"/"poor"
    verdict_reasons TEXT,                           -- JSON array of strings
    
    -- Profile (if auto-tuned)
    profile_json    TEXT,                           -- ProjectProfile as JSON
    
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Individual clusters within a run
CREATE TABLE IF NOT EXISTS git_clusters (
    cluster_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id          TEXT NOT NULL REFERENCES git_cluster_runs(run_id) ON DELETE CASCADE,
    label           TEXT NOT NULL,                  -- Smart-generated name
    label_confidence REAL NOT NULL DEFAULT 0.0,     -- 0-1 naming confidence
    size            INTEGER NOT NULL,
    
    -- Per-cluster quality
    cohesion        REAL,                           -- avg internal coupling
    separation      REAL,                           -- avg external coupling  
    quality_ratio   REAL,                           -- cohesion / separation
    
    -- Explanation
    summary         TEXT,                           -- Human-readable explanation
    architectural_role TEXT,                         -- "Cohesive Module", "Test Suite", etc.
    folder_breakdown TEXT,                           -- JSON: {folder: count}
    common_authors   TEXT,                           -- JSON array
    commit_themes    TEXT,                           -- JSON array
    
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clusters_run ON git_clusters(run_id);

-- Cluster membership (which files belong to which cluster)
CREATE TABLE IF NOT EXISTS git_cluster_members (
    cluster_id  INTEGER NOT NULL REFERENCES git_clusters(cluster_id) ON DELETE CASCADE,
    entity_id   INTEGER NOT NULL REFERENCES entities(entity_id),
    PRIMARY KEY (cluster_id, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_members_entity ON git_cluster_members(entity_id);

-- Top coupling pairs within each cluster (for explanation)
CREATE TABLE IF NOT EXISTS git_cluster_coupling_evidence (
    cluster_id      INTEGER NOT NULL REFERENCES git_clusters(cluster_id) ON DELETE CASCADE,
    src_entity_id   INTEGER NOT NULL,
    dst_entity_id   INTEGER NOT NULL,
    coupling_score  REAL NOT NULL,
    co_change_count INTEGER NOT NULL,
    reason          TEXT,                            -- Human-readable coupling reason
    PRIMARY KEY (cluster_id, src_entity_id, dst_entity_id)
);

-- Named/saved clustering snapshots (with quality data)
CREATE TABLE IF NOT EXISTS git_clustering_snapshots (
    id              TEXT PRIMARY KEY,
    run_id          TEXT REFERENCES git_cluster_runs(run_id),
    name            TEXT NOT NULL,
    algorithm       TEXT,
    cluster_count   INTEGER,
    file_count      INTEGER,
    
    -- Quality summary (denormalized for fast listing)
    verdict         TEXT,
    modularity      REAL,
    coverage        REAL,
    
    -- Full result (for detailed view)
    result_json     TEXT NOT NULL,
    
    -- Metadata
    tags_json       TEXT DEFAULT '[]',
    notes           TEXT,                            -- User notes
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 9.2 Key Design Decisions

1. **Denormalized quality metrics in snapshots** — fast listing without loading full result_json
2. **Coupling evidence table** — top N coupling pairs stored per cluster for instant explanation
3. **CASCADE deletes** — deleting a run cleans up all related data
4. **Entity index on members** — fast "which cluster is this file in?" queries
5. **Profile stored in runs** — audit trail of what auto-tune recommended

---

## 10. UX Flows

### 10.1 First-Time User Flow

```
1. User navigates to /repos/{id}/git/clustering
2. → ClusteringHub shows empty state with prominent "Run Analysis" CTA
3. User clicks "Run Analysis"
4. → ClusteringView (Smart Launcher) loads
5. → API call: GET /clustering/profile
6. → Display: "Your project: 1,247 files · 12,340 commits"
7. → Pre-selected: "Balanced" preset (recommended)
8. User clicks "Run Analysis"
9. → API call: POST /clustering/run {preset: "balanced"}
10. → Loading state with progress indication
11. → Results page with quality bar: "Good (0.72)"
12. → 8 clusters displayed as cards with names and explanations
13. User clicks "Explain" on a cluster
14. → Explanation panel slides out with coupling evidence
15. → User understands WHY files are grouped
16. User clicks "Save Snapshot" → auto-named, tagged, persisted
```

### 10.2 Power User Flow

```
1. User navigates to /repos/{id}/git/clustering
2. → ClusteringHub shows 5 saved snapshots with quality badges
3. User clicks "New Analysis" → Smart Launcher
4. User expands "Advanced settings"
5. → Full control: algorithm picker, weight column, min_weight slider, resolution
6. → Folder scope: selects only "src/backend/**"
7. User runs analysis
8. → Results with quality: "Excellent (0.88)"
9. User compares with previous snapshot
10. → Deep diff: 2 clusters merged, 1 split, quality improved 12%
11. User saves as new snapshot: "Post-refactor baseline"
```

### 10.3 Comparison Flow

```
1. User selects two snapshots in ClusteringHub
2. Clicks "Compare"
3. → API call: GET /clustering/compare?base=X&head=Y
4. → Comparison view shows:
   - Summary bar: stability score, cluster count delta
   - Per-cluster changes: stable/merged/split/new/dissolved
   - Click any change to see file-level details
5. User exports comparison as report
```

---

## Appendix: Priority Order

### Phase 1 — Fix Critical Bugs (Day 1)
- Fix navigation bug in ProjectDashboard.tsx
- Fix folder filtering passthrough in router
- Wire up insights.py in run_clustering()

### Phase 2 — Backend Intelligence (Week 1)
- Create `profiler.py`, `quality.py`, `explain.py`, `naming.py`
- Rewrite `run_clustering()` pipeline in api.py
- Rewrite schema tables
- Add quality metrics to all algorithms
- Implement new API endpoints

### Phase 3 — Frontend Smart UX (Week 2)
- Rewrite ClusteringView.tsx (Smart Launcher)
- Add QualityBar component
- Rewrite ClusterCard with explanations
- Add ClusterExplainPanel
- Update types and API hooks

### Phase 4 — Advanced Features (Week 3)
- Deep comparison view (compare.py + ComparisonView.tsx)
- Inter-cluster graph view (GraphView.tsx)
- Snapshot edges endpoint (real implementation)
- Auto-tune feedback loop

### Phase 5 — Polish (Week 4)
- Enhanced City View with quality overlays
- Export to report (PDF/Markdown)
- Keyboard shortcuts for power users
- Performance optimization for huge projects
