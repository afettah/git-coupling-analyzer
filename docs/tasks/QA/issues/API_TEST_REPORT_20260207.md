# API Deep Test Report — 2026-02-07

**Repository Under Test:** OpenHands (`/tmp/OpenHands`)  
**Repo ID:** `openhands`  
**Analysis State:** complete (5971 commits, 4450 tracked files)

---

## Summary

| Category | Tests | Passed | Failed | Issues Created |
|----------|-------|--------|--------|----------------|
| File Counts | 4 | 1 | 3 | #003, #004 |
| Commit Counts | 5 | 0 | 5 | (covered by #004, #008) |
| Coupling Accuracy | 4 | 2 | 2 | #008, #012 |
| Clustering | 6 | 2 | 4 | #005, #006, #007 |
| File Tree / Folders | 5 | 3 | 2 | (covered by #004) |
| Error Handling | 6 | 3 | 3 | #009, #010, #011 |
| **Total** | **30** | **11** | **19** | **10 new issues** |

---

## New Issues (003-012)

| Issue | Severity | Title |
|-------|----------|-------|
| 003 | High | `/files` endpoint `path` param ignored — uses `q` instead |
| 004 | High | `exists_at_head` count (2065) doesn't match git HEAD (2765) — 700 missing |
| 005 | High | Spectral clustering returns 500 Internal Server Error |
| 006 | Medium | Hierarchical clustering returns only 1 cluster |
| 007 | Medium | Louvain resolution parameter barely affects results (1849→1868) |
| 008 | High | Coupling Jaccard discrepancy: package.json↔lock API=0.598 vs git=0.936 |
| 009 | Low | Invalid repo returns `[]` instead of 404 |
| 010 | Low | Invalid clustering algorithm returns 500 instead of 400 |
| 011 | Medium | `/files/{path}/details` coupled_files empty despite edges existing |
| 012 | High | Enterprise files with perfect coupling (jaccard=1.0) return empty from API |

---

## Detailed Test Results

### File & Commit Counts

| Metric | Git Ground Truth | API/DB | Status |
|--------|-----------------|--------|--------|
| Total commits | 5971 | 5971 | PASS |
| Files at HEAD | 2765 | 2065 (DB) | FAIL (-700) |
| Total tracked files | — | 4450 | — |
| pyproject.toml commits | 446 | 426 (details) / 2 (list) | FAIL |
| README.md commits | 251 | ? (details) / 2 (list) | FAIL |
| frontend/package.json commits | 522 | 506 (details) / 2 (list) | PARTIAL |

### Coupling Accuracy

| Pair | Git Jaccard | API Jaccard | Status |
|------|-------------|-------------|--------|
| package.json ↔ package-lock.json | 0.936 | 0.598 | FAIL |
| compose.yml ↔ docker-compose.yml | 0.723 | 0.807 | PASS (within range) |
| pyproject.toml ↔ poetry.lock | 0.50+ | 0.519 | PASS |
| jira_view ↔ test_jira_view | 1.0 | not found | FAIL |

### Clustering

| Algorithm | Cluster Count | Status |
|-----------|--------------|--------|
| Louvain (default) | 1851 (mostly singletons) | PARTIAL |
| Louvain (res=0.5) | 1849 | FAIL (should be fewer) |
| Louvain (res=2.0) | 1868 | FAIL (should be more) |
| Hierarchical | 1 | FAIL |
| Spectral | 500 error | FAIL |
| DBSCAN | 11 | PASS |
| Label Propagation | 1871 | PARTIAL |

### Error Handling

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| Invalid repo → /files | 404 | 200 + `[]` | FAIL |
| Nonexistent file → /coupling | 404 error | 404 error | PASS |
| Empty path → /coupling | 400/404 | 404 | PASS |
| Invalid algorithm | 400/422 | 500 | FAIL |
| Malformed JSON | 422 | 422 | PASS |
| Wrong HTTP methods | 405 | 405 | PASS |
