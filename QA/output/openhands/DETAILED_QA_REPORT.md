# Detailed QA Report - LFCA API Testing

**Generated:** 2026-01-31 22:47 CET  
**Repository:** OpenHands  
**Git Commits:** 5,944 | **API Commits:** 5,871 (filtered)

---

## Executive Summary

| Category | Status | Critical Issues |
|----------|--------|-----------------|
| Data Integrity | 🔴 **CRITICAL** | Garbage data in files table (git status codes, emails) |
| File Listing API | ⚠️ Partial | Search uses prefix-only, no offset pagination |
| File Tree API | 🔴 **BUG** | Returns empty children (format mismatch) |
| Coupling API | ✅ Working | Jaccard formula verified correct |
| Evidence API | ✅ Working | Returns common commits |
| Clustering API | ⚠️ Partial | Works but 99.5% singletons |
| Component Coupling | 🔴 **BUG** | Returns empty despite DB having data |
| File History API | ✅ Working | Path routing works correctly |
| Snapshots API | ✅ Working | CRUD operations functional |

**Overall Pass Rate:** 60% (12/20 tests passed)

---

## 1. CRITICAL: Data Corruption

### Issue
The extraction pipeline is incorrectly treating git status codes and metadata as file paths.

### Evidence
```sql
-- Garbage entries in files table:
file_id | path_current                                      | total_commits
--------|---------------------------------------------------|---------------
1       | D                                                 | 249
2       | A                                                 | 773  
3       | M                                                 | 3272
34      | R091                                              | 3
46      | __LFCA_COMMIT__                                   | 95
48      | engel.nyst@gmail.com                              | 1
71      | neubig@gmail.com                                  | 3
...     | (30+ email addresses stored as file paths)        | ...
```

### Impact
- **62 garbage file entries** polluting the database
- **52 corrupted edges** linking these fake files
- Top coupling pairs show `A | M` with 653 co-occurrences (should be filtered)
- Skews clustering results

### Root Cause
Likely parsing `git log --name-status` output incorrectly - status codes (A=Added, M=Modified, D=Deleted) and author emails are being captured as file paths.

### Recommendation
1. Fix extraction pipeline to properly parse git output
2. Add validation: reject paths that match email pattern or are single characters
3. Clean corrupted data: `DELETE FROM files WHERE path_current IN ('A','M','D') OR path_current LIKE '%@%'`

---

## 2. API Issues

### 2.1 File Tree API - BUG 🔴

**Endpoint:** `GET /repos/{repo_id}/files/tree`

**Issue:** Returns `{"children": []}` (empty) despite 451 files existing.

**Root Cause:**
```python
# sync.py build_file_tree returns:
{'containers': {'__type': 'dir', '__children': {...}}, ...}

# API expects (for frontend):
{'children': [{'name': 'containers', 'isFolder': true, ...}]}
```

**Fix Required:** Transform tree dict to array format before returning.

---

### 2.2 File Search API - BUG 🔴

**Endpoint:** `GET /repos/{repo_id}/files?q=runtime`

**Issues:**
1. Uses `LIKE '{q}%'` (prefix only) instead of `LIKE '%{q}%'` (contains)
2. Search for "runtime" returns 0 files, but 5 files contain "runtime" in path

**Evidence:**
```bash
# API returns:
Found: 0

# DB has:
openhands/runtime/README.md
openhands/runtime/impl/kubernetes/README.md
openhands/runtime/impl/kubernetes/kubernetes_runtime.py
openhands/runtime/impl/local/local_runtime.py
third_party/runtime/impl/daytona/README.md
```

**Fix Required:** Change `f"{q}%"` to `f"%{q}%"` in api.py line 320.

---

### 2.3 Pagination Missing - BUG 🔴

**Endpoint:** `GET /repos/{repo_id}/files?offset=5`

**Issue:** `offset` parameter is accepted but not used in query.

**Evidence:**
```
Page 1 (offset=0): pyproject.toml, package-lock.json, package.json...
Page 2 (offset=5): pyproject.toml, package-lock.json, package.json... (SAME!)
```

**Fix Required:** Add `OFFSET {offset}` to SQL query.

---

### 2.4 Component Coupling - BUG 🔴

**Endpoint:** `GET /repos/{repo_id}/coupling/components?component=frontend`

**Issue:** Returns `{"coupled_components": []}` despite 87 component edges in database.

**Evidence:**
```sql
-- DB has:
frontend/package-lock.json | frontend/package.json | jaccard=0.9365
containers/dev | docker-compose.yml | jaccard=0.8431
containers/dev | frontend/package-lock.json | jaccard=0.8197
...

-- API returns:
{"component": "frontend", "depth": 2, "coupled_components": []}
```

