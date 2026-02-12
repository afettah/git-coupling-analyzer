# End-to-End Flow Analysis: Project Creation → Analysis → Results → Clustering

**Date**: 2026-02-07  
**Scope**: Complete pipeline from API project creation through analysis execution to clustering and results retrieval

---

## 0. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                           │
│                   src/frontend/src (TypeScript)                      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTP Requests
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FastAPI Platform                                  │
│                 src/platform/code_intel/                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Routers (repos, git, analyzers, deps, semantic, etc)       │   │
│  └───────────────────┬─────────────────────────────────────────┘   │
│                      │                                               │
│  ┌───────────────────▼─────────────────────────────────────────┐   │
│  │ Orchestrator - Dispatches tasks to registered analyzers     │   │
│  └───────────────────┬─────────────────────────────────────────┘   │
│                      │                                               │
│  ┌───────────────────▼─────────────────────────────────────────┐   │
│  │ Storage - SQLite + Parquet persistence                      │   │
│  └───────────────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────────────────┘
                 │ Dispatches to analyzers
                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      Analyzer Plugins                                │
│                                                                      │
│ ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│ │  Git Analyzer    │  │  Dep Analyzer    │  │  Semantic Plugin │  │
│ │ src/git-analyzer │  │ src/dep-analyzer │  │src/semantic-analyzer
│ └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│                                                                      │
│ ┌───────────────────────────────────────────────────────────────┐  │
│ │  Project Intelligence (Integration + Risk Scoring)            │  │
│ │         src/project-intelligence/                             │  │
│ └───────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Project Creation

### 1.1 API Endpoint: `POST /repos`

**Location**: `src/platform/code_intel/routers/repos.py` (line 129)

```python
@router.post("", response_model=RepoInfo)
def create_repository(request: CreateRepoRequest) -> RepoInfo:
```

**Input**:
```python
class CreateRepoRequest(BaseModel):
    path: str              # Absolute path to git repository
    name: str | None       # Optional friendly name
    data_dir: str = "data" # Data directory root
```

**Validation Steps**:
1. Check path exists: `repo_path.exists()`
2. Check is git repository: `.git` directory OR `HEAD` file
3. Validate is not empty (implicit in git check)

### 1.2 Repository Initialization

**Location**: `src/platform/code_intel/routers/repos.py` (lines 140-167)

**Steps**:

| Step | Code | Purpose | Storage |
|------|------|---------|---------|
| 1 | `repo_id = slugify(name)` | Generate safe ID from name | Memory |
| 2 | `paths = RepoPaths(data_dir, repo_id)` | Compute directory structure | Memory |
| 3 | `paths.ensure_dirs()` | Create subdirectories | Filesystem |
| 4 | `storage = get_storage(repo_id)` | Initialize DB connection | Memory |
| 5 | `INSERT INTO repo_meta (source_path)` | Store original repo path | SQLite |
| 6 | `INSERT INTO repo_meta (name)` | Store friendly name | SQLite |
| 7 | `storage.conn.commit()` | Persist metadata | SQLite |

**Directory Structure Created**:
```
$CODE_INTEL_DATA_DIR/repos/{repo_id}/
├── mirror.git/           (empty initially)
├── code-intel.sqlite     (initialized with schema)
├── parquet/              (empty initially)
├── snapshots/            (empty initially)
└── logs/                 (empty initially)
```

**Database Initialization**:

Schema tables created (from `src/platform/code_intel/schema.py`):
- `repo_meta` - Key-value metadata
- `analysis_tasks` - Task tracking
- `entities` - Files, classes, functions, etc.
- `relationships` - Cross-analyzer results
- `git_edges` - Coupling metrics
- `git_clusters` - Clustering results
- `git_cluster_runs` - Clustering execution metadata

**Response**:
```json
{
  "id": "{repo_id}",
  "name": "{repo_name}",
  "state": "not_started"
}
```

**Timing**: ~100ms (mostly filesystem I/O)

---

## Phase 2: Analysis Execution

### 2.1 API Endpoint: `POST /repos/{repo_id}/analyzers/run`

**Location**: `src/platform/code_intel/routers/analyzers.py` (line 78)

