# Clustering API Issues

**Tested**: 2026-02-01
**Repository**: openhands
**API Base**: http://localhost:8000

## Test Results Summary

| Test | Endpoint | Status |
|------|----------|--------|
| List algorithms | GET /repos/{id}/clustering/algorithms | ✅ Pass |
| Louvain clustering | POST /repos/{id}/clustering/run | ✅ Pass |
| Components clustering | POST /repos/{id}/clustering/run | ✅ Pass |
| Label propagation | POST /repos/{id}/clustering/run | ✅ Pass |
| DBSCAN clustering | POST /repos/{id}/clustering/run | ✅ Pass |
| Hierarchical clustering | POST /repos/{id}/clustering/run | ⚠️ See Issue #2 |
| Folder filter | POST /repos/{id}/clustering/run | ✅ Pass |
| Save snapshot | POST /repos/{id}/clustering/snapshots | ✅ Pass |
| List snapshots | GET /repos/{id}/clustering/snapshots | ✅ Pass |
| Get snapshot | GET /repos/{id}/clustering/snapshots/{id} | ✅ Pass |
| Snapshot edges | GET /repos/{id}/clustering/snapshots/{id}/edges | ⚠️ See Issue #4 |
| Compare snapshots | GET /repos/{id}/clustering/compare | ✅ Pass |
| Invalid algorithm | POST /repos/{id}/clustering/run | ✅ Returns error |
| Invalid weight column | POST /repos/{id}/clustering/run | ❌ See Issue #1 |
| Non-existent snapshot | GET /repos/{id}/clustering/snapshots/{id} | ✅ Returns 404 |

## Issues Found

### Issue #1: Invalid weight_column Accepted Without Error

**Severity**: Medium  
**Endpoint**: `POST /repos/{repo_id}/clustering/run`

**Description**: When an invalid `weight_column` value is provided (e.g., "invalid_column"), the API accepts it and returns clustering results instead of returning a validation error.

**Steps to Reproduce**:
```bash
curl -X POST http://localhost:8000/repos/openhands/clustering/run \
  -H "Content-Type: application/json" \
  -d '{"algorithm": "louvain", "weight_column": "invalid_column"}'
```

**Expected**: HTTP 400 error with validation message indicating invalid weight_column  
**Actual**: Returns 200 with clustering results (444 clusters)

**Impact**: Users may unknowingly run clustering with incorrect weight metrics.

**Recommendation**: Validate `weight_column` against allowed values: `jaccard`, `p_dst_given_src`, `p_src_given_dst`, `pair_count`

---

### Issue #2: Hierarchical Algorithm Missing Required Parameter Validation

**Severity**: Low  
**Endpoint**: `POST /repos/{repo_id}/clustering/run`

**Description**: The hierarchical algorithm requires either `n_clusters` or `distance_threshold` according to the schema, but when neither is provided, it puts all files into a single cluster instead of returning an error.

**Steps to Reproduce**:
```bash
curl -X POST http://localhost:8000/repos/openhands/clustering/run \
  -H "Content-Type: application/json" \
  -d '{"algorithm": "hierarchical", "weight_column": "jaccard", "min_weight": 0.1}'
```

**Expected**: HTTP 400 error indicating that n_clusters or distance_threshold is required  
**Actual**: Returns 200 with 1 cluster containing 451 files

**Impact**: Users may accidentally get meaningless clustering results.

**Recommendation**: Add validation to require at least one of `n_clusters` or `distance_threshold`

---

### Issue #3: Snapshot with Zero Clusters Exists

**Severity**: Low  
**Endpoint**: `GET /repos/{repo_id}/clustering/snapshots`

**Description**: A snapshot exists with 0 clusters and 0 files (`test_snapshot_20260201_021841`).

**Observed**:
```json
{
    "id": "test_snapshot_20260201_021841",
    "name": "test_snapshot",
    "algorithm": "louvain",
    "cluster_count": 0,
    "file_count": 0,
    "avg_coupling": 0.0
}
```

**Impact**: Minor - likely a test artifact, but could indicate a bug in snapshot saving or an edge case where clustering produces no results.

**Recommendation**: Consider adding validation to prevent saving empty clustering results, or add a warning indicator.

---

### Issue #4: Inter-cluster Edges Always Empty

**Severity**: Medium  
**Endpoint**: `GET /repos/{repo_id}/clustering/snapshots/{id}/edges`

**Description**: The inter-cluster edges endpoint always returns an empty list, even for snapshots with multiple clusters.

**Steps to Reproduce**:
```bash
# For louvain snapshot with 444 clusters
curl http://localhost:8000/repos/openhands/clustering/snapshots/louvain_baseline_test_20260201_020132/edges

# For DBSCAN snapshot with 2 clusters
curl http://localhost:8000/repos/openhands/clustering/snapshots/dbscan_edges_test_20260201_023550/edges
```

**Expected**: List of edges between clusters with weights  
**Actual**: `{"edges": []}`

**Impact**: Users cannot analyze inter-cluster relationships.

**Recommendation**: Verify the edge computation logic is working correctly. Edges between clusters should show weaker coupling than intra-cluster edges.

---

## Validation Results

### Cluster Structure ✅
All clusters have required fields:
- `id` - Cluster identifier
- `size` - Number of files
- `files` - List of file paths
- `avg_coupling` - Average coupling metric

Additional fields present:
- `file_ids` - File ID integers
- `total_churn` - Total churn count
- `hot_files` - Most changed files
- `top_commits` - Related commits
- `common_authors` - Frequent authors

### Data Integrity ✅
- No duplicate files across clusters
- No empty clusters in active results
- No NaN or negative metric values
- File paths are valid (no `..` or absolute paths)
- Folder filter correctly restricts files to specified folders

### Metrics Validation ✅
- Intra-cluster coupling range: 0.5888 - 0.6667
- All `avg_coupling` values are positive and within expected range (0-1)

### Algorithm Comparison
| Algorithm | Clusters | Avg Size |
|-----------|----------|----------|
| louvain | 444 | 1.0 |
| components | 444 | 1.0 |
| label_propagation | 444 | 1.0 |
| dbscan (eps=0.5) | 2 | 3.5 |
| hierarchical (n=20) | 20 | 22.6 |