**Root Cause:** Component edges are stored with full file paths, but API searches by folder prefix.

---

### 2.5 File Details/History Path Routing

**Endpoint:** `GET /repos/{repo_id}/files/{id}/details`

**Issue:** Using numeric ID fails with 404, must use file path.

**Working:** `GET /repos/openhands/files/pyproject.toml/history` ✅  
**Failing:** `GET /repos/openhands/files/130/history` ❌ (returns 404)

**Note:** FastAPI path parameter `{path:path}` expects string path, not ID.

---

## 3. Verified Working APIs ✅

### 3.1 Coupling API
```bash
GET /repos/openhands/coupling?path=pyproject.toml
# Returns: 6 coupled files with correct Jaccard scores
```

### 3.2 Jaccard Formula Verification
```sql
-- All 410 edges verified correct:
jaccard = pair_count / (src_count + dst_count - pair_count)
-- Status: 100% PASS
```

### 3.3 Conditional Probability Verification  
```sql
-- p_dst_given_src = pair_count / src_count
-- Status: 100% PASS
```

### 3.4 Coupling Evidence API
```bash
GET /repos/openhands/coupling/evidence?src_id=130&dst_id=135
# Returns: Common commits between pyproject.toml and package.json
```

### 3.5 Clustering Algorithms
| Algorithm | Status | Clusters | Singletons |
|-----------|--------|----------|------------|
| louvain | ✅ | 444 | 99.5% |
| label_propagation | ✅ | 444 | 99.5% |
| dbscan | ✅ | 2 | 0% |
| hierarchical | ✅ | 1 | 0% |
| components | ✅ | 444 | 99.5% |

### 3.6 Impact/Graph Endpoints
```bash
GET /repos/openhands/impact?path=pyproject.toml&top=3  # ✅
GET /repos/openhands/coupling/graph?path=pyproject.toml  # ✅ (7 nodes, 6 edges)
```

---

## 4. Ground Truth Comparison

### 4.1 Hotspot Ranking

| File | Git Commits | API Commits | Difference | Explanation |
|------|-------------|-------------|------------|-------------|
| poetry.lock | 748 | 16 | -732 | Bulk commits filtered |
| frontend/package-lock.json | 524 | 61 | -463 | Bulk commits filtered |
| pyproject.toml | 445 | 71 | -374 | Bulk commits filtered |
| README.md | 251 | 20 | -231 | Bulk commits filtered |

**Note:** Differences are expected due to `max_changeset_size=50` filter.

### 4.2 Co-change Pairs

| Pair | Git Co-changes | API Pair Count | Match |
|------|----------------|----------------|-------|
| package.json ↔ package-lock.json | 501 | 59 | ⚠️ Lower (filtered) |
| poetry.lock ↔ pyproject.toml | 317 | 12 | ⚠️ Lower (filtered) |
| i18n/declaration.ts ↔ translation.json | 140 | - | Not in top edges |

---

## 5. Database Statistics

```
Total files:        1,462
Files at HEAD:        451
Deleted files:      1,011
Garbage entries:       36  ← CRITICAL
Total edges:          410
Valid edges:          358  ← After removing garbage
Component edges:       87
```

---

## 6. Recommendations

### High Priority (Blocking)
1. **Fix data extraction pipeline** - Stop capturing git status codes/emails as paths
2. **Fix file tree format** - Transform to `{children: [...]}` format
3. **Fix search** - Change to contains (`%q%`) not prefix (`q%`)
4. **Add offset to pagination**

### Medium Priority
5. **Fix component coupling query** - Match folder prefix correctly
6. **Clean garbage data** - Remove A/M/D and email entries
7. **Add validation** - Reject invalid file paths during extraction

### Low Priority
8. **Add edge density metrics** - Help explain sparse clustering
9. **Document filtering behavior** - Explain why counts differ from raw git

---

## 7. Test Commands Used

```bash
# Repo stats
curl http://localhost:8000/repos

# File listing
curl "http://localhost:8000/repos/openhands/files?sort_by=commits&limit=10"

# Search (broken)
curl "http://localhost:8000/repos/openhands/files?q=runtime"

# Coupling
curl "http://localhost:8000/repos/openhands/coupling?path=pyproject.toml"

# Evidence
curl "http://localhost:8000/repos/openhands/coupling/evidence?src_id=130&dst_id=135"

# Clustering
curl -X POST "http://localhost:8000/repos/openhands/clustering/run" \
  -H "Content-Type: application/json" \
  -d '{"algorithm": "louvain", "min_weight": 0.1}'
```

---

*Report generated by LFCA QA Test Suite*