```python
@router.post("/run")
async def run_analyzer(
    repo_id: str,
    request: AnalysisRequest,
    background_tasks: BackgroundTasks
)
```

**Input**:
```python
class AnalysisRequest(BaseModel):
    analyzer_type: str  # "git", "deps", "semantic", "intelligence"
    config: dict        # Algorithm-specific config
    data_dir: str       # Data directory
```

**Flow**:
1. Retrieve source repo path from `repo_meta`
2. Generate unique `task_id` (12-char hex)
3. Add background task via FastAPI
4. Return immediately with `task_id`

```json
{
  "task_id": "a1b2c3d4e5f6",
  "status": "queued"
}
```

**Timing**: ~50ms (immediate return, actual work in background)

---

### 2.2 Background Execution: Orchestrator

**Location**: `src/platform/code_intel/orchestrator.py` (line 13-79)

**Class**: `Orchestrator`

**Main Method**: `run_analysis(analyzer_type, repo_id, repo_path, db_path, parquet_dir, config, task_id)`

**Execution Flow**:

```
1. Create Task Entry
   ├─ storage.create_task(task)
   │  └─ INSERT INTO analysis_tasks (task_id, analyzer_type, state='PENDING', config_json)
   └─ storage.update_task(task_id, state='RUNNING', started_at=now)

2. Run Analyzer
   ├─ analyzer = registry.get_analyzer(analyzer_type)
   ├─ result = analyzer.analyze(task)  ◄─── BLOCKS HERE (execution)
   │  └─ This calls the specific plugin (see 2.3)
   └─ [Exception handling: update state to FAILED if error]

3. Persist Results
   ├─ storage.update_task(
   │  ├─ state=COMPLETED or FAILED
   │  ├─ entity_count=result.entity_count
   │  ├─ relationship_count=result.relationship_count
   │  ├─ metrics_json=result.metrics
   │  └─ finished_at=now
   └─ storage.close()
```

**Key Data Structures**:

```python
@dataclass
class AnalysisTask:
    task_id: str
    analyzer_type: str    # "git", "deps", "semantic", etc.
    repo_id: str
    repo_path: Path       # Original git repository
    db_path: Path         # code-intel.sqlite location
    parquet_dir: Path     # Parquet output directory
    config: Dict[str, Any]
```

---

### 2.3 Git Analyzer Plugin Execution

**Location**: `src/git-analyzer/git_analyzer/plugin.py`

**Class**: `GitPlugin(BaseAnalyzer)`

**Method**: `analyze(task: AnalysisTask) -> TaskResult`

**Pipeline**:

```python
# 1. Reconstruct paths from task
repo_root = task.db_path.parent
data_dir = repo_root.parent.parent
paths = RepoPaths(data_dir, task.repo_id)

# 2. Merge config
config = CouplingConfig(**filtered_config)
config.min_revisions = 5
config.max_changeset_size = 50
config.min_cooccurrence = 5
# ... (other defaults from CouplingConfig)

# 3. Dispatch to runner
result = run_analysis(
    paths=paths,
    run_id=task.task_id,
    repo_path=task.repo_path,
    config=config,
    since=config.get('since'),
    until=config.get('until')
)

# 4. Return wrapped result
return TaskResult(
    task_id=task.task_id,
    status=TaskStatus.COMPLETED,
    entity_count=result['file_count'],
    relationship_count=result['edge_count'],
    metrics=result['metrics']
)
```

---

### 2.4 Analysis Runner: Core Pipeline

**Location**: `src/git-analyzer/git_analyzer/runner.py` (line 22-100)

**Main Function**: `run_analysis(...) -> dict`

**Pipeline Stages**:

#### Stage 1: Repository Mirroring
```python
mirror_repo(repo_path, paths)
# Creates/updates: $paths/mirror.git (bare clone)
# Purpose: Provides isolated copy for analysis
# Timing: 30s-5min depending on repo size
```

**What happens**:
- If mirror doesn't exist: `git clone --mirror {repo_path} {mirror.git}`
- If exists: `git fetch origin HEAD` in mirror
- Creates bare git repository for safe analysis

#### Stage 2: History Extraction
```python
extractor = HistoryExtractor(paths, config)
stats = extractor.run(since=since, until=until, progress_callback=None)
# Returns: ExtractStats
# Writes: commits.parquet, changes.parquet
# Timing: 10s-30min depending on commit count
```

