# LFCA End-to-End Test Scenarios

> **Version**: 2.0  
> **Status**: Active  
> **Date**: 2026-02-01  
> **Reference Repository**: OpenHands (`/home/afettah/workspace/git-coupling-analyzer/tmp/OpenHands`)  
> **API Server**: `http://localhost:8000`  
> **Frontend**: `http://localhost:5173`
> **QA Data Reference**: `/home/afettah/workspace/git-coupling-analyzer/QA/output/openhands/`

---

## Table of Contents

1. [Test Environment Setup](#1-test-environment-setup)
2. [E2E Scenario 1: Complete Project Lifecycle](#2-e2e-scenario-1-complete-project-lifecycle)
3. [E2E Scenario 2: File Exploration & Details](#3-e2e-scenario-2-file-exploration--details)
4. [E2E Scenario 3: Coupling Analysis Deep Dive](#4-e2e-scenario-3-coupling-analysis-deep-dive)
5. [E2E Scenario 4: Clustering - All Algorithms](#5-e2e-scenario-4-clustering---all-algorithms)
6. [E2E Scenario 5: Snapshot Management](#6-e2e-scenario-5-snapshot-management)
7. [E2E Scenario 6: Error Handling & Edge Cases](#7-e2e-scenario-6-error-handling--edge-cases)
8. [E2E Scenario 7: Business Use Cases - Identifying Hidden Dependencies](#8-e2e-scenario-7-business-use-cases---identifying-hidden-dependencies)
9. [E2E Scenario 8: Test-Implementation Coupling Analysis](#9-e2e-scenario-8-test-implementation-coupling-analysis)
10. [E2E Scenario 9: Module & Cross-Module Analysis](#10-e2e-scenario-9-module--cross-module-analysis)
11. [E2E Scenario 10: Hotspot & Change Impact Analysis](#11-e2e-scenario-10-hotspot--change-impact-analysis)
12. [E2E Scenario 11: Author & Knowledge Distribution](#12-e2e-scenario-11-author--knowledge-distribution)
13. [E2E Scenario 12: File Rename & Lineage Tracking](#13-e2e-scenario-12-file-rename--lineage-tracking)
14. [E2E Scenario 13: Integration Coupling Patterns](#14-e2e-scenario-13-integration-coupling-patterns)
15. [Expected Results Reference](#15-expected-results-reference)
16. [OpenHands Ground Truth Data](#16-openhands-ground-truth-data)
17. [API Endpoint Quick Reference](#17-api-endpoint-quick-reference)

---

## 1. Test Environment Setup
```

### Test Repository

- **Path**: `/home/afettah/workspace/git-coupling-analyzer/tmp/OpenHands`
- **Analyses**: Detailed analysis of the proejct are in /home/afettah/workspace/git-coupling-analyzer/QA
- **Expected Commits**: ~5,971 total (5,970 non-merge)
- **Expected Files at HEAD**: ~2,765
- **Expected Edges (min_cooccurrence=5)**: ~400-500
- **Unique Authors**: 459
- **Total Renames Detected**: 1,541

### OpenHands Repository Overview

OpenHands is a large-scale AI coding agent project with the following structure:

| Component | File Count | Commit Activity | Description |
|-----------|------------|-----------------|-------------|
| `openhands/` | 570 | 1,843 commits | Core Python backend |
| `frontend/` | 1,024 | 1,812 commits | React/TypeScript UI |
| `tests/` | 218 | 979 commits | Test suite |
| `enterprise/` | 421 | 183 commits | Enterprise features |
| `evaluation/` | 328 | 408 commits | Benchmark & evaluation |
| `.github/` | 22 | 438 commits | CI/CD workflows |
| `containers/` | 11 | 171 commits | Docker configuration |

### Key File Types

| Type | Count | Description |
|------|-------|-------------|
| Python | 1,254 | Backend, tests, scripts |
| TypeScript/JavaScript | 958 | Frontend components |
| Tests | 526 | Unit & integration tests |
| Markdown | 138 | Documentation |

---

## 2. E2E Scenario 1: Complete Project Lifecycle

### Step 1.1: Create New Project

| Step | Action | API Call | Expected Result |
|------|--------|----------|-----------------|
| 1 | Click "New Project" button | - | Modal opens |
| 2 | Enter path | - | Path field accepts `/home/afettah/workspace/git-coupling-analyzer/tmp/OpenHands` |
| 3 | Enter name "OpenHands" | - | Name accepted |
| 4 | Click "Create" | `POST /repos` | Modal closes |

**API Request:**
```bash
curl -X POST "http://localhost:8000/repos" \
  -H "Content-Type: application/json" \
  -d '{"path": "/home/afettah/workspace/git-coupling-analyzer/tmp/OpenHands", "name": "OpenHands"}'
```

**Expected Response:**
```json
{
  "id": "openhands",
  "name": "OpenHands",
  "state": "not_started",
  "file_count": 0,
  "commit_count": 0
}
```

**Must-See Numbers:**
- `state` = `"not_started"`
- `file_count` = `0`
- `commit_count` = `0`

---

### Step 1.2: List Repositories

| Step | Action | API Call | Expected Result |
|------|--------|----------|-----------------|
| 1 | View repo list | `GET /repos` | OpenHands appears in list |

**API Request:**
```bash
curl "http://localhost:8000/repos"
```

**Expected Response:**
```json
[
  {
    "id": "openhands",
    "name": "openhands",
    "state": "not_started",
    "file_count": 0,
    "commit_count": 0
  }
]
```

---

### Step 1.3: Start Analysis

| Step | Action | API Call | Expected Result |
|------|--------|----------|-----------------|
| 1 | Click "Analyze" button | `POST /repos/openhands/analysis/start` | Analysis starts |
| 2 | Poll status | `GET /repos/openhands/analysis/status` | Progress updates |
| 3 | Wait for completion | - | State becomes "complete" |

**API Request (Start):**
```bash
curl -X POST "http://localhost:8000/repos/openhands/analysis/start" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Status Polling:**
```bash
# Poll every 5 seconds
curl "http://localhost:8000/repos/openhands/analysis/status"
```

**Expected Status During Analysis:**
```json
{
  "state": "running",
  "stage": "extract",
  "progress": 45,
  "commit_count": 2500,
  "file_count": 0,
  "edge_count": 0
}
```

**Expected Status After Completion:**
```json
{
  "state": "complete",
  "stage": "done",
  "progress": 100,
  "commit_count": 5844,
  "file_count": 1462,
  "edge_count": 410
}
```

**Must-See Numbers (Approximate):**
| Metric | Expected Range | Notes |
|--------|----------------|-------|
| `commit_count` | 5,800 - 5,900 | Excludes bulk commits (>50 files) |
| `file_count` | 1,400 - 1,500 | Files with ≥5 commits only |
| `edge_count` | 400 - 500 | Pairs with ≥5 co-occurrences |

---

### Step 1.4: Verify Analysis Artifacts

**Check Database:**
```bash
sqlite3 data/repos/openhands/lfca.sqlite << 'EOF'
.headers on
.mode column

-- File counts
SELECT 
  COUNT(*) as total_files,
  SUM(exists_at_head) as current_files
FROM files;

-- Edge counts
SELECT COUNT(*) as edge_count FROM edges;

-- Top coupled pairs
SELECT 
  f1.path_current as file_a,
  f2.path_current as file_b,
  e.jaccard,
  e.pair_count
FROM edges e
JOIN files f1 ON e.src_file_id = f1.file_id
JOIN files f2 ON e.dst_file_id = f2.file_id
ORDER BY e.jaccard DESC
LIMIT 5;
EOF
```

**Expected Output:**
```
total_files  current_files
-----------  -------------
1462         454

edge_count
----------
410

file_a                          file_b                           jaccard     pair_count
------------------------------  -------------------------------  ----------  ----------
package.json                    package-lock.json                0.94        45
openhands/core/translation.json openhands/declaration.d.ts       0.67        12
docker-compose.yml              compose.yml                      0.69        8
```

---

### Step 1.5: Delete Repository

| Step | Action | API Call | Expected Result |
|------|--------|----------|-----------------|
| 1 | Click delete button | - | Confirmation modal |
| 2 | Confirm deletion | `DELETE /repos/openhands` | Repo removed |
| 3 | Verify list | `GET /repos` | Empty list |

**API Request:**
```bash
curl -X DELETE "http://localhost:8000/repos/openhands"
```

**Expected Response:**
```json
{
  "status": "deleted",
  "repo_id": "openhands"
}
```

**Verification:**
- Repo moved to `data/deleted/openhands_YYYYMMDD_HHMMSS/`
- `GET /repos` returns empty array

---

## 3. E2E Scenario 2: File Exploration & Details

### Prerequisites
- OpenHands project created and analyzed (re-run Step 1.1-1.3 if deleted)

### Step 2.1: Get File Tree

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/files/tree"
```

**Expected Response Structure:**
```json
{
  "name": "",
  "path": "",
  "children": [
    {
      "name": "openhands",
      "path": "openhands",
      "type": "folder",
      "file_count": 245,
      "total_commits": 3500,
      "children": [...]
    },
    {
      "name": "tests",
      "path": "tests",
      "type": "folder",
      "file_count": 120,
      "total_commits": 1200,
      "children": [...]
    }
  ]
}
```

**Must-See Elements:**
- Root level folders: `openhands/`, `tests/`, `frontend/`, `docs/`
- Each folder has `file_count` and `total_commits`
- Nested structure is properly formed

---

### Step 2.2: List Files with Sorting & Filtering

**API Request (Top 10 by commits):**
```bash
curl "http://localhost:8000/repos/openhands/files?sort_by=commits&sort_dir=desc&limit=10"
```

**Expected Response:**
```json
[
  {
    "file_id": 135,
    "path": "pyproject.toml",
    "exists_at_head": true,
    "total_commits": 287
  },
  {
    "file_id": 134,
    "path": "package.json",
    "exists_at_head": true,
    "total_commits": 156
  },
  {
    "file_id": 89,
    "path": "openhands/core/main.py",
    "exists_at_head": true,
    "total_commits": 142
  }
]
```

**Must-See:**
- Files sorted by `total_commits` descending
- `pyproject.toml` or similar config file should be top 3
- All returned files have `exists_at_head: true`

**API Request (Search for test files):**
```bash
curl "http://localhost:8000/repos/openhands/files?q=test&limit=20"
```

**Expected:** Only files containing "test" in path

---

### Step 2.3: Get File Details

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/files/pyproject.toml/details"
```

**Expected Response:**
```json
{
  "file_id": 135,
  "path": "pyproject.toml",
  "exists_at_head": true,
  "total_commits": 287,
  "first_commit_date": "2024-01-15T10:30:00",
  "last_commit_date": "2026-01-30T15:45:00",
  "coupled_files": [
    {
      "file_id": 134,
      "path": "package.json",
      "jaccard": 0.35,
      "jaccard_weighted": 0.42,
      "pair_count": 45,
      "p_dst_given_src": 0.15,
      "p_src_given_dst": 0.28
    },
    {
      "file_id": 201,
      "path": "poetry.lock",
      "jaccard": 0.68,
      "jaccard_weighted": 0.71,
      "pair_count": 89,
      "p_dst_given_src": 0.31,
      "p_src_given_dst": 0.89
    }
  ],
  "lineage": []
}
```

**Must-See Metrics:**
| Field | Expected Range | Description |
|-------|----------------|-------------|
| `jaccard` | 0.0 - 1.0 | Set overlap ratio |
| `jaccard_weighted` | 0.0 - 1.0 | Weighted by changeset size |
| `p_dst_given_src` | 0.0 - 1.0 | P(other file | this file changes) |
| `p_src_given_dst` | 0.0 - 1.0 | P(this file | other file changes) |
| `pair_count` | ≥ 5 | Raw co-occurrence count |

---

### Step 2.4: Get File History

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/files/openhands/core/main.py/history?limit=5"
```

**Expected Response:**
```json
{
  "file_id": 89,
  "path": "openhands/core/main.py",
  "commits": [
    {
      "commit_oid": "abc123...",
      "author_name": "Developer",
      "author_date": "2026-01-30T10:00:00",
      "message": "Fix bug in main initialization"
    }
  ],
  "renames": []
}
```

---

### Step 2.5: Get File Lineage (Rename History)

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/files/openhands/core/main.py/lineage"
```

**Expected Response (if file was renamed):**
```json
[
  {
    "commit_oid": "def456...",
    "old_path": "openhands/main.py",
    "new_path": "openhands/core/main.py",
    "commit_date": "2025-06-15T08:30:00"
  }
]
```

---

### Step 2.6: Get File Activity

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/files/pyproject.toml/activity"
```

**Expected Response:**
```json
{
  "file_id": 135,
  "path": "pyproject.toml",
  "monthly_activity": [
    {"month": "2026-01", "commits": 12},
    {"month": "2025-12", "commits": 8},
    {"month": "2025-11", "commits": 15}
  ],
  "weekly_activity": [
    {"week": "2026-W04", "commits": 3},
    {"week": "2026-W03", "commits": 5}
  ]
}
```

---

### Step 2.7: Get File Authors

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/files/pyproject.toml/authors"
```

**Expected Response:**
```json
{
  "file_id": 135,
  "path": "pyproject.toml",
  "authors": [
    {"name": "Developer A", "email": "dev@example.com", "commit_count": 45},
    {"name": "Developer B", "email": "devb@example.com", "commit_count": 23}
  ]
}
```

---

### Step 2.8: Get Folder Details

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/folders/openhands%2Fcore/details"
```

**Expected Response:**
```json
{
  "path": "openhands/core",
  "file_count": 35,
  "total_commits": 1250,
  "authors": [
    {"name": "Developer A", "commit_count": 450}
  ],
  "coupling_stats": {
    "internal_edges": 45,
    "external_edges": 23,
    "avg_internal_coupling": 0.42
  }
}
```

---

## 4. E2E Scenario 3: Coupling Analysis Deep Dive

### Step 3.1: Get Coupled Files for a Path

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/coupling?path=package.json&limit=10"
```

**Expected Response:**
```json
[
  {
    "file_id": 134,
    "path": "package-lock.json",
    "pair_count": 45,
    "jaccard": 0.94,
    "jaccard_weighted": 0.92,
    "p_dst_given_src": 0.95,
    "p_src_given_dst": 0.93
  },
  {
    "file_id": 201,
    "path": "openhands/package.json",
    "pair_count": 12,
    "jaccard": 0.15,
    "jaccard_weighted": 0.18,
    "p_dst_given_src": 0.25,
    "p_src_given_dst": 0.12
  }
]
```

**Must-See Coupling Pairs:**
| File A | File B | Expected Jaccard |
|--------|--------|------------------|
| `package.json` | `package-lock.json` | > 0.9 |
| `pyproject.toml` | `poetry.lock` | > 0.6 |
| `docker-compose.yml` | `compose.yml` | > 0.5 |

---

### Step 3.2: Get Coupling Graph

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/coupling/graph?path=package.json&limit=15"
```

**Expected Response:**
```json
{
  "focus_id": 134,
  "focus_path": "package.json",
  "nodes": [
    {"id": 134, "path": "package.json", "commits": 156, "is_focus": true},
    {"id": 135, "path": "package-lock.json", "commits": 148, "is_focus": false},
    {"id": 201, "path": "pyproject.toml", "commits": 287, "is_focus": false}
  ],
  "edges": [
    {"source": 134, "target": 135, "weight": 0.94, "pair_count": 45},
    {"source": 134, "target": 201, "weight": 0.35, "pair_count": 28}
  ]
}
```

**Must-See:**
- `focus_id` matches the queried file
- `is_focus: true` only for the center node
- All edges have `weight` between 0 and 1
- Node count ≤ limit + 1 (focus node)

---

### Step 3.3: Get Coupling Evidence

**API Request:**
```bash
# First get file IDs
curl "http://localhost:8000/repos/openhands/files?q=package.json&limit=1"
# Returns file_id = 134

curl "http://localhost:8000/repos/openhands/files?q=package-lock.json&limit=1"
# Returns file_id = 135

# Get evidence
curl "http://localhost:8000/repos/openhands/coupling/evidence?src_id=134&dst_id=135"
```

**Expected Response:**
```json
{
  "src_id": 134,
  "dst_id": 135,
  "src_path": "package.json",
  "dst_path": "package-lock.json",
  "common_commits": [
    {
      "commit_oid": "abc123...",
      "author_name": "Developer",
      "commit_date": "2026-01-28T14:30:00",
      "message": "Update dependencies"
    }
  ],
  "total_common": 45
}
```

---

### Step 3.4: Get Component Coupling

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/coupling/components?component=openhands&depth=2"
```

**Expected Response:**
```json
{
  "component": "openhands",
  "depth": 2,
  "coupled_components": [
    {
      "path": "tests",
      "coupling_score": 0.35,
      "edge_count": 45
    },
    {
      "path": "frontend",
      "coupling_score": 0.12,
      "edge_count": 8
    }
  ]
}
```

**Note:** May return empty if `min_component_cooccurrence` threshold is high.

---

## 5. E2E Scenario 4: Clustering - All Algorithms

### Step 4.1: List Available Algorithms

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/clustering/algorithms"
```

**Expected Response:**
```json
[
  {
    "name": "louvain",
    "description": "Louvain community detection",
    "params_schema": {
      "type": "object",
      "properties": {
        "resolution": {"type": "number", "default": 1.0},
        "min_weight": {"type": "number", "default": 0.0},
        "random_state": {"type": "integer"}
      }
    }
  },
  {
    "name": "hierarchical",
    "description": "Hierarchical agglomerative clustering",
    "params_schema": {
      "type": "object",
      "properties": {
        "n_clusters": {"type": "integer"},
        "distance_threshold": {"type": "number"},
        "linkage": {"type": "string", "enum": ["ward", "complete", "average", "single"], "default": "average"}
      }
    }
  },
  {
    "name": "dbscan",
    "description": "DBSCAN clustering",
    "params_schema": {
      "type": "object",
      "properties": {
        "eps": {"type": "number", "default": 0.5},
        "min_samples": {"type": "integer", "default": 2}
      }
    }
  },
  {
    "name": "label_propagation",
    "description": "Label propagation clustering",
    "params_schema": {
      "type": "object",
      "properties": {
        "min_weight": {"type": "number", "default": 0.0},
        "max_iterations": {"type": "integer", "default": 100}
      }
    }
  }
]
```

---

### Step 4.2: Run Louvain Clustering

#### Test Case 4.2.1: Low Resolution (Fewer, Larger Clusters)

**API Request:**
```bash
curl -X POST "http://localhost:8000/repos/openhands/clustering/run" \
  -H "Content-Type: application/json" \
  -d '{
    "algorithm": "louvain",
    "min_weight": 0.05,
    "params": {"resolution": 0.5}
  }'
```

**Expected Response:**
```json
{
  "algorithm": "louvain",
  "parameters": {"resolution": 0.5, "min_weight": 0.05},
  "cluster_count": 8,
  "clusters": [
    {
      "id": 1,
      "size": 7,
      "file_ids": [134, 135, 201, 202, ...],
      "files": ["package.json", "package-lock.json", "pyproject.toml", "poetry.lock", ...]
    },
    {
      "id": 2,
      "size": 3,
      "file_ids": [401, 402, 403],
      "files": ["openhands/core/translation.json", "openhands/declaration.d.ts", "i18n/en.json"]
    }
  ],
  "metrics": {
    "modularity": 0.65
  }
}
```

**Must-See Numbers:**
| Metric | Expected Range |
|--------|----------------|
| `cluster_count` | 5-15 |
| `modularity` | 0.4 - 0.8 |
| Largest cluster size | 5-15 files |
| Singleton clusters | 440-450 (most files have no strong coupling) |

---

#### Test Case 4.2.2: High Resolution (More, Smaller Clusters)

**API Request:**
```bash
curl -X POST "http://localhost:8000/repos/openhands/clustering/run" \
  -H "Content-Type: application/json" \
  -d '{
    "algorithm": "louvain",
    "min_weight": 0.1,
    "params": {"resolution": 2.0}
  }'
```

**Expected Response:**
```json
{
  "algorithm": "louvain",
  "parameters": {"resolution": 2.0, "min_weight": 0.1},
  "cluster_count": 25,
  "metrics": {
    "modularity": 0.55
  }
}
```

**Must-See Numbers:**
| Metric | Expected Range |
|--------|----------------|
| `cluster_count` | 20-50 |
| `modularity` | 0.3 - 0.6 |

---

### Step 4.3: Run Hierarchical Clustering

#### Test Case 4.3.1: Ward Linkage with Fixed Clusters

**API Request:**
```bash
curl -X POST "http://localhost:8000/repos/openhands/clustering/run" \
  -H "Content-Type: application/json" \
  -d '{
    "algorithm": "hierarchical",
    "min_weight": 0.1,
    "params": {"n_clusters": 10, "linkage": "ward"}
  }'
```

**Expected Response:**
```json
{
  "algorithm": "hierarchical",
  "parameters": {"n_clusters": 10, "linkage": "ward"},
  "cluster_count": 10,
  "clusters": [...]
}
```

**Must-See Numbers:**
| Metric | Expected |
|--------|----------|
| `cluster_count` | Exactly 10 (as requested) |
| Each file appears in exactly one cluster | Yes |

---

#### Test Case 4.3.2: Average Linkage with Distance Threshold

**API Request:**
```bash
curl -X POST "http://localhost:8000/repos/openhands/clustering/run" \
  -H "Content-Type: application/json" \
  -d '{
    "algorithm": "hierarchical",
    "min_weight": 0.1,
    "params": {"distance_threshold": 0.7, "linkage": "average"}
  }'
```

**Expected:** Variable cluster count based on distance threshold.

---

#### Test Case 4.3.3: Complete Linkage

**API Request:**
```bash
curl -X POST "http://localhost:8000/repos/openhands/clustering/run" \
  -H "Content-Type: application/json" \
  -d '{
    "algorithm": "hierarchical",
    "min_weight": 0.1,
    "params": {"n_clusters": 15, "linkage": "complete"}
  }'
```

---

#### Test Case 4.3.4: Single Linkage

**API Request:**
```bash
curl -X POST "http://localhost:8000/repos/openhands/clustering/run" \
  -H "Content-Type: application/json" \
  -d '{
    "algorithm": "hierarchical",
    "min_weight": 0.1,
    "params": {"n_clusters": 15, "linkage": "single"}
  }'
```

---

### Step 4.4: Run DBSCAN Clustering

#### Test Case 4.4.1: Standard Parameters

**API Request:**
```bash
curl -X POST "http://localhost:8000/repos/openhands/clustering/run" \
  -H "Content-Type: application/json" \
  -d '{
    "algorithm": "dbscan",
    "min_weight": 0.1,
    "params": {"eps": 0.5, "min_samples": 2}
  }'
```

**Expected Response:**
```json
{
  "algorithm": "dbscan",
  "parameters": {"eps": 0.5, "min_samples": 2},
  "cluster_count": 5,
  "clusters": [...],
  "noise_count": 445
}
```

**Must-See Numbers:**
| Metric | Expected Range |
|--------|----------------|
| `cluster_count` | 3-15 |
| `noise_count` | High (most files isolated) |

---

#### Test Case 4.4.2: Tight Clustering (Low eps)

**API Request:**
```bash
curl -X POST "http://localhost:8000/repos/openhands/clustering/run" \
  -H "Content-Type: application/json" \
  -d '{
    "algorithm": "dbscan",
    "min_weight": 0.1,
    "params": {"eps": 0.3, "min_samples": 3}
  }'
```

**Expected:** Fewer clusters, more noise.

---

#### Test Case 4.4.3: Loose Clustering (High eps)

**API Request:**
```bash
curl -X POST "http://localhost:8000/repos/openhands/clustering/run" \
  -H "Content-Type: application/json" \
  -d '{
    "algorithm": "dbscan",
    "min_weight": 0.05,
    "params": {"eps": 0.7, "min_samples": 2}
  }'
```

**Expected:** More files in clusters, less noise.

---

### Step 4.5: Run Label Propagation

**API Request:**
```bash
curl -X POST "http://localhost:8000/repos/openhands/clustering/run" \
  -H "Content-Type: application/json" \
  -d '{
    "algorithm": "label_propagation",
    "min_weight": 0.1,
    "params": {"max_iterations": 100}
  }'
```

**Expected Response:**
```json
{
  "algorithm": "label_propagation",
  "parameters": {"min_weight": 0.1},
  "cluster_count": 447,
  "clusters": [...]
}
```

**Note:** Label propagation tends to create many singletons in sparse graphs.

---

### Step 4.6: Clustering with Folder Filter

**API Request:**
```bash
curl -X POST "http://localhost:8000/repos/openhands/clustering/run" \
  -H "Content-Type: application/json" \
  -d '{
    "algorithm": "louvain",
    "min_weight": 0.1,
    "folders": ["openhands/core"],
    "params": {"resolution": 1.0}
  }'
```

**Expected:** Only files in `openhands/core/` included in clustering.

---

### Clustering Algorithm Comparison Matrix

| Algorithm | Parameters | Expected Clusters | Modularity | Notes |
|-----------|------------|-------------------|------------|-------|
| **Louvain** | resolution=0.5, min_weight=0.05 | 5-15 | 0.5-0.7 | Fewer large clusters |
| **Louvain** | resolution=1.0, min_weight=0.1 | 10-25 | 0.4-0.6 | Default behavior |
| **Louvain** | resolution=2.0, min_weight=0.1 | 20-50 | 0.3-0.5 | More granular |
| **Hierarchical** | n_clusters=10, linkage=ward | 10 | N/A | Fixed count |
| **Hierarchical** | n_clusters=10, linkage=average | 10 | N/A | Different groupings |
| **Hierarchical** | n_clusters=10, linkage=complete | 10 | N/A | More compact clusters |
| **Hierarchical** | n_clusters=10, linkage=single | 10 | N/A | Chain-like clusters |
| **DBSCAN** | eps=0.3, min_samples=3 | 2-8 | N/A | Many noise points |
| **DBSCAN** | eps=0.5, min_samples=2 | 3-15 | N/A | Standard |
| **DBSCAN** | eps=0.7, min_samples=2 | 5-20 | N/A | Larger clusters |
| **Label Prop** | min_weight=0.1 | ~447 | N/A | Many singletons |

---

## 6. E2E Scenario 5: Snapshot Management

### Step 5.1: Save Clustering Snapshot

**API Request:**
```bash
# First run clustering
curl -X POST "http://localhost:8000/repos/openhands/clustering/run" \
  -H "Content-Type: application/json" \
  -d '{
    "algorithm": "louvain",
    "min_weight": 0.1,
    "params": {"resolution": 1.0}
  }' > /tmp/clustering_result.json

# Save as snapshot
curl -X POST "http://localhost:8000/repos/openhands/clustering/snapshots" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Louvain Default",
    "description": "Louvain with default parameters",
    "result": '"$(cat /tmp/clustering_result.json)"'
  }'
```

**Expected Response:**
```json
{
  "id": "snapshot_20260201_143000",
  "name": "Louvain Default",
  "algorithm": "louvain",
  "created_at": "2026-02-01T14:30:00",
  "cluster_count": 447
}
```

---

### Step 5.2: List Snapshots

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/clustering/snapshots"
```

**Expected Response:**
```json
[
  {
    "id": "snapshot_20260201_143000",
    "name": "Louvain Default",
    "algorithm": "louvain",
    "created_at": "2026-02-01T14:30:00",
    "cluster_count": 447,
    "parameters": {"resolution": 1.0, "min_weight": 0.1}
  }
]
```

---

### Step 5.3: Get Snapshot Details

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/clustering/snapshots/snapshot_20260201_143000"
```

**Expected Response:** Full clustering result including all clusters.

---

### Step 5.4: Update Snapshot

**API Request:**
```bash
curl -X PUT "http://localhost:8000/repos/openhands/clustering/snapshots/snapshot_20260201_143000" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Louvain Default (Updated)",
    "description": "Updated description"
  }'
```

---

### Step 5.5: Compare Snapshots

**API Request:**
```bash
# Create second snapshot first
curl -X POST "http://localhost:8000/repos/openhands/clustering/run" \
  -H "Content-Type: application/json" \
  -d '{"algorithm": "louvain", "params": {"resolution": 2.0}}' > /tmp/clustering2.json

curl -X POST "http://localhost:8000/repos/openhands/clustering/snapshots" \
  -H "Content-Type: application/json" \
  -d '{"name": "Louvain High Res", "result": '"$(cat /tmp/clustering2.json)"'}'

# Compare
curl "http://localhost:8000/repos/openhands/clustering/compare?snapshot_a=snapshot_20260201_143000&snapshot_b=snapshot_20260201_143500"
```

**Expected Response:**
```json
{
  "snapshot_a": {"id": "...", "cluster_count": 447},
  "snapshot_b": {"id": "...", "cluster_count": 450},
  "comparison": {
    "files_moved": 15,
    "clusters_split": 3,
    "clusters_merged": 1,
    "stability_score": 0.92
  }
}
```

---

### Step 5.6: Get Snapshot Edges

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/clustering/snapshots/snapshot_20260201_143000/edges"
```

**Expected Response:**
```json
{
  "snapshot_id": "snapshot_20260201_143000",
  "edges": [
    {"src_file_id": 134, "dst_file_id": 135, "weight": 0.94, "same_cluster": true},
    {"src_file_id": 134, "dst_file_id": 201, "weight": 0.35, "same_cluster": true}
  ]
}
```

---

### Step 5.7: Delete Snapshot

**API Request:**
```bash
curl -X DELETE "http://localhost:8000/repos/openhands/clustering/snapshots/snapshot_20260201_143000"
```

**Expected Response:**
```json
{
  "status": "deleted",
  "snapshot_id": "snapshot_20260201_143000"
}
```

---

## 7. E2E Scenario 6: Error Handling & Edge Cases

### Step 6.1: Invalid Repository Path

**API Request:**
```bash
curl -X POST "http://localhost:8000/repos" \
  -H "Content-Type: application/json" \
  -d '{"path": "/nonexistent/path", "name": "Invalid"}'
```

**Expected Response (400):**
```json
{
  "error": {
    "code": "HTTP_400",
    "message": "Path does not exist: /nonexistent/path",
    "details": null
  }
}
```

---

### Step 6.2: Non-Git Repository

**API Request:**
```bash
curl -X POST "http://localhost:8000/repos" \
  -H "Content-Type: application/json" \
  -d '{"path": "/tmp", "name": "NotGit"}'
```

**Expected Response (400):**
```json
{
  "error": {
    "code": "HTTP_400",
    "message": "Not a git repository: /tmp",
    "details": null
  }
}
```

---

### Step 6.3: Unknown Repository ID

**API Request:**
```bash
curl "http://localhost:8000/repos/nonexistent/files"
```

**Expected Response (404):**
```json
{
  "error": {
    "code": "HTTP_404",
    "message": "Repository not found: nonexistent",
    "details": null
  }
}
```

---

### Step 6.4: Unknown File Path

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/files/nonexistent/file.py/details"
```

**Expected Response (404):**
```json
{
  "error": {
    "code": "HTTP_404",
    "message": "File not found: nonexistent/file.py",
    "details": null
  }
}
```

---

### Step 6.5: Invalid Clustering Algorithm

**API Request:**
```bash
curl -X POST "http://localhost:8000/repos/openhands/clustering/run" \
  -H "Content-Type: application/json" \
  -d '{"algorithm": "invalid_algo"}'
```

**Expected Response (400):**
```json
{
  "error": {
    "code": "HTTP_400",
    "message": "Unknown algorithm: invalid_algo",
    "details": null
  }
}
```

---

### Step 6.6: Invalid Parameter Values

**API Request:**
```bash
curl -X POST "http://localhost:8000/repos/openhands/clustering/run" \
  -H "Content-Type: application/json" \
  -d '{"algorithm": "louvain", "min_weight": 2.0}'
```

**Expected Response (422 or 400):**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "min_weight must be between 0 and 1",
    "details": [...]
  }
}
```

---

### Step 6.7: Query Before Analysis Complete

**API Request:**
```bash
# Create repo but don't analyze
curl -X POST "http://localhost:8000/repos" \
  -H "Content-Type: application/json" \
  -d '{"path": "/path/to/new/repo", "name": "Unanalyzed"}'

# Try to query coupling
curl "http://localhost:8000/repos/unanalyzed/coupling?path=somefile.py"
```

**Expected Response:**
```json
{
  "error": {
    "code": "HTTP_400",
    "message": "Analysis not complete",
    "details": null
  }
}
```

---

### Step 6.8: File with No Coupling

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/coupling?path=README.md&limit=10"
```

**Expected Response:**
```json
[]
```

**Note:** Empty array is valid - file has no significant coupling.

---

## 8. E2E Scenario 7: Business Use Cases - Identifying Hidden Dependencies

> **Business Goal**: Discover non-obvious file relationships that indicate architectural coupling, helping teams understand "if I change file A, what else might break?"

### Step 7.1: Discover Package Management Coupling

**Business Context**: When updating dependencies, multiple files must change together. Missing one can break the build.

**Expected High-Coupling Pairs (from QA ground truth):**

| File A | File B | Expected Jaccard | Co-changes |
|--------|--------|------------------|------------|
| `frontend/package.json` | `frontend/package-lock.json` | 0.94 | 498 |
| `pyproject.toml` | `poetry.lock` | 0.16-0.30* | 312 |
| `containers/dev/compose.yml` | `docker-compose.yml` | 0.84 | 47 |

*Note: LFCA uses filtered commits (bulk commits removed), so raw counts differ.

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/coupling?path=frontend/package.json&limit=5"
```

**Expected Response:**
```json
[
  {
    "file_id": 134,
    "path": "frontend/package-lock.json",
    "pair_count": 59,
    "jaccard": 0.9365079365079365,
    "p_dst_given_src": 0.9672131147540983,
    "p_src_given_dst": 0.9672131147540983
  },
  {
    "file_id": 132,
    "path": "containers/dev/compose.yml",
    "pair_count": 50,
    "jaccard": 0.819672131147541,
    "p_dst_given_src": 0.819672131147541,
    "p_src_given_dst": 1.0
  }
]
```

**Business Insight**: When `package.json` changes, there's a 96.7% probability that `package-lock.json` also needs to change.

---

### Step 7.2: Identify Configuration File Dependencies

**Business Context**: Configuration changes often span multiple files. Missing related changes causes runtime issues.

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/coupling?path=pyproject.toml&limit=10"
```

**Expected Coupled Files:**

| Coupled File | Jaccard | Business Meaning |
|--------------|---------|------------------|
| `frontend/package.json` | 0.77 | Cross-stack dependency updates |
| `frontend/package-lock.json` | 0.75 | Frontend lockfile syncs |
| `containers/dev/compose.yml` | 0.71 | Docker config alignment |
| `docker-compose.yml` | 0.61 | Root docker config |

**Test Assertion:**
```bash
# Verify pyproject.toml coupling count
curl "http://localhost:8000/repos/openhands/files/pyproject.toml/details" | jq '.coupled_file_count'
# Expected: >= 5
```

---

### Step 7.3: Discover i18n/Translation Coupling

**Business Context**: Internationalization files must stay synchronized.

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/coupling?path=frontend/src/i18n/translation.json&limit=5"
```

**Expected Response (from QA data):**
```json
[
  {
    "path": "frontend/src/i18n/declaration.ts",
    "jaccard": 0.6667,
    "pair_count": 6,
    "p_dst_given_src": 0.6667,
    "p_src_given_dst": 0.8571428571428571
  }
]
```

**Business Insight**: Translation JSON and TypeScript declarations must be updated together - 85.7% of declaration changes require translation updates.

---

### Step 7.4: Explore Documentation-Code Coupling

**Business Context**: When core functionality changes, documentation should be updated.

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/coupling?path=README.md&limit=10"
```

**Expected Coupled Files (from cochange_pairs.json):**

| File | Co-changes | Meaning |
|------|------------|---------|
| `pyproject.toml` | 60 | Version bumps |
| `frontend/package.json` | 59 | Feature additions |
| `Development.md` | 56 | Dev setup changes |
| `containers/dev/compose.yml` | 50 | Docker setup docs |

---

### Step 7.5: Server Session Component Coupling

**Business Context**: Identify tightly coupled server components for refactoring decisions.

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/coupling?path=openhands/server/session/agent_session.py&limit=10"
```

**Expected Coupling (from cochange_pairs.json):**

| File | Co-changes | Business Insight |
|------|------------|------------------|
| `openhands/server/session/session.py` | 42 | Core session management |
| `openhands/runtime/base.py` | 36 | Runtime dependencies |
| `openhands/controller/agent_controller.py` | ~30 | Controller integration |

**Test Assertion**: Agent session should show coupling with at least 3 other server files.

---

## 9. E2E Scenario 8: Test-Implementation Coupling Analysis

> **Business Goal**: Verify that tests are properly maintained alongside their implementations. High test-impl coupling indicates good TDD practices.

### Step 8.1: Perfect Test-Implementation Pairs (Jaccard = 1.0)

**QA Ground Truth - Files that ALWAYS change together:**

| Implementation | Test | Commits | Jaccard |
|---------------|------|---------|---------|
| `enterprise/integrations/jira/jira_view.py` | `enterprise/tests/unit/integrations/jira/test_jira_view.py` | 6 | 1.0 |
| `enterprise/server/routes/orgs.py` | `enterprise/tests/unit/server/routes/test_orgs.py` | 5 | 1.0 |
| `enterprise/storage/api_key_store.py` | `enterprise/tests/unit/test_api_key_store.py` | 5 | 1.0 |
| `enterprise/server/auth/domain_blocker.py` | `enterprise/tests/unit/test_domain_blocker.py` | 3 | 1.0 |

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/coupling?path=enterprise/integrations/jira/jira_view.py&limit=5"
```

**Expected Response:**
```json
[
  {
    "path": "enterprise/tests/unit/integrations/jira/test_jira_view.py",
    "jaccard": 1.0,
    "p_dst_given_src": 1.0,
    "p_src_given_dst": 1.0
  }
]
```

**Business Insight**: Perfect Jaccard of 1.0 indicates excellent test discipline - implementation never changes without test updates.

---

### Step 8.2: Cross-Integration Test Coupling

**QA Discovery**: Some integrations always change together (potential code duplication).

| File A | File B | Jaccard | Insight |
|--------|--------|---------|---------|
| `jira_dc/jira_dc_manager.py` | `linear/linear_manager.py` | 1.0 | Same interface pattern |
| `jira_dc/jira_dc_view.py` | `linear/linear_view.py` | 1.0 | Same view pattern |
| `jira_dc_view.py` | `test_linear_view.py` | 1.0 | Cross-test coupling! |

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/coupling?path=enterprise/integrations/jira_dc/jira_dc_view.py&limit=10"
```

**Business Insight**: Cross-integration coupling suggests shared abstractions or copy-paste code. Consider refactoring to a common base class.

---

### Step 8.3: Test Coverage Gap Detection

**Goal**: Find implementations that change without corresponding tests.

**API Request:**
```bash
# Get file details for a core file
curl "http://localhost:8000/repos/openhands/files/openhands/server/routes/manage_conversations.py/details"
```

**Check Coupling List**: If no test file appears in coupled files with Jaccard > 0.3, it indicates potential test coverage gap.

**Expected Test Files for Core Components:**

| Component | Expected Test Coupling |
|-----------|----------------------|
| `openhands/controller/agent_controller.py` | `tests/unit/test_agent_controller.py` (38 co-changes) |
| `openhands/runtime/base.py` | `tests/runtime/test_*.py` |
| `openhands/llm/llm.py` | `tests/unit/test_llm.py` |

---

### Step 8.4: Enterprise Module Test Quality

**QA Data Shows**: Enterprise module has excellent test coupling.

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/coupling/components?component=enterprise&depth=2"
```

**Expected**: Strong internal coupling between `enterprise/` and `enterprise/tests/`.

**Test Implementation Stats from QA:**
- Total test files: 438
- Matched test-impl pairs: 66
- High coupling pairs (Jaccard > 0.5): 53
- Coverage rate: 80% of matched pairs have strong coupling

---

## 10. E2E Scenario 9: Module & Cross-Module Analysis

> **Business Goal**: Understand module boundaries and identify cross-cutting concerns that may indicate architectural issues.

### Step 9.1: Module Commit Activity

**QA Ground Truth - Module Statistics:**

| Module | Files | Commits | Avg Commits/File |
|--------|-------|---------|------------------|
| `.` (root) | 26 | 5,967 | 229.5 |
| `openhands/` | 570 | 1,843 | 3.2 |
| `frontend/` | 1,024 | 1,812 | 1.8 |
| `tests/` | 218 | 979 | 4.5 |
| `enterprise/` | 421 | 183 | 0.4 |
| `evaluation/` | 328 | 408 | 1.2 |

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/folders?depth=1"
```

**Expected Response Structure:**
```json
[
  {
    "path": "openhands",
    "file_count": 137,
    "total_commits": 246
  },
  {
    "path": "frontend",
    "file_count": 172,
    "total_commits": 357
  }
]
```

---

### Step 9.2: Cross-Module Commit Detection

**QA Discovery**: 1,498 commits touched multiple top-level modules.

**Example Cross-Module Commits:**

| Commit | Modules Touched | Folders |
|--------|-----------------|---------|
| `b5e00f57...` | 10 | evaluation, openhands, frontend, tests, enterprise, ... |
| `01ae22ef...` | 10 | evaluation, openhands, tests, frontend, containers, ... |
| `689d3c90...` | 8 | openhands, tests, frontend, docs, ... |

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/folders/openhands/details"
```

**Expected Response:**
```json
{
  "path": "openhands",
  "file_count": 137,
  "total_commits": 246,
  "coupling_stats": {
    "internal_edges": 45,
    "external_edges": 23
  }
}
```

**Business Insight**: High external edge count indicates tight coupling with other modules.

---

### Step 9.3: Frontend-Backend Coupling

**Business Context**: Identify API contracts that span frontend and backend.

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/coupling/components?component=frontend&depth=1"
```

**Expected Coupling with:**
- `openhands/server/` (API endpoints)
- `containers/` (Docker configs)
- Root config files

---

### Step 9.4: Deep Folder Analysis

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/folders/frontend%2Fsrc%2Fhooks/details"
```

**Expected (from QA folder_statistics.json):**
```json
{
  "path": "frontend/src/hooks",
  "file_count": 42,
  "total_commits": 54,
  "avg_commits_per_file": 1.29,
  "hottest_files": [
    {"path": "frontend/src/hooks/mutation/use-submit-feedback.ts", "commits": 3},
    {"path": "frontend/src/hooks/query/use-conversation-config.ts", "commits": 3}
  ]
}
```

---

## 11. E2E Scenario 10: Hotspot & Change Impact Analysis

> **Business Goal**: Identify high-risk files that change frequently and have many dependencies.

### Step 10.1: Top Code Hotspots

**QA Ground Truth - Highest Churn Files:**

| File | Commits | Churn (lines) | Risk |
|------|---------|---------------|------|
| `frontend/package-lock.json` | 525 | 263,137 | High (auto-generated) |
| `poetry.lock` | 748 | 127,832 | High (auto-generated) |
| `frontend/src/i18n/translation.json` | 244 | 51,210 | Medium (i18n updates) |
| `pyproject.toml` | 446 | Variable | High (version changes) |

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/files?sort_by=commits&sort_dir=desc&limit=20"
```

**Expected Top Files:**
1. `pyproject.toml` - 71 commits (filtered)
2. `frontend/package-lock.json` - 61 commits (filtered)
3. `frontend/package.json` - 61 commits (filtered)
4. `containers/dev/compose.yml` - 50 commits
5. `docker-compose.yml` - 44 commits

---

### Step 10.2: Change Impact Graph

**Business Context**: "If I modify pyproject.toml, what else might need attention?"

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/impact?path=pyproject.toml&depth=2"
```

**Expected Impact Chain:**
```
pyproject.toml
├── frontend/package.json (J=0.77) → frontend/package-lock.json (J=0.94)
├── containers/dev/compose.yml (J=0.71) → docker-compose.yml (J=0.84)
└── README.md (indirect)
```

---

### Step 10.3: Folder Hotspot Analysis

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/folders/containers%2Fdev/details"
```

**Expected (from QA):**
```json
{
  "path": "containers/dev",
  "file_count": 1,
  "total_commits": 50,
  "avg_commits_per_file": 50.0,
  "hottest_files": [
    {"path": "containers/dev/compose.yml", "commits": 50}
  ]
}
```

**Business Insight**: This folder has the highest average commits per file - any change here ripples widely.

---

### Step 10.4: Impact Visualization

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/impact/graph?path=pyproject.toml&limit=20"
```

**Expected Graph Structure:**
```json
{
  "focus_id": 130,
  "focus_path": "pyproject.toml",
  "nodes": [
    {"id": 130, "path": "pyproject.toml", "commits": 71, "is_focus": true, "impact_score": 1.0},
    {"id": 135, "path": "frontend/package.json", "commits": 61, "impact_score": 0.77},
    {"id": 134, "path": "frontend/package-lock.json", "commits": 61, "impact_score": 0.75}
  ],
  "edges": [
    {"source": 130, "target": 135, "weight": 0.77},
    {"source": 135, "target": 134, "weight": 0.94}
  ]
}
```

---

## 12. E2E Scenario 11: Author & Knowledge Distribution

> **Business Goal**: Identify knowledge silos, bus factor risks, and team expertise areas.

### Step 11.1: Repository Bus Factor

**QA Ground Truth - Top Contributors:**

| Author | Commits | Percentage |
|--------|---------|------------|
| dependabot[bot] | 934 | 15.64% |
| accounts@rbren.io | 474 | 7.94% |
| xingyao@all-hands.dev | 414 | 6.93% |
| tofarr@gmail.com | 388 | 6.50% |
| amanape | 367 | 6.15% |
| enyst | 299 | 5.01% |
| neubig@gmail.com | 291 | 4.87% |

**Bus Factor**: 7 (top 7 contributors account for ~52% of commits)

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/authors?limit=20"
```

**Expected Response:**
```json
{
  "bus_factor": 7,
  "total_authors": 459,
  "top_contributors": [
    {"email": "dependabot[bot]@users.noreply.github.com", "commits": 934, "percentage": 15.64}
  ]
}
```

---

### Step 11.2: File Author Distribution

**Business Context**: Who knows this file best?

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/files/pyproject.toml/authors"
```

**Expected Response:**
```json
{
  "file_id": 130,
  "path": "pyproject.toml",
  "authors": [
    {"email": "accounts@rbren.io", "commits": 45, "percentage": 63.4},
    {"email": "dependabot[bot]@users.noreply.github.com", "commits": 15, "percentage": 21.1}
  ]
}
```

---

### Step 11.3: Folder Expertise Analysis

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/folders/openhands%2Fserver/details"
```

**Expected Author Distribution:**
- Primary maintainer(s) identified
- Knowledge concentration metrics
- Risk assessment for vacations/departures

---

### Step 11.4: Cross-Team Coupling Detection

**Business Context**: Find files that require coordination between teams.

**Look for files with:**
- Multiple distinct author groups
- High coupling to files owned by different teams

---

## 13. E2E Scenario 12: File Rename & Lineage Tracking

> **Business Goal**: Understand file history through renames and refactoring to maintain accurate coupling data.

### Step 12.1: Significant Renames Detected

**QA Ground Truth - Total Renames: 1,541**

**Notable Rename Patterns:**

| Old Path | New Path | Similarity | Business Impact |
|----------|----------|------------|-----------------|
| `.openhands/microagents/repo.md` | `AGENTS.md` | 100% | Root promotion |
| `frontend/src/state/*.ts` | `frontend/src/stores/*.ts` | 100% | Architecture change |
| `microagents/*.md` | `skills/*.md` | 100% | Folder rename |
| `openhands/app_server/...` | `enterprise/integrations/...` | 91% | Module extraction |

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/files/AGENTS.md/lineage"
```

**Expected Response:**
```json
[
  {
    "commit_oid": "9171986dde4442b5e65ae8ca7ea747344de53a42",
    "old_path": ".openhands/microagents/repo.md",
    "new_path": "AGENTS.md",
    "similarity": 100,
    "commit_date": "2026-01-XX"
  }
]
```

---

### Step 12.2: Frontend State → Stores Migration

**Business Context**: Track architectural refactoring.

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/files/frontend%2Fsrc%2Fstores%2Fcommand-store.ts/lineage"
```

**Expected Rename Chain:**
```json
[
  {
    "old_path": "frontend/src/state/command-store.ts",
    "new_path": "frontend/src/stores/command-store.ts",
    "similarity": 100
  }
]
```

**Related Files (should show same migration):**
- `conversation-store.ts`
- `microagent-management-store.ts`
- `status-store.ts`

---

### Step 12.3: Test File Reorganization

**QA Discovery**: Tests moved from component folders to dedicated `__tests__/` folders.

**Example:**
```
frontend/src/components/features/settings/mcp-settings/__tests__/mcp-server-form.validation.test.tsx
→ frontend/__tests__/components/features/settings/mcp-settings/mcp-server-form.validation.test.tsx
```

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/files?q=__tests__&sort_by=commits"
```

---

### Step 12.4: Enterprise Module Extraction

**Business Context**: Track module boundary changes.

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/files/enterprise%2Fintegrations%2Fgithub%2Fgithub_v1_callback_processor.py/lineage"
```

**Expected:**
```json
[
  {
    "old_path": "openhands/app_server/event_callback/github_v1_callback_processor.py",
    "new_path": "enterprise/integrations/github/github_v1_callback_processor.py",
    "similarity": 91
  }
]
```

---

## 14. E2E Scenario 13: Integration Coupling Patterns

> **Business Goal**: Discover coupling patterns specific to third-party integrations (GitHub, Jira, Slack, etc.)

### Step 13.1: GitHub Integration Coupling

**QA Discovery**: GitHub and GitLab services always change together.

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/coupling?path=openhands/integrations/github/github_service.py&limit=10"
```

**Expected Co-coupled Files:**
```json
[
  {
    "path": "openhands/integrations/gitlab/gitlab_service.py",
    "jaccard": 0.5,
    "pair_count": 35
  }
]
```

**Business Insight**: Integration services likely share interface - consider abstracting to common base.

---

### Step 13.2: Jira Family Coupling

**QA Ground Truth - Jira DC and Linear always sync:**

| Jira DC File | Linear File | Jaccard |
|--------------|-------------|---------|
| `jira_dc_manager.py` | `linear_manager.py` | 1.0 |
| `jira_dc_view.py` | `linear_view.py` | 1.0 |

**API Request:**
```bash
curl "http://localhost:8000/repos/openhands/coupling?path=enterprise/integrations/jira_dc/jira_dc_manager.py"
```

**Business Insight**: Perfect coupling indicates shared patterns - potential for code generation or templates.

---

### Step 13.3: Integration Cluster Detection

**API Request:**
```bash
curl -X POST "http://localhost:8000/repos/openhands/clustering/run" \
  -H "Content-Type: application/json" \
  -d '{
    "algorithm": "louvain",
    "min_weight": 0.3,
    "folders": ["enterprise/integrations"],
    "params": {"resolution": 0.5}
  }'
```

**Expected Clusters:**
- Jira family: `jira/`, `jira_dc/`
- Issue trackers: `linear/`, `github/`, `gitlab/`
- Messaging: `slack/`

---

### Step 13.4: Callback Processor Patterns

**QA Discovery**: All callback processors are tightly coupled.

| Processor | Test | Jaccard |
|-----------|------|---------|
| `jira_callback_processor.py` | `test_jira_callback_processor.py` | 1.0 |
| `jira_dc_callback_processor.py` | `test_jira_dc_callback_processor.py` | 1.0 |
| `linear_callback_processor.py` | `test_linear_callback_processor.py` | 1.0 |
| `gitlab_callback_processor.py` | `test_gitlab_callback_processor.py` | 1.0 |

**Business Insight**: Consistent test patterns across integrations - good architecture.

---

## 15. Expected Results Reference

### OpenHands Repository Statistics

| Metric | QA Ground Truth | LFCA Expected | Notes |
|--------|-----------------|---------------|-------|
| Total Git Commits | 5,971 | - | Raw count |
| Non-merge Commits | 5,970 | - | - |
| LFCA Commits (filtered) | - | ~5,844 | Bulk commits removed |
| Files at HEAD | 2,765 | - | Current files |
| LFCA Files (min_revisions=5) | - | ~454 | Filtered files |
| Total Edges | - | ~410 | min_cooccurrence=5 |
| Unique Authors | 459 | 459 | - |
| Total Renames | 1,541 | 1,541 | - |
| Bus Factor | 7 | 7 | - |

### Known High-Coupling Pairs (Ground Truth)

| File A | File B | QA Jaccard | QA Co-changes | LFCA Expected |
|--------|--------|------------|---------------|---------------|
| `frontend/package.json` | `frontend/package-lock.json` | 1.0 (raw) | 498 | 0.94 |
| `pyproject.toml` | `poetry.lock` | ~0.42 | 312 | 0.16 |
| `frontend/src/i18n/declaration.ts` | `frontend/src/i18n/translation.json` | 0.66 | 138 | 0.67 |
| `containers/dev/compose.yml` | `docker-compose.yml` | 0.87 | 47 | 0.84 |
| `openhands/server/session/agent_session.py` | `openhands/server/session/session.py` | ~0.8 | 42 | >0.5 |

### Perfect Coupling Pairs (Jaccard = 1.0)

From QA coupling_ground_truth.json - 47 pairs with Jaccard = 1.0:

| Implementation | Test/Related | Co-changes |
|---------------|--------------|------------|
| `enterprise/integrations/jira/jira_view.py` | `test_jira_view.py` | 6 |
| `enterprise/server/routes/orgs.py` | `enterprise/storage/org_service.py` | 5 |
| `enterprise/storage/api_key_store.py` | `test_api_key_store.py` | 5 |
| `enterprise/integrations/jira_dc/jira_dc_manager.py` | `linear/linear_manager.py` | 3 |
| `enterprise/server/auth/domain_blocker.py` | `test_domain_blocker.py` | 3 |

### Folder Statistics (QA Ground Truth)

| Folder | Files | Commits | Avg Commits/File | Top File |
|--------|-------|---------|------------------|----------|
| `frontend/` | 172 | 357 | 2.08 | `package-lock.json` (61) |
| `openhands/` | 137 | 246 | 1.80 | `kubernetes/README.md` (18) |
| `frontend/src/` | 144 | 204 | 1.42 | `translation.json` (9) |
| `containers/` | 5 | 61 | 12.20 | `compose.yml` (50) |
| `tests/` | 49 | 56 | 1.14 | `test_ipython.py` (3) |
| `frontend/src/hooks/` | 42 | 54 | 1.29 | `use-submit-feedback.ts` (3) |
| `containers/dev/` | 1 | 50 | 50.00 | `compose.yml` (50) |

### Hotspot Analysis (Top 20 by Churn)

| File | Commits | Churn | Exists at HEAD |
|------|---------|-------|----------------|
| `frontend/package-lock.json` | 525 | 263,137 | ✓ |
| `poetry.lock` | 748 | 127,832 | ✓ |
| `docs/package-lock.json` | 39 | 58,684 | ✗ |
| `frontend/src/i18n/translation.json` | 244 | 51,210 | ✓ |
| `enterprise/poetry.lock` | 37 | 27,884 | ✓ |
| `uv.lock` | 2 | 10,628 | ✓ |

### Author Statistics

| Rank | Author | Commits | Percentage |
|------|--------|---------|------------|
| 1 | dependabot[bot] | 934 | 15.64% |
| 2 | accounts@rbren.io | 474 | 7.94% |
| 3 | xingyao@all-hands.dev | 414 | 6.93% |
| 4 | tofarr@gmail.com | 388 | 6.50% |
| 5 | amanape | 367 | 6.15% |
| 6 | enyst | 299 | 5.01% |
| 7 | neubig@gmail.com | 291 | 4.87% |
| 8 | hieptl | 286 | 4.79% |
| 9 | mamoodiha@gmail.com | 283 | 4.74% |
| 10 | rohitvinodmalhotra@gmail.com | 280 | 4.69% |

### Test-Implementation Coverage (QA)

| Metric | Value |
|--------|-------|
| Total Test Files | 438 |
| Matched Test-Impl Pairs | 66 |
| High Coupling Pairs (J>0.5) | 53 |
| Coverage Rate | 80% |

---

## 16. OpenHands Ground Truth Data

### Cross-Module Commit Analysis

**Total cross-module commits**: 1,498 (commits touching 2+ top-level folders)

**Largest Cross-Module Commits:**

| Commit | Folders Touched |
|--------|-----------------|
| `b5e00f577c...` | 10 folders |
| `01ae22ef57...` | 10 folders |
| `689d3c9046...` | 8 folders |
| `152f99c64f...` | 8 folders |

### File Type Distribution

| Type | Count | Percentage |
|------|-------|------------|
| Python | 1,254 | 45.4% |
| TypeScript/JavaScript | 958 | 34.7% |
| Tests | 526 | 19.0% |
| Markdown | 138 | 5.0% |

### Rename Patterns

**Total Renames**: 1,541

**Common Rename Types:**

| Pattern | Count | Example |
|---------|-------|---------|
| Folder restructure | ~500 | `src/state/` → `src/stores/` |
| Test reorganization | ~200 | `component/__tests__/` → `__tests__/` |
| Module extraction | ~100 | `openhands/` → `enterprise/` |
| Migration renames | ~50 | Version number bumps |

### Expected Cluster Patterns

| Cluster Type | Expected Files | Algorithm | Notes |
|--------------|----------------|-----------|-------|
| Package Management | package.json, package-lock.json, pyproject.toml, compose.yml | All | 4-6 files |
| i18n Files | translation.json, declaration.ts | All | 2 files |
| Docker Config | docker-compose.yml, compose.yml, Dockerfile | Louvain | 2-4 files |
| Integration Family | jira_*, linear_*, github_*, gitlab_* | Louvain | Per integration |
| Server Session | agent_session.py, session.py, base.py | Hierarchical | 3-5 files |

### Singleton Cluster Statistics

| Algorithm | Expected Singletons | Percentage | Reason |
|-----------|---------------------|------------|--------|
| Louvain (default) | ~445 | ~98% | Sparse coupling graph |
| Hierarchical (n=10) | ~440 | ~97% | Fixed cluster count |
| DBSCAN (noise) | ~440 | ~97% | Density-based |
| Label Propagation | ~445 | ~98% | Community detection |

**Why so many singletons?**
- Only 61 files have edges (13.4% of 454 filtered files)
- Most files have < 5 co-occurrences with any other file
- Enterprise module is relatively isolated
- Test files often change independently

### Validation Checkpoints

| Check | Expected | Tolerance |
|-------|----------|-----------|
| File count matches | 454 | ±20 |
| Edge count | 410 | ±30 |
| Top coupling pair Jaccard | >0.9 | - |
| Singleton percentage | >95% | - |
| Package.json↔lock coupling | >0.9 | - |
| Cross-module commits detected | >1000 | - |

---

## 17. API Endpoint Quick Reference

### Repository Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/repos` | List all repositories |
| POST | `/repos` | Create new repository |
| DELETE | `/repos/{repo_id}` | Delete repository |
| GET | `/repos/{repo_id}/git-info` | Get git remote info |
| PUT | `/repos/{repo_id}/git-info` | Update git info |

### Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/repos/{repo_id}/analysis/start` | Start analysis |
| GET | `/repos/{repo_id}/analysis/status` | Get analysis status |

### Files & Folders

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/repos/{repo_id}/files/tree` | Get file tree structure |
| GET | `/repos/{repo_id}/files` | List files (with filtering/sorting) |
| GET | `/repos/{repo_id}/folders` | List folders at depth |
| GET | `/repos/{repo_id}/files/{path}/details` | Get file details |
| GET | `/repos/{repo_id}/files/{path}/history` | Get file commit history |
| GET | `/repos/{repo_id}/files/{path}/lineage` | Get file rename history |
| GET | `/repos/{repo_id}/files/{path}/activity` | Get file activity timeline |
| GET | `/repos/{repo_id}/files/{path}/authors` | Get file authors |
| GET | `/repos/{repo_id}/files/{path}/commits` | Get file commits |
| GET | `/repos/{repo_id}/folders/{path}/details` | Get folder details |

### Coupling

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/repos/{repo_id}/coupling` | Get coupled files for path |
| GET | `/repos/{repo_id}/coupling/graph` | Get coupling graph data |
| GET | `/repos/{repo_id}/coupling/evidence` | Get coupling evidence (common commits) |
| GET | `/repos/{repo_id}/coupling/components` | Get component coupling |
| GET | `/repos/{repo_id}/impact` | Get impact analysis |
| GET | `/repos/{repo_id}/impact/graph` | Get impact graph |

### Clustering

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/repos/{repo_id}/clustering/algorithms` | List available algorithms |
| POST | `/repos/{repo_id}/clustering/run` | Run clustering analysis |
| GET | `/repos/{repo_id}/clustering/snapshots` | List saved snapshots |
| POST | `/repos/{repo_id}/clustering/snapshots` | Save snapshot |
| GET | `/repos/{repo_id}/clustering/snapshots/{id}` | Get snapshot details |
| PUT | `/repos/{repo_id}/clustering/snapshots/{id}` | Update snapshot |
| DELETE | `/repos/{repo_id}/clustering/snapshots/{id}` | Delete snapshot |
| GET | `/repos/{repo_id}/clustering/snapshots/{id}/edges` | Get snapshot edges |
| GET | `/repos/{repo_id}/clustering/compare` | Compare two snapshots |

### Authors & Knowledge

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/repos/{repo_id}/authors` | Get repository author statistics |
| GET | `/repos/{repo_id}/files/{path}/authors` | Get file author distribution |
| GET | `/repos/{repo_id}/folders/{path}/authors` | Get folder author distribution |

### Renames & Lineage

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/repos/{repo_id}/files/{path}/lineage` | Get file rename history |
| GET | `/repos/{repo_id}/renames` | List all detected renames |

### Statistics & Metrics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/repos/{repo_id}/stats` | Get repository statistics |
| GET | `/repos/{repo_id}/hotspots` | Get file hotspots by churn |
| GET | `/repos/{repo_id}/modules` | Get module-level statistics |

---

## Test Execution Checklist

### Pre-Test Setup

- [ ] Backend server running on port 8000
- [ ] Frontend running on port 5173 (if testing UI)
- [ ] Clean data directory (optional: `rm -rf data/repos/*`)
- [ ] OpenHands repo available at `/home/afettah/workspace/git-coupling-analyzer/tmp/OpenHands`
- [ ] QA reference data available at `/home/afettah/workspace/git-coupling-analyzer/QA/output/openhands/`

### Scenario 1: Project Lifecycle

- [ ] Create repository - returns correct structure
- [ ] List repositories - shows created repo
- [ ] Start analysis - transitions through stages
- [ ] Analysis completes - numbers in expected ranges
- [ ] Verify: commit_count ~5,844
- [ ] Verify: file_count ~454
- [ ] Verify: edge_count ~410
- [ ] Delete repository - moved to deleted folder

### Scenario 2: File Exploration

- [ ] File tree loads - proper nested structure
- [ ] File list with sorting - correct order by commits
- [ ] Verify top file is pyproject.toml (~71 commits)
- [ ] File details - coupling metrics valid
- [ ] File history - commits returned with proper metadata
- [ ] File lineage - renames detected
- [ ] Folder details - aggregate stats correct

### Scenario 3: Coupling Analysis

- [ ] Coupling list - high-coupling pairs visible
- [ ] Verify: package.json ↔ package-lock.json (J > 0.9)
- [ ] Verify: compose.yml ↔ docker-compose.yml (J > 0.8)
- [ ] Coupling graph - nodes and edges correct
- [ ] Coupling evidence - common commits returned
- [ ] Component coupling - module relationships detected

### Scenario 4: Clustering (All Algorithms)

- [ ] Louvain low resolution - fewer clusters
- [ ] Louvain high resolution - more clusters
- [ ] Hierarchical ward - fixed cluster count
- [ ] Hierarchical average - different groupings
- [ ] DBSCAN standard - clusters + noise
- [ ] DBSCAN tight - more noise
- [ ] Label propagation - many singletons
- [ ] Verify high singleton count (~98%)

### Scenario 5: Snapshot Management

- [ ] Save snapshot - ID returned
- [ ] List snapshots - shows saved
- [ ] Get snapshot - full details
- [ ] Update snapshot - name changes
- [ ] Compare snapshots - diff computed
- [ ] Delete snapshot - removed from list

### Scenario 6: Error Handling

- [ ] Invalid path - 400 error
- [ ] Non-git repo - 400 error
- [ ] Unknown repo ID - 404 error
- [ ] Unknown file - 404 error
- [ ] Invalid algorithm - 400 error
- [ ] Invalid parameters - 422 error

### Scenario 7: Business Use Cases

- [ ] Package management coupling detected
- [ ] Configuration file dependencies found
- [ ] i18n coupling (translation.json ↔ declaration.ts)
- [ ] Documentation-code coupling
- [ ] Server session coupling patterns

### Scenario 8: Test-Implementation Coupling

- [ ] Perfect pairs (J=1.0) detected for enterprise integrations
- [ ] Cross-integration test coupling visible
- [ ] Test coverage gaps identifiable

### Scenario 9: Module Analysis

- [ ] Module commit activity matches QA data
- [ ] Cross-module commits detected (>1000)
- [ ] Frontend-backend coupling visible
- [ ] Deep folder analysis works

### Scenario 10: Hotspot Analysis

- [ ] Top hotspots match QA ground truth
- [ ] Impact graph generates correctly
- [ ] Folder hotspots identified (containers/dev)

### Scenario 11: Author Analysis

- [ ] Bus factor = 7
- [ ] Top contributors match QA data
- [ ] File author distribution correct

### Scenario 12: Rename Tracking

- [ ] AGENTS.md lineage shows previous path
- [ ] Frontend state→stores migration tracked
- [ ] Test file reorganization visible
- [ ] Enterprise module extraction tracked

### Scenario 13: Integration Patterns

- [ ] GitHub ↔ GitLab service coupling
- [ ] Jira family coupling (jira_dc ↔ linear)
- [ ] Integration cluster detection works
- [ ] Callback processor patterns visible

### Post-Test Validation

- [ ] Compare results with QA/output/openhands/VALIDATION_REPORT.json
- [ ] Document any discrepancies
- [ ] Update ground truth if legitimate changes found

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-01 | LFCA Team | Initial comprehensive E2E document |
| 2.0 | 2026-02-01 | LFCA Team | Added business use cases (Scenarios 7-13), QA ground truth data, detailed expectations from OpenHands analysis |
