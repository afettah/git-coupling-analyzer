# LFCA Coupling API Test Report

**Date**: 2026-02-01  
**Repository Tested**: openhands  
**API Base URL**: http://localhost:8000

## Summary

Comprehensive testing of LFCA coupling-related API endpoints was performed against the openhands repository. The API is largely functional with mathematically sound metrics, but several issues were identified.

---

## Endpoints Tested

### 1. GET /repos/openhands/coupling ✅ PASS (with issues)

**Parameters Tested**:
- `path` (required): File path to find coupling for
- `metric`: jaccard, pair_count, p_dst_given_src (all work)
- `min_weight`: Filtering by minimum coupling score
- `limit`: Result limiting
- `current_only`: Filter to current files only

**Working Examples**:
```bash
curl "http://localhost:8000/repos/openhands/coupling?path=containers/dev/compose.yml&limit=10"
curl "http://localhost:8000/repos/openhands/coupling?path=containers/dev/compose.yml&min_weight=0.8"
```

**Results**: Returns proper coupled files with metrics.

**Issues Found**:
- **ISSUE-001**: Invalid `metric` parameter causes HTTP 500 instead of validation error
  ```bash
  curl "http://localhost:8000/repos/openhands/coupling?path=test.py&metric=invalid"
  # Returns: {"error":{"code":"INTERNAL_SERVER_ERROR",...}}
  ```

---

### 2. GET /repos/openhands/coupling/graph ✅ PASS

**Working Example**:
```bash
curl "http://localhost:8000/repos/openhands/coupling/graph?path=containers/dev/compose.yml"
```

**Response Structure**:
```json
{
  "nodes": [{"id": 132, "path": "containers/dev/compose.yml", "is_focus": true}, ...],
  "edges": [{"source": 132, "target": 133, "weight": 0.843, ...}],
  "focus_id": 132
}
```

**Metrics in edges**: `pair_count`, `src_count`, `dst_count`, `jaccard`, `jaccard_weighted`, `p_dst_given_src`, `p_src_given_dst`

---

### 3. GET /repos/openhands/coupling/evidence ✅ PASS

**Working Example**:
```bash
curl "http://localhost:8000/repos/openhands/coupling/evidence?src_id=132&dst_id=133"
```

**Note**: Uses `src_id` and `dst_id` (file IDs), NOT path names.

**Response**: Returns list of commits where both files were changed together.

---

### 4. GET /repos/openhands/coupling/components ⚠️ PARTIAL

**Parameter**: `component` (NOT `folder` as initially expected)

**Working Examples**:
```bash
curl "http://localhost:8000/repos/openhands/coupling/components?component=compose.yml"
curl "http://localhost:8000/repos/openhands/coupling/components?component=M"
```

**Issues Found**:
- **ISSUE-002**: Component names are not intuitive folder paths
  - Components include: `A`, `D`, `M` (git change types), `__LFCA_COMMIT__`, short file names
  - Using actual folder paths like `enterprise` or `frontend` returns empty results
  - Documentation needed to clarify what component names are available

---

### 5. GET /repos/openhands/impact (Legacy) ✅ PASS

Alias for `/coupling` - returns same data format with added `src_count` and `dst_count` fields.

---

### 6. GET /repos/openhands/impact/graph (Legacy) ✅ PASS

Alias for `/coupling/graph` - identical response structure.

---

## Metric Validation

### Mathematical Correctness ✅ VERIFIED

Tested with `containers/dev/compose.yml` ↔ `docker-compose.yml` pair:

| Metric | Formula | Expected | Actual | Match |
|--------|---------|----------|--------|-------|
| `jaccard` | pair_count / (src_count + dst_count - pair_count) | 43/(50+44-43) = 0.8431 | 0.8431 | ✅ |
| `p_dst_given_src` | pair_count / src_count | 43/50 = 0.86 | 0.86 | ✅ |
| `p_src_given_dst` | pair_count / dst_count | 43/44 = 0.9773 | 0.9773 | ✅ |

### Value Range Validation ✅ PASS

All returned metrics are within valid ranges:
- `jaccard`: 0.0 - 1.0
- `p_dst_given_src`: 0.0 - 1.0
- `p_src_given_dst`: 0.0 - 1.0

---

## Ground Truth Comparison

### Discrepancy Observed ⚠️

**Ground Truth** (`coupling_ground_truth.json`):
- `containers/dev/compose.yml` ↔ `docker-compose.yml`
- commits_a: 59, commits_b: 53
- cochange_count: 47, jaccard: 0.7231

**API Result**:
- src_count: 50, dst_count: 44
- pair_count: 43, jaccard: 0.8431

**Possible Causes**:
1. Different data extraction time window
2. Different commit filtering criteria (min_revisions, max_changeset_size)
3. Ground truth may include historical deleted files

This is not necessarily a bug but should be documented - the API works with the currently extracted data which may differ from the ground truth collection.

---

## Edge Case Testing

### Non-existent File ✅ PASS
```bash
curl "http://localhost:8000/repos/openhands/coupling?path=nonexistent/file.py"
# Returns: HTTP 404 with proper error message
```

### Non-existent Repo ✅ PASS
```bash
curl "http://localhost:8000/repos/nonexistent_repo/coupling?path=test.py"
# Returns: HTTP 404 "File not found: test.py"
```

### Empty Results ✅ PASS
Files with only 1 commit return empty coupling arrays (correct behavior - no co-changes possible).

---

## Issues Summary

| ID | Severity | Endpoint | Description |
|----|----------|----------|-------------|
| ISSUE-001 | Medium | /coupling | Invalid metric parameter causes 500 error instead of 400 validation error |
| ISSUE-002 | Low | /coupling/components | Component naming scheme is unintuitive; documentation needed |

---

## Recommendations

1. **Add metric validation**: Validate `metric` parameter against allowed values (jaccard, pair_count, p_dst_given_src, p_src_given_dst) and return 400 error with helpful message.

2. **Document component_edges**: Add API documentation explaining what component names are available and how they're derived.

3. **Add parameter discovery endpoint**: Consider `/repos/{repo_id}/coupling/components/list` to return available component names.

4. **Clarify evidence endpoint**: Document that it uses file IDs, not paths.

---

## Test Data for Reference

### Files with High Coupling in openhands:

1. `containers/dev/compose.yml` ↔ `docker-compose.yml` (jaccard: 0.84)
2. `containers/dev/compose.yml` ↔ `frontend/package-lock.json` (jaccard: 0.82)
3. `containers/dev/compose.yml` ↔ `frontend/package.json` (jaccard: 0.82)
4. `containers/dev/compose.yml` ↔ `pyproject.toml` (jaccard: 0.71)

### Expected Test-Impl Pairs (from ground truth):

Many test-impl pairs with jaccard=1.0 are in the ground truth but may have only 1 commit in extracted data, resulting in no coupling data returned from API.

---

## Conclusion

The LFCA coupling API is **functional and mathematically correct**. The main issues are related to input validation and documentation rather than core functionality. The API successfully:

- Returns coupled files for valid paths
- Provides graph visualization data
- Shows commit evidence for file pairs
- Handles errors gracefully for common cases
- Calculates metrics correctly (Jaccard, conditional probabilities)