**Process**:
1. Parse git log with `iter_log(mirror_path)`
2. For each commit header + changes:
   - Create/update file entities
   - Track commit metadata (author, timestamp)
   - Record file changes (add/modify/delete/rename)
3. Compute file statistics:
   - Commit count per file
   - Author set per file
   - Line statistics per file
4. Write to Parquet:
   - `commits.parquet`: commit_oid, author, timestamp, parents, etc.
   - `changes.parquet`: file_id, commit_oid, status, path, etc.

**Key Statistics Captured**:
```python
@dataclass
class ExtractStats:
    commit_count: int = 0
    file_count: int = 0
    change_count: int = 0
    validation_issues: int = 0
    skipped_invalid_status: int = 0
    skipped_invalid_path: int = 0
    skipped_suspicious_path: int = 0
    skipped_incomplete: int = 0
    issue_samples: List[ValidationIssue] = []  # Capped at 200
```

#### Stage 3: Edge Building
```python
builder = EdgeBuilder(paths, config)
edge_count = builder.build()
# Returns: int (number of edges created)
# Writes: git_edges table in SQLite
# Timing: 5s-10min depending on coupling density
```

**Process**:
1. Load commits and changes from Parquet
2. Group changes into changesets (based on `changeset_mode`)
3. For each changeset:
   - Extract file IDs
   - Calculate weight (accounting for changeset size)
   - Enumerate all file pairs
4. Filter pairs by `min_cooccurrence` threshold
5. Calculate coupling metrics:
   - `jaccard`: |A∩B| / |A∪B|
   - `jaccard_weighted`: Same but weighted by changeset frequency
   - `p_dst_given_src`: P(B changed | A changed)
   - `p_src_given_dst`: P(A changed | B changed)
   - `pair_count`: Raw co-occurrence count
6. Store edges in `git_edges` table

**Edge Metrics Formula**:
```
For files A and B that changed together:

pair_count(A,B) = Σ weight of all changesets containing both

jaccard(A,B) = pair_count(A,B) / 
               (count_A + count_B - pair_count(A,B))

p_dst_given_src(A,B) = pair_count(A,B) / count_A

where count_X = changesets containing file X
```

#### Stage 4: Results Summary
```python
metrics = {
    "commit_count": stats.commit_count,
    "git_head_oid": head_oid,
    "edge_count": edge_count,
    "validation_issues": stats.validation_issues,
    # ... skipped counts
}

return {
    "run_id": run_id,
    "state": "complete",
    "commit_count": stats.commit_count,
    "file_count": stats.file_count,
    "edge_count": edge_count,
    "metrics": metrics
}
```

**Timing Summary** (for typical 1000-file, 10K-commit repo):
- Mirror: 1-5 minutes
- Extract: 10-30 seconds
- Build edges: 5-15 seconds
- **Total**: 1-6 minutes

---

## Phase 3: Results Retrieval & Querying

### 3.1 Task Status Endpoint

**Location**: `src/platform/code_intel/routers/analyzers.py` (line 158)

```python
@router.get("/repos/{repo_id}/analyzers/tasks/{task_id}")
async def get_task_status(repo_id: str, task_id: str, data_dir: str = "data")
```

**Query**:
```sql
SELECT task_id, analyzer_type, state, started_at, finished_at, error
FROM analysis_tasks 
WHERE task_id = ?
```

**Response States**:
- `PENDING` - In queue
- `RUNNING` - Currently executing
- `COMPLETED` - Success
- `FAILED` - Error with message

**Timing**: ~100ms (single index lookup)

---

### 3.2 File & Coupling Data Retrieval

#### 3.2.1 Get File Details

**Location**: `src/git-analyzer/git_analyzer/api.py` (line 180)

```python
def get_file_details(self, db_path: Path, parquet_dir: Path, file_path: str) -> dict:
```

**Query Chain**:

1. **Get file entity**:
```sql
SELECT entity_id, qualified_name, exists_at_head, metadata_json
FROM entities 
WHERE qualified_name = ? AND kind = 'file'
```

