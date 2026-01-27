# LFCA (Logical File Coupling Analyzer) — System Specification

> **Version**: 1.0
> **Status**: Official
> **Date**: 2026-01-27

---

## Executive Summary

LFCA analyzes git history to discover **logical coupling** — files that frequently change together in commits, indicating hidden dependencies or shared responsibility. The system:

1. **Mirrors** git repositories and **extracts** commit history to Parquet files
2. **Builds** file pair co-occurrence edges with weighted metrics (Jaccard similarity, Conditional Probabilities)
3. **Clusters** files using graph algorithms to discover modules
4. **Visualizes** coupling via a React+D3 frontend served by FastAPI

---

## Table of Contents

1. [Glossary & Core Concepts](#1-glossary--core-concepts)
2. [Project Management](#2-project-management)
3. [Git Commit Processing](#3-git-commit-processing)
4. [Edge Building & Metrics](#4-edge-building--metrics)
5. [Clustering](#5-clustering)
6. [Visualization](#6-visualization)
7. [API & Architecture](#7-api--architecture)
8. [Cross-cutting Features](#8-cross-cutting-features)

---

## 1. Glossary & Core Concepts

| Term | Definition |
|------|------------|
| **Repository (Repo)** | A git repository mirrored locally under `data/repos/<repo_id>/mirror.git` |
| **Extraction** | Walking git history to produce structured artifacts (Parquet + SQLite) |
| **Transaction** | A commit's set of changed file_ids, used for co-occurrence counting |
| **Edge** | A weighted relationship between two files based on co-change frequency |
| **Coupling Weight** | Jaccard similarity or conditional probability measuring coupling strength |
| **Cluster** | A group of files identified as logically related by clustering algorithms |
| **Impact** | The set of files most coupled to a given target file |

### Data Flow Overview

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌────────────┐
│  Git Repo   │────▶│   Mirror     │────▶│   Extract    │────▶│  Parquet   │
│             │     │  (bare git)  │     │  (git log)   │     │  Artifacts │
└─────────────┘     └──────────────┘     └──────────────┘     └────────────┘
                                                                     │
                    ┌──────────────┐     ┌──────────────┐            ▼
                    │  Clustering  │◀────│ Edge Builder │◀───────────┘
                    │  (Louvain,   │     │  (pairs +    │
                    │  Components) │     │   metrics)   │
                    └──────────────┘     └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Visualization│
                    │  (React/D3)  │
                    └──────────────┘
```

---

## 2. Project Management

### 2.1 Storage Layout: Run Model & Manifests

The system uses a run-based model where every analysis produces a discrete, reproducible set of artifacts scoped to a `run_id`.

#### Run Registry Schema (SQLite)

```sql
-- data/repos/<repo_id>/artifacts/indexes/runs.sqlite

CREATE TABLE repos (
    repo_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    origin_path TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE analysis_runs (
    run_id TEXT PRIMARY KEY,           -- UUID/ULID
    repo_id TEXT NOT NULL REFERENCES repos(repo_id),
    state TEXT NOT NULL,               -- queued|running|complete|failed|canceled
    created_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    parameters_json TEXT,              -- since/until, policies, topk, branch/ref
    git_head_oid TEXT,                 -- HEAD commit at start
    git_range TEXT,                    -- commit range analyzed
    artifact_root TEXT,                -- path to run artifacts
    processed_commits INTEGER DEFAULT 0,
    total_commits INTEGER DEFAULT 0,
    stage TEXT,
    error TEXT
);

CREATE TABLE cluster_runs (
    cluster_run_id TEXT PRIMARY KEY,
    analysis_run_id TEXT REFERENCES analysis_runs(run_id),
    state TEXT NOT NULL,
    parameters_json TEXT,              -- algorithm, min_weight, folders
    created_at TEXT NOT NULL,
    finished_at TEXT,
    cluster_count INTEGER,
    error TEXT
);
```

#### Run-Scoped Artifacts

```
data/repos/<repo_id>/artifacts/
├── runs/
│   ├── <run_id_1>/
│   │   ├── manifest.json
│   │   ├── commits.parquet
│   │   ├── transactions.parquet
│   │   ├── edges/
│   │   │   └── edges_file_topk.parquet
│   │   └── clusters/
│   │       └── <cluster_run_id>.json
│   └── <run_id_2>/
│       └── ...
├── indexes/
│   ├── runs.sqlite
│   └── file_index.sqlite    # Shared base index for file identity
└── latest.json              # Pointer to latest successful run
```

#### Manifest Schema

Each run includes a `manifest.json` describing exactly what was produced and how.

```json
{
  "schema_version": "1.0",
  "run_id": "abc123",
  "repo_id": "my-repo",
  "created_at": "2026-01-27T10:00:00Z",
  "git_head_oid": "a1b2c3d4...",
  "git_refs": ["HEAD"],
  "commit_range": {
    "since": null,
    "until": null,
    "first_commit": "oldest...",
    "last_commit": "newest..."
  },
  "extraction_config": {
    "max_files_per_commit": 300,
    "bulk_policy": "downweight",
    "merge_policy": "include"
  },
  "edge_config": {
    "topk_edges_per_file": 50,
    "merge_downweight": 0.5
  },
  "artifacts": {
    "commits": "commits.parquet",
    "transactions": "transactions.parquet",
    "edges": "edges/edges_file_topk.parquet"
  },
  "stats": {
    "commit_count": 5000,
    "file_count": 1200,
    "edge_count": 45000
  }
}
```

### 2.2 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/repos` | List all repositories |
| POST | `/repos` | Create/register a repository |
| DELETE | `/repos/{repo_id}` | Delete repository and all artifacts |
| GET | `/repos/{repo_id}/runs` | List analysis runs |
| POST | `/repos/{repo_id}/runs` | Start new analysis run |
| GET | `/repos/{repo_id}/runs/{run_id}` | Get run status + manifest |
| DELETE | `/repos/{repo_id}/runs/{run_id}` | Delete run artifacts |
| POST | `/repos/{repo_id}/runs/{run_id}/clusters` | Start clustering on run |

---

## 3. Git Commit Processing

### 3.1 Git Log Ingestion

Analysis is performed explicitly on the **bare mirror** to ensure consistency and reproducibility regardless of the working tree state.

- **Source**: `git log --name-status --find-renames=60% --date-order -z` run against the mirror.
- **Reference Scope**: Extraction targets a specific ref (default `HEAD`) or set of refs, stored in `ExtractConfig`.
- **Merge Commits**: Handled according to `merge_policy`.
- **Renames vs Copies**: 
  - Renames (`R`) transfer file identity.
  - Copies (`C`) create a NEW file identity (`copy_policy="separate"`), preventing spurious coupling across copied files.

```python
@dataclass
class ExtractConfig:
    ref: str = "HEAD"
    all_refs: bool = False
    copy_policy: str = "separate"  # "separate" | "same_identity"
    # ... other config options
```

### 3.2 File Identity & Current Structure

#### File Indexing
Files are tracked via `file_index.sqlite` which persists `path ↔ file_id` mappings. 
- `_file_id_for_path` resolves based on `path_current` or historical aliases.
- Renames are tracked to maintain a single `file_id` across movement.

#### Current Files Index
To support a clean UI, the system maintains a `current_files` table representing the state of the repo at `HEAD`.

```sql
-- file_index.sqlite
CREATE TABLE current_files (
    file_id INTEGER PRIMARY KEY,
    path TEXT UNIQUE NOT NULL,        -- Current path at HEAD
    exists_at_head BOOLEAN NOT NULL,  -- True if file exists now
    first_seen_commit TEXT,
    last_seen_commit TEXT,
    total_commits INTEGER DEFAULT 0
);
```

This table is populated by running `git ls-tree -r HEAD` on the mirror after extraction. All tree visualizations query this table to ensure deleted files do not clutter the view.

### 3.3 File History & Co-change Query API

#### Get File History

```http
GET /repos/{repo_id}/files/{path}/history
```

Returns `file_id`, current status, historical renames, and commit log.

#### Get Files Co-changed in a Commit

```http
GET /repos/{repo_id}/commits/{commit_oid}/files
```

#### Get Global Coupling for a File

```http
GET /repos/{repo_id}/runs/{run_id}/coupling?path=src/api/auth.py&top=20
```

Returns weighted coupling data including Jaccard and Conditional Probabilities.

### 3.4 Artifact Schemas

#### commits.parquet
| Column | Type | Description |
|--------|------|-------------|
| commit_oid | string | SHA-1 hash |
| author_name | string | Author name |
| author_email | string | Author email |
| authored_ts | timestamp[s] | Author timestamp |
| committer_ts | timestamp[s] | Committer timestamp |
| is_merge | bool | Has multiple parents |
| message_subject | string | First line of message |

#### transactions.parquet
| Column | Type | Description |
|--------|------|-------------|
| commit_oid | string | SHA-1 hash |
| file_id | int64 | File identifier |
| commit_ts | timestamp[s] | Commit timestamp |

#### changes.parquet
| Column | Type | Description |
|--------|------|-------------|
| commit_oid | string | SHA-1 hash |
| file_id | int64 | File identifier |
| path | string | Path at this commit |
| status | string | A/M/D/R/C... |
| old_path | string | For renames/copies |
| commit_ts | timestamp[s] | Commit timestamp |

---

## 4. Edge Building & Metrics

### 4.1 Metrics

The system calculates logical coupling using multiple complementary metrics:

1.  **Weighted Co-occurrence**: Commits with many files (bulk edits) are downweighted (e.g., `1 / log(N)`).
2.  **Weighted Jaccard**: `weighted_pair_count / (weighted_src_count + weighted_dst_count - weighted_pair_count)`
3.  **Conditional Probability**:
    - `P(dst | src)`: Probability that `dst` changes given `src` changed.
    - `P(src | dst)`: Reverse probability.
4.  **Time Decay (Optional)**: Older commits contribute less to the weight using exponential decay defined by `half_life_days`.

### 4.2 Edge Schema

#### edges_file_topk.parquet
| Column | Type | Description |
|--------|------|-------------|
| src_file_id | int64 | Source file |
| dst_file_id | int64 | Destination file |
| pair_count | float64 | Weighted co-occurrence count |
| src_count | int32 | Source commit count (unweighted) |
| dst_count | int32 | Destination commit count |
| weight_jaccard | float32 | Unweighted Jaccard |
| weight_jaccard_weighted | float32 | Weighted Jaccard |
| weight_p_dst_given_src | float32 | P(dst\|src) |
| weight_p_src_given_dst | float32 | P(src\|dst) |

### 4.3 Global Coupling Configuration

The analysis is highly configurable to support different architectural needs.

```python
@dataclass
class CouplingConfig:
    # Filters
    min_revisions: int = 5
    max_changeset_size: int = 50
    
    # Mode
    changeset_mode: str = "by_commit" # "by_commit", "by_author_time", "by_ticket_id"
    author_time_window_hours: int = 24
    ticket_id_pattern: str | None = None
    
    # Thresholds
    min_cooccurrence: int = 5
    component_depth: int = 2
    
    # Time
    window_days: int | None = None
    decay_half_life_days: int | None = None
```

---

## 5. Clustering

### 5.1 Clustering Interface

Clustering is performed via a standard interface allowing multiple algorithms to be plugged in.

```python
@dataclass
class ClusterResult:
    algorithm: str
    parameters: dict
    cluster_count: int
    clusters: list[dict]  # [{id, size, files, ...}]
    metrics: dict         # {modularity, avg_cluster_size, ...}
```

### 5.2 Supported Algorithms

The system supports the following clustering strategies:

#### A. Louvain Community Detection (Default)
Handles large sparse weighted graphs and produces hierarchical communities.
- **Parameters**: `resolution` (granularity), `min_community_size`.
- **Output**: Communities with modularity score.

#### B. Connected Components
Simple baseline for identifying isolated subgraphs.

#### C. Other Options
- **Label Propagation**: Fast, parameter-free.
- **DBSCAN**: Density-based, good for outlier detection.
- **Infomap**: Flow-based community detection.

### 5.3 Cluster Output Schema

```json
{
  "algorithm": "louvain",
  "parameters": {
    "resolution": 1.0,
    "weight_column": "weight_jaccard"
  },
  "metrics": {
    "modularity": 0.67,
    "cluster_count": 24
  },
  "clusters": [
    {
      "id": 1,
      "size": 45,
      "files": ["src/api/auth.py", ...],
      "bridge_files": ["src/api/router.py"]
    }
  ]
}
```

---

## 6. Visualization

### 6.1 Views

#### A. Impact Graph
- **Network View**: Force-directed graph centered on a selected file.
- **Impacted Files (Definition)**: The top co-changed neighbors of the focus file, ranked by Jaccard similarity from the precomputed edge table. Only files that exist at `HEAD` are included.
- **Defaults**: Top 25 edges in the graph, Top 10 impacts in the sidebar, Jaccard similarity as the displayed percentage.
- **Guidance**: When empty, prompt users to choose a valid path and suggest high-activity presets.

#### B. Folder Aggregation
- **Folder Heatmap**: Aggregate file-level edges to show folder-to-folder coupling.
- **Treemap**: Hierarchical view sized by file count/complexity and colored by coupling intensity.

#### C. Cluster Visualization
- **Cluster Graph**: High-level graph where nodes are clusters and edges represent inter-cluster coupling.
- **Drill-down**: Inspect internal structure of specific clusters.

### 6.2 Visualization API

| Endpoint | Purpose |
|----------|---------|
| `GET /repos/{repo_id}/impact/graph?path=...&top=25` | Impact graph for a file |
| `GET /repos/{repo_id}/impact?path=...&top=10` | Impacted files list (co-changed neighbors) |
| `GET /repos/{repo_id}/coupling/graph?path=...` | Coupling graph with metric filtering |
| `GET /repos/{repo_id}/files?sort_by=commits&sort_dir=desc` | High-activity files for presets |

---

## 7. API & Architecture

### 7.1 Job Execution Model

Long-running tasks are managed via a persistent SQLite job queue and processed by dedicated worker processes.

**Job Queue Schema (`jobs.sqlite`)**:
- `job_id`, `job_type` (analysis/clustering), `repo_id`, `run_id`, `state` (queued/running/complete/failed), `parameters`.

**Worker**:
- Polls `jobs.sqlite`.
- Executes tasks safely out-of-process.
- Updates status and handles failures.

### 7.2 API Structure

The API is organized hierarchically:

```
/api/v1/
├── repos/
│   ├── GET/POST/DELETE         # Repo management
│   └── {repo_id}/
│       ├── runs/
│       │   ├── GET/POST/DELETE # Run management
│       │   └── {run_id}/
│       │       ├── impact/     # Impact analysis
│       │       └── clusters/   # Clustering operations
│       └── files/              # File browsing
```

### 7.3 CI/CD Integration

The system supports a CLI mode for CI integration.

```bash
lfca ci-report \
  --repo-path=. \
  --changed-files=src/api/auth.py,src/api/jwt.py \
  --window-days=90 \
  --output=coupling-report.json
```

---

## 8. Cross-cutting Features

### 8.1 Incremental Analysis
- **Partitioned Storage**: Transactions stored by time partition (e.g., year/month).
- **Update Logic**: Only process commits newer than the last analyzed commit.
- **Recomputation**: Edges are recomputed from the updated transaction set via rolling windows or full refreshes.

### 8.2 Time-Windowed Analysis
Analysis can be restricted to specific time windows to ensure relevance.
- **Parameters**: `window_days` and `decay_half_life_days`.
- **Implementation**: Scans only relevant transaction partitions and applies decay functions before edge aggregation.

### 8.3 Multi-Branch Analysis
Supports analyzing multiple branches simultaneously.
- Configuration allows specifying `refs` list or `all_refs` flag.
- Commits are deduplicated across branches.
- Run manifest records exactly which refs were included.

### 8.4 Scalability
- **Bulk Commit Handling**: Downweighting prevents massive refactors from skewing results.
- **Algorithm Scaling**: Louvain and others selected for performance on large graphs.
- **Pagination**: Large API responses are paginated.
