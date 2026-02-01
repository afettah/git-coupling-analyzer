# QA Issues Tracker

**Last Updated:** January 31, 2026  
**Repository:** OpenHands (reference project)

---

## Issues Summary

| ID | Issue | Severity | Status | Category |
|----|-------|----------|--------|----------|
| QA-001 | [Evidence API set comprehension bug](#qa-001-evidence-api-set-comprehension-bug) | High | ✅ Fixed | API Bug |
| QA-002 | [Spectral clustering fails](#qa-002-spectral-clustering-fails) | Medium | ❌ Open | API Bug |
| QA-003 | [Component coupling returns empty](#qa-003-component-coupling-returns-empty) | Medium | ❌ Open | API Bug |
| QA-004 | [Hierarchical clustering single cluster](#qa-004-hierarchical-clustering-single-cluster) | Low | ⚠️ Known | Behavior |
| QA-005 | [Sparse clustering graph](#qa-005-sparse-clustering-graph) | Low | ⚠️ Expected | Behavior |
| QA-006 | [File count discrepancy](#qa-006-file-count-discrepancy) | Low | ⚠️ Expected | Behavior |
| QA-007 | [Hotspot ranking differs from git](#qa-007-hotspot-ranking-differs-from-git) | Low | ⚠️ Expected | Behavior |

---

## Open Issues

### QA-002: Spectral Clustering Fails

**Severity:** Medium  
**Status:** ❌ Open  
**Category:** API Bug  
**Endpoint:** `POST /repos/{id}/clustering/run`

**Description:**  
Spectral clustering algorithm returns HTTP 500 Internal Server Error.

**Reproduction:**
```bash
curl -X POST "http://localhost:8000/repos/openhands/clustering/run" \
  -H "Content-Type: application/json" \
  -d '{"algorithm": "spectral", "min_weight": 0.1}'
```

**Error Response:**
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred",
    "details": null
  }
}
```

**Expected Behavior:**  
Should return clustering results similar to Louvain algorithm.

**Workaround:**  
Use Louvain or Label Propagation algorithms instead.

**Next Steps:**
- [ ] Check server logs for stack trace
- [ ] Investigate scipy/numpy compatibility
- [ ] Test with different min_weight values

---

### QA-003: Component Coupling Returns Empty

**Severity:** Medium  
**Status:** ❌ Open  
**Category:** API Bug  
**Endpoint:** `GET /repos/{id}/coupling/components`

**Description:**  
Component coupling API returns empty results for most top-level components.

**Reproduction:**
```bash
curl "http://localhost:8000/repos/openhands/coupling/components?component=openhands&depth=2"
```

**Response:**
```json
{
  "component": "openhands",
  "depth": 2,
  "coupled_components": []
}
```

**Expected Behavior:**  
Should return coupled components like `tests`, `frontend`, etc.

**Analysis:**
- `component_edges` table may not be populated
- `min_component_cooccurrence=5` threshold may be too high
- Component depth calculation may have issues

**Workaround:**  
Query file-level coupling and aggregate manually.

**Next Steps:**
- [ ] Verify `component_edges` table has data
- [ ] Lower `min_component_cooccurrence` threshold
- [ ] Check component path extraction logic

---

## Fixed Issues

### QA-001: Evidence API Set Comprehension Bug

**Severity:** High  
**Status:** ✅ Fixed  
**Category:** API Bug  
**Endpoint:** `GET /repos/{id}/coupling/evidence`  
**Fixed In:** `lfca/api.py` (lines 516, 523)

**Description:**  
Evidence API returned error because `set(src_table.to_pylist())` failed - `to_pylist()` returns list of dicts which are not hashable.

**Original Code:**
```python
src_oids = set(src_table.to_pylist())  # TypeError: unhashable type 'dict'
```

**Fixed Code:**
```python
src_oids = {d["commit_oid"] for d in src_table.to_pylist()}
```

**Root Cause:**  
PyArrow's `to_pylist()` returns `[{"commit_oid": "abc"}, ...]` not `["abc", ...]`.

**Verification:**
```bash
# After fix, returns common commits
curl "http://localhost:8000/repos/openhands/coupling/evidence?src_id=135&dst_id=134"
# Returns: {"commits": [...], "src_path": "...", "dst_path": "..."}
```

---

## Known Behaviors (Not Bugs)

### QA-004: Hierarchical Clustering Single Cluster

**Severity:** Low  
**Status:** ⚠️ Known  
**Category:** Behavior

**Description:**  
Hierarchical clustering produces a single giant cluster containing all files.

**Analysis:**
- Default cut threshold is too permissive
- With sparse edges, hierarchical merges everything

**Result:**
```json
{
  "cluster_count": 1,
  "clusters": [{"id": 1, "size": 454, "avg_coupling": 0.59}]
}
```

**Recommendation:**  
Adjust `distance_threshold` parameter or use Louvain instead.

---

### QA-005: Sparse Clustering Graph

**Severity:** Low  
**Status:** ⚠️ Expected  
**Category:** Behavior

**Description:**  
Clustering produces 99.6% singleton clusters.

**Analysis:**
- 454 files at HEAD
- Only 61 files have edges (13.4%)
- 410 total edges
- `min_cooccurrence=5` filters most pairs

**Result:**
| Algorithm | Clusters | Singletons | Non-Singleton |
|-----------|----------|------------|---------------|
| Louvain | 447 | 445 | 2 |
| Label Propagation | 447 | 445 | 2 |

**Non-Singleton Clusters Found:**
1. Package management (7 files): poetry.lock, pyproject.toml, package.json, etc.
2. i18n files (2 files): translation.json, declaration.ts

**Recommendation:**  
Lower `min_cooccurrence` threshold for denser graphs.

---

### QA-006: File Count Discrepancy

**Severity:** Low  
**Status:** ⚠️ Expected  
**Category:** Behavior

**Description:**  
API reports fewer files than git.

| Source | Count |
|--------|-------|
| Git (`git ls-tree -r HEAD`) | 2,765 |
| LFCA API | 1,462 |
| Difference | 1,303 |

**Root Cause:**  
`min_revisions=5` filters files with fewer than 5 commits.

**Verification:**
```sql
-- In lfca.sqlite
SELECT COUNT(*) FROM files WHERE exists_at_head = 1;  -- 454 (current files)
SELECT COUNT(*) FROM files;  -- 1,462 (all tracked files)
```

---

### QA-007: Hotspot Ranking Differs from Git

**Severity:** Low  
**Status:** ⚠️ Expected  
**Category:** Behavior

**Description:**  
File commit counts differ from raw git analysis.

| File | Git Count | LFCA Count | Difference |
|------|-----------|------------|------------|
| poetry.lock | 748 | 16 | -732 |
| package-lock.json | 525 | 61 | -464 |
| package.json | 522 | 61 | -461 |
| pyproject.toml | 446 | 71 | -375 |

**Root Cause:**  
`max_changeset_size=50` excludes bulk commits (dependency updates, renames).

**Analysis:**
- poetry.lock changes mostly in bulk dependency update commits
- These are correctly filtered to avoid spurious coupling

---

## Test Scenarios

For comprehensive end-to-end test scenarios, expected results, and all API endpoints, see:

**[E2E Test Scenarios](e2e.md)**

---

## References

- [E2E Test Scenarios](e2e.md)
- [API QA Findings Report](details/API_QA_FINDINGS.md)
- [Detailed QA Report](details/DETAILED_QA_REPORT.md)
- [Ground Truth Findings](details/FINDINGS_REPORT.md)
- [Validation Report](details/VALIDATION_REPORT.md)
- [API Test Summary](details/API_TEST_SUMMARY.md)
- [Detailed Statistics](../../../QA/output/openhands/detailed_stats/)
- [API Code](../../../lfca/api.py)