2. **Get coupling stats**:
```sql
SELECT 
    COUNT(*) as coupled_count,
    MAX(jaccard) as max_coupling,
    AVG(jaccard) as avg_coupling
FROM git_edges
WHERE src_entity_id = ? OR dst_entity_id = ?
```

**Response**:
```json
{
  "file_id": 123,
  "path": "src/module/file.py",
  "exists_at_head": true,
  "total_commits": 45,
  "authors_count": 3,
  "total_lines_added": 1250,
  "total_lines_deleted": 340,
  "churn_rate": 35.5,
  "coupled_files_count": 12,
  "max_coupling": 0.65,
  "avg_coupling": 0.28,
  "risk_score": 62.3  // Calculated: commits (30) + coupling (30) + authors (2) + churn (0.3)
}
```

**Risk Score Calculation** (lines 253-259):
```
risk_score = min(
    (commits / 10) * 30        // Commit frequency: 0-30
    + coupling * 30            // Coupling strength: 0-30
    + min(authors * 5, 20)     // Multiple authors: 0-20
    + min(churn / 50, 20),     // High churn: 0-20
    100                        // Cap at 100
)
```

#### 3.2.2 Get File Coupling

**Location**: `src/git-analyzer/git_analyzer/api.py` (line 33)

```python
def get_file_coupling(
    self, db_path: Path, file_path: str,
    *, metric: str = "jaccard", min_weight: float = 0.0, limit: int = 50
) -> list[dict]
```

**Query**:
```sql
SELECT 
    e.qualified_name as path,
    g.pair_count,
    g.{metric} as weight,
    g.jaccard, g.jaccard_weighted, g.p_dst_given_src, g.p_src_given_dst
FROM git_edges g
JOIN entities e ON g.dst_entity_id = e.entity_id
WHERE g.src_entity_id = ? 
  AND g.{metric} >= ?
ORDER BY g.{metric} DESC
LIMIT ?
```

**Parameters**:
- `metric`: "jaccard" (default), "jaccard_weighted", "p_dst_given_src", "p_src_given_dst", "pair_count"
- `min_weight`: Filter threshold (default 0.0, recommended 0.1 for production)
- `limit`: Result set size (default 50, max recommended 200)

**Response**:
```json
[
  {
    "path": "src/module/other_file.py",
    "pair_count": 12,
    "weight": 0.65,
    "jaccard": 0.65,
    "jaccard_weighted": 0.68,
    "p_dst_given_src": 0.80,
    "p_src_given_dst": 0.60
  },
  ...
]
```

**Timing**: ~500ms (depends on coupling density)

#### 3.2.3 Get Hotspots

**Location**: `src/git-analyzer/git_analyzer/api.py` (line 266)

```python
def get_hotspots(
    self, db_path: Path, parquet_dir: Path,
    *, limit: int = 50, sort_by: str = "risk_score"
) -> list[dict]
```

**Query** (lines 281-297):
```sql
SELECT 
    e.entity_id,
    e.qualified_name as path,
    CAST(json_extract(e.metadata_json, '$.total_commits') AS INTEGER) as total_commits,
    CAST(json_extract(e.metadata_json, '$.authors_count') AS INTEGER) as authors_count,
    CAST(json_extract(e.metadata_json, '$.total_lines_added') AS INTEGER) as lines_added,
    CAST(json_extract(e.metadata_json, '$.total_lines_deleted') AS INTEGER) as lines_deleted,
    COALESCE(AVG(g.jaccard), 0) as avg_coupling,
    COUNT(DISTINCT g.dst_entity_id) as coupled_files
FROM entities e
LEFT JOIN git_edges g ON (e.entity_id = g.src_entity_id OR e.entity_id = g.dst_entity_id)
WHERE e.exists_at_head = 1 AND e.kind = 'file'
GROUP BY e.entity_id, e.qualified_name
```

**Risk Calculation** (lines 314-318):
```
commit_score = (commits / max_commits) * 40
coupling_score = (coupling / max_coupling) * 30
complexity_score = min(authors * 5, 20) + min(coupled_count / 10, 10)
risk_score = min(commit_score + coupling_score + complexity_score, 100)
```

**Sort Options**:
- `risk_score` (default)
- `total_commits`
- `coupling`
- `authors`
- `lines_changed`

**Response**:
```json
[
  {
    "file_id": 45,
    "path": "src/core/engine.py",
    "total_commits": 89,
    "coupling": 0.52,
    "riskScore": 78.5,
    "authors": 5,
    "linesChanged": 3450,
    "coupledFiles": 18
  },
  ...
]
```

**Timing**: 1-3 seconds (full table scan with aggregation)

---

## Phase 4: Clustering

### 4.1 Clustering Endpoint

**Location**: `src/platform/code_intel/routers/git.py` (line 627)

```python
@router.post("/repos/{repo_id}/git/clustering/run")
async def run_clustering(repo_id: str, request: ClusterRequest, data_dir: str = "data")
```

**Input**:
```python
class ClusterRequest(BaseModel):
    algorithm: str = "louvain"        # "louvain", "dbscan", "hierarchical", "components"
    weight_column: str = "jaccard"    # Metric to use
    min_weight: float = 0.1           # Edge filtering threshold
    folders: list[str] = []           # Optional scope restriction
    params: dict = {}                 # Algorithm-specific params
```

### 4.2 Clustering Execution

**Location**: `src/git-analyzer/git_analyzer/api.py` (line 466)

```python
def run_clustering(
    self, db_path: Path,
    *, algorithm: str = "louvain",
    weight_column: str = "jaccard",
    min_weight: float = 0.1,
    folders: list[str] | None = None,
    params: dict | None = None
) -> dict
```

**Execution Flow**:

#### Step 1: Load Graph
```python
# Query edges with weight filter
query = f"""
    SELECT src_entity_id, dst_entity_id, {weight_column}
    FROM git_edges
    WHERE {weight_column} >= ?
"""
rows = storage.conn.execute(query, (min_weight,)).fetchall()
# Result: List[(src_id, dst_id, weight), ...]
```

#### Step 2: Load Node Metadata
```python
query = """
    SELECT entity_id, qualified_name 
    FROM entities 
    WHERE exists_at_head = 1 AND kind = 'file'
"""
files_rows = storage.conn.execute(query).fetchall()
file_map = {r[0]: r[1] for r in files_rows}  # file_id -> path
file_ids = set(file_map.keys())
```

#### Step 3: Build Edge List
```python
edges = []
for src_id, dst_id, weight in rows:
    if src_id in file_ids and dst_id in file_ids:
        edges.append({
            "src_file_id": src_id,
            "dst_file_id": dst_id,
            weight_column: weight,
        })
```

#### Step 4: Run Algorithm
```python
from git_analyzer.clustering.registry import get_algorithm

algo = get_algorithm(algorithm)  # Get registered algorithm instance
result = algo.run(edges, file_ids, file_map, valid_params)
# Returns: ClusterResult
```

### 4.3 Clustering Algorithms

#### Algorithm 1: Louvain (Community Detection)

**Location**: `src/git-analyzer/git_analyzer/clustering/louvain.py`

**Parameters**:
```python
{
    "resolution": {
        "type": "number",
        "default": 1.0,
        "description": "Resolution parameter for modularity optimization"
    }
}
```

**How it works**:
- Uses modularity optimization (networkx.algorithms.community.louvain_communities)
- `resolution=1.0`: Balance between granular & coarse clusters
- Higher: More fine-grained clusters
- Lower: Larger community merging

**Timing**: O(V + E log V) → 5-30 seconds for typical repo

#### Algorithm 2: DBSCAN (Density-Based)

**Location**: `src/git-analyzer/git_analyzer/clustering/dbscan.py`

**Parameters**:
```python
{
    "eps": {
        "type": "number",
        "default": 0.5,
        "description": "Maximum distance (1 - similarity)"
    },
    "min_samples": {
        "type": "integer",
        "default": 2,
        "description": "Minimum samples in neighborhood"
    }
}
```

**Algorithm**:
1. Build distance matrix: `distance = 1 - weight`
2. Run sklearn DBSCAN with `eps` and `min_samples`
3. Mark `-1` label as noise (isolated files)

**Timing**: O(n²) memory for n files → Critical for large projects

#### Algorithm 3: Hierarchical Clustering

**Location**: `src/git-analyzer/git_analyzer/clustering/hierarchical.py`

**Parameters**:
```python
{
    "linkage": {
        "type": "string",
        "enum": ["ward", "complete", "average", "single"],
        "default": "ward"
    },
    "distance_threshold": {
        "type": "number",
        "default": 0.5
    }
}
```

**Timing**: O(n³) worst case → Use for <500 files

#### Algorithm 4: Connected Components

**Location**: `src/git-analyzer/git_analyzer/clustering/components.py`

**Parameters**:
```python
{
    "min_weight": {
        "type": "number",
        "default": 0.1,
        "description": "Minimum edge weight to include"
    }
}
```

**How it works**:
- Union-Find data structure
- Connect files with edges above `min_weight`
- Components = connected subgraphs

**Timing**: O(V + E * α(V)) → <1 second even for large graphs

### 4.4 Persistence: Save Clustering Results

**Location**: `src/git-analyzer/git_analyzer/api.py` (line 513)

**Steps**:

```python
# 1. Create run metadata
run_id = str(uuid.uuid4())
with storage.transaction():
    # Save run metadata
    storage.conn.execute("""
        INSERT INTO git_cluster_runs (run_id, algorithm, params_json, cluster_count)
        VALUES (?, ?, ?, ?)
    """, (run_id, algorithm, json.dumps(params), result.cluster_count))
    
    # 2. Save cluster members
    for cluster_id, cluster_data in enumerate(result.clusters, start=1):
        # Insert cluster
        storage.conn.execute("""
            INSERT INTO git_clusters (run_id, label, size)
            VALUES (?, ?, ?)
        """, (run_id, cluster_id, cluster_data['size']))
        
        # Insert members
        for file_id in cluster_data['file_ids']:
            storage.conn.execute("""
                INSERT INTO git_cluster_members (run_id, cluster_id, entity_id)
                VALUES (?, ?, ?)
            """, (run_id, cluster_id, file_id))
```

**Tables Updated**:
- `git_cluster_runs`: Run metadata (algorithm, parameters, timestamp)
- `git_clusters`: Cluster summary (run_id, label, size)
- `git_cluster_members`: Membership (run_id, cluster_id, file_id)

### 4.5 Clustering Snapshots (Save for Later)

**Location**: `src/platform/code_intel/routers/git.py` (line 643)

```python
@router.post("/repos/{repo_id}/git/clustering/snapshots")
async def save_clustering_snapshot(repo_id: str, body: dict, data_dir: str = "data")
```

**Input**:
```json
{
  "name": "Production Modules - v1",
  "result": { /* full ClusterResult */ },
  "tags": ["production", "reviewed"]
}
```

**Storage**:
```sql
INSERT INTO git_clustering_snapshots 
  (id, name, algorithm, result_json, tags_json, created_at)
VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
```

**Response**:
```json
{
  "id": "snap_a1b2c3d4e5f6",
  "status": "saved"
}
```

### 4.6 Retrieve Clustering Results

#### Get Available Algorithms

**Endpoint**: `GET /repos/{repo_id}/git/clustering/algorithms`

**Response**:
```json
[
  {
    "name": "louvain",
    "display_name": "Louvain Community Detection",
    "params": { /* schema */ }
  },
  {
    "name": "dbscan",
    "display_name": "DBSCAN Clustering",
    "params": { /* schema */ }
  },
  ...
]
```

#### List Clustering Snapshots

**Endpoint**: `GET /repos/{repo_id}/git/clustering/snapshots`

**Query**:
```sql
SELECT id, name, algorithm, created_at, result_json, tags_json 
FROM git_clustering_snapshots 
ORDER BY created_at DESC
```

**Response**:
```json
[
  {
    "id": "snap_abc123",
    "name": "Production Modules",
    "algorithm": "louvain",
    "created_at": "2026-02-07T12:00:00Z",
    "cluster_count": 8,
    "tags": ["production", "reviewed"]
  },
  ...
]
```

#### Get Single Clustering Snapshot

**Endpoint**: `GET /repos/{repo_id}/git/clustering/snapshots/{snapshot_id}`

**Query**:
```sql
SELECT name, result_json 
FROM git_clustering_snapshots 
WHERE id = ?
```

**Response**:
```json
{
  "name": "Production Modules",
  "result": {
    "algorithm": "louvain",
    "parameters": { "resolution": 1.0 },
    "cluster_count": 8,
    "clusters": [
      {
        "id": 1,
        "size": 23,
        "file_ids": [1, 5, 7, ...],
        "files": ["src/core/engine.py", "src/core/parser.py", ...]
      },
      ...
    ],
    "metrics": { /* algorithm-specific */ }
  }
}
```

---

## Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend: POST /repos { path: "/path/to/repo" }            │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ Repos Router: create_repository()                           │
│ ✓ Validate git repo exists                                  │
│ ✓ Create repo_id from name                                  │
│ ✓ Initialize directories & SQLite schema                    │
│ ✓ Store source_path & name in repo_meta                     │
└──────────────┬──────────────────────────────────────────────┘
               │ Return immediately
               ▼
     ┌─────────────────────┐
     │ repo_id: abc123     │
     │ state: not_started  │
     └─────────────────────┘
               │
               │ (Later) Frontend: POST /repos/abc123/analyzers/run
               │         { analyzer_type: "git", config: {...} }
               ▼
┌─────────────────────────────────────────────────────────────┐
│ Analyzers Router: run_analyzer()                            │
│ ✓ Retrieve source repo path                                 │
│ ✓ Generate task_id                                          │
│ ✓ Add background task                                       │
│ ✓ Return task_id (ASYNC)                                    │
└──────────────┬──────────────────────────────────────────────┘
               │ Return task_id immediately
               ▼
     ┌──────────────────────┐
     │ task_id: 1a2b3c4d5e6f│
     │ status: queued       │
     └──────────────────────┘
               │
               │ (Background) Orchestrator.run_analysis()
               ▼
    ┌──────────────────────────────────────────┐
    │ 1. Create task entry in DB               │
    │ 2. Set state = RUNNING                   │
    │ 3. Get analyzer from registry            │
    │ 4. Call analyzer.analyze(task)           │
    └──────────┬───────────────────────────────┘
               │
               ▼
    ┌──────────────────────────────────────────┐
    │ GitPlugin.analyze(task)                  │
    │ → run_analysis(paths, config)            │
    └──────────┬───────────────────────────────┘
               │
      ┌────────┴────────┬──────────────┬──────────────┐
      │                 │              │              │
      ▼                 ▼              ▼              ▼
    ┌──┐        ┌──────────┐   ┌─────────────┐   ┌────────┐
    │  │        │          │   │             │   │        │
    │ 1│        │    2     │   │      3      │   │   4    │
    │  │        │          │   │             │   │        │
    └──┘        └──────────┘   └─────────────┘   └────────┘
  Mirror      Extract         Build Edges      Results
  Repo        History         & Metrics        Summary

    │                 │              │              │
    │                 │              │              │
    └────────┬────────┴──────────────┴──────────────┘
             │
             ▼
    ┌──────────────────────────────────────────┐
    │ Storage: Update task status to COMPLETED │
    │ - entity_count = file_count              │
    │ - relationship_count = edge_count        │
    │ - metrics_json = {...}                   │
    └─────────┬────────────────────────────────┘
              │
              ▼
    (Frontend polls) GET /repos/abc123/analyzers/tasks/1a2b3c4d5e6f
              │
              ▼
    ┌──────────────────────────────────────────┐
    │ { state: "COMPLETED",                    │
    │   entity_count: 1023,                    │
    │   relationship_count: 8456,              │
    │   metrics: {...} }                       │
    └──────────┬───────────────────────────────┘
               │
               │ (Later) GET /repos/abc123/git/files/{file_id}/details
               ▼
    ┌──────────────────────────────────────────┐
    │ Files & Coupling Data Retrieved          │
    │ ✓ File stats from entities + metadata    │
    │ ✓ Coupling from git_edges                │
    │ ✓ Risk scores computed on-the-fly       │
    └──────────┬───────────────────────────────┘
               │
               │ (Later) POST /repos/abc123/git/clustering/run
               │         { algorithm: "louvain", ... }
               ▼
    ┌──────────────────────────────────────────┐
    │ Clustering Execution                     │
    │ 1. Load edges (filter by min_weight)     │
    │ 2. Load file metadata                    │
    │ 3. Run clustering algorithm              │
    │ 4. Persist to git_clusters* tables       │
    └──────────┬───────────────────────────────┘
               │
               ▼
    ┌──────────────────────────────────────────┐
    │ {                                        │
    │   "algorithm": "louvain",                │
    │   "cluster_count": 8,                    │
    │   "clusters": [                          │
    │     { "id": 1, "size": 23, ... },        │
    │     { "id": 2, "size": 18, ... },        │
    │     ...                                  │
    │   ]                                      │
    │ }                                        │
    └─────────────────────────────────────────┘
```

---

## Key Performance Characteristics

### Database Query Patterns

| Query | Indexed Column | Result Time | Scale |
|-------|----------------|-------------|-------|
| Entity by qualified_name | YES | <10ms | Linear |
| Git edges by entity | YES | 10-100ms | Linear |
| File coupling (limit 50) | YES | 50-200ms | Constant |
| Hotspots (full scan) | NO | 1-5s | Quadratic |
| Clustering snapshot load | YES | 5-50ms | Linear |

### Memory Usage by Phase

| Phase | Typical 1000-file repo | Factor |
|-------|------------------------|--------|
| Mirroring | Streaming I/O | No memory overhead |
| Extraction | 20-40 MB | Parquet + staging tables |
| Edge building | 10-30 MB | Pair counts + metrics |
| DBSCAN clustering | 4 MB (1000²) | O(n²) matrix |
| Results in memory | <1 MB | Per-query result set |

### Bottlenecks & Optimization

| Bottleneck | Cause | Mitigation |
|-----------|-------|-----------|
| DBSCAN memory | O(n²) distance matrix | Use min_weight filter, switch to components/louvain |
| JSON extraction in WHERE | No native indexing | Denormalize to columns |
| Hotspot full scan | No metadata index | Add composite index on (exists_at_head, kind) |
| Large changeset penalty | Weight *= 1/log(n) | Adjust max_changeset_size for domain |
| Git log parsing | Subprocess communication | Increase chunk_size to 2-4MB for large repos |

---

## Summary

### Complete Call Stack

```
POST /repos
  → create_repository()
    → RepoPaths.ensure_dirs()
    → Storage.init_database()
    → INSERT repo_meta

POST /repos/{id}/analyzers/run
  → run_analyzer()
    → BackgroundTasks.add_task()
    → Orchestrator.run_analysis()
      → registry.get_analyzer("git")
      → GitPlugin.analyze()
        → run_analysis() [git_analyzer.runner]
          → mirror_repo()
          → HistoryExtractor.run()
            → iter_log() [git subprocess]
            → Parquet writes (commits, changes)
          → EdgeBuilder.build()
            → Changeset grouping
            → Coupling metric calculation
            → git_edges INSERT
        → Storage.update_task(COMPLETED)

GET /repos/{id}/analyzers/tasks/{task_id}
  → get_task_status()
    → Storage.get_task()
      → SELECT FROM analysis_tasks

POST /repos/{id}/git/clustering/run
  → run_clustering()
    → GitAPI.run_clustering()
      → Load edges from git_edges
      → Load nodes from entities
      → get_algorithm(name).run()
        → Louvain|DBSCAN|Hierarchical|Components.run()
      → Storage.transaction()
        → INSERT git_cluster_runs
        → INSERT git_clusters
        → INSERT git_cluster_members

GET /repos/{id}/git/clustering/snapshots
  → list_clustering_snapshots()
    → SELECT FROM git_clustering_snapshots
```

### Data Persistence Timeline

```
T0: Create project
    ↓ repo_meta created

T0+: Run analysis (async)
    ↓ analysis_tasks: PENDING
    ↓ analysis_tasks: RUNNING
    ↓ commits.parquet written
    ↓ changes.parquet written
    ↓ entities table populated
    ↓ git_edges table populated
    ↓ analysis_tasks: COMPLETED

T1+: Query results
    ↓ SELECT from entities
    ↓ SELECT from git_edges
    ↓ Risk scores computed

T2+: Run clustering
    ↓ git_cluster_runs created
    ↓ git_clusters created
    ↓ git_cluster_members populated

T3+: Save snapshot
    ↓ git_clustering_snapshots created
```

