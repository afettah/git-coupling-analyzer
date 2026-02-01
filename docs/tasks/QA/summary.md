# QA Testing Strategy

**Status:** In Progress  
**Last Updated:** January 31, 2026  
**Reference Project:** OpenHands  
**Priority:** High

---

## Progress Summary

| Phase | Status | Completion |
|-------|--------|------------|
| Ground Truth Collection | ✅ Complete | 100% |
| API Test Framework | ✅ Complete | 100% |
| API Endpoint Testing | ✅ Complete | 100% |
| Validation Framework | ✅ Complete | 100% |
| Bug Fixes | 🔄 In Progress | 50% |
| Documentation | ✅ Complete | 100% |

**Overall Progress:** ~85%

---

## What Has Been Done

### 1. Ground Truth Data Collection ✅

Collected comprehensive baseline data from OpenHands repository:

| Data Type | Files | Description |
|-----------|-------|-------------|
| Repository Stats | `basic_stats.json` | 5,971 commits, 2,765 files, 459 authors |
| File Hotspots | `file_commits.json` | Top 100 files by commit count |
| Coupling Pairs | `coupling_ground_truth.json` | 273 pairs analyzed, 125 high-coupling |
| Co-change Analysis | `cochange_pairs.json` | 14,467 pairs with ≥3 co-changes |
| Author Analysis | `author_analysis.json` | Contributor statistics |
| Module Analysis | `module_analysis.json` | Folder-level statistics |
| Bulk Commits | `bulk_commits.json` | 75 commits with >50 files |
| Renames | `renames.json` | 1,541 file renames tracked |
| Deleted Files | `deleted_files.json` | 6,265 deleted files |

**Location:** `QA/output/openhands/`

### 2. API Test Framework ✅

Created Python scripts for automated API testing:

| Script | Purpose |
|--------|---------|
| `api_test_collector.py` | Collects responses from all API endpoints |
| `validate_api_results.py` | Validates API against ground truth |
| `collect_detailed_stats.py` | Collects per-file and clustering statistics |

**Location:** `QA/scripts/`

### 3. API Endpoints Tested ✅

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/repos` | GET | ✅ Working | Lists all repositories |
| `/repos/{id}/files` | GET | ✅ Working | Pagination, sorting, filtering |
| `/repos/{id}/files/tree` | GET | ✅ Working | Folder tree structure |
| `/repos/{id}/folders` | GET | ✅ Working | Folder listing at depth |
| `/repos/{id}/files/{path}/history` | GET | ✅ Working | File commit history |
| `/repos/{id}/coupling` | GET | ✅ Working | Coupled files list |
| `/repos/{id}/coupling/graph` | GET | ✅ Working | Visualization data |
| `/repos/{id}/coupling/evidence` | GET | ✅ Fixed | Bug fixed (see issues) |
| `/repos/{id}/coupling/components` | GET | ⚠️ Partial | Returns empty for most |
| `/repos/{id}/clustering/algorithms` | GET | ✅ Working | Lists algorithms |
| `/repos/{id}/clustering/run` | POST | ⚠️ Partial | Spectral fails |
| `/repos/{id}/analysis/status` | GET | ✅ Working | Run status info |

### 4. Detailed Statistics Collected ✅

| Data | File | Description |
|------|------|-------------|
| File Details | `file_details.json` | Top 100 files with coupling info |
| Clustering Results | `clustering_details.json` | 6 algorithm configurations tested |
| Folder Statistics | `folder_statistics.json` | 51 folders analyzed |
| Coupling Matrix | `coupling_matrix.json` | Top 30 files coupling matrix |

**Location:** `QA/output/openhands/detailed_stats/`

### 5. Bugs Found and Fixed ✅

| Bug | Location | Status |
|-----|----------|--------|
| Evidence API set comprehension | `lfca/api.py:516` | ✅ Fixed |

### 6. Documentation ✅

| Document | Location | Description |
|----------|----------|-------------|
| QA README | `QA/README.md` | Framework documentation |
| QA Index | `QA/output/openhands/QA_INDEX.md` | Data file index |
| Findings Report | `QA/output/openhands/FINDINGS_REPORT.md` | Ground truth analysis |
| API Findings | `QA/output/openhands/API_QA_FINDINGS.md` | API testing results |
| Validation Report | `QA/output/openhands/api_tests/VALIDATION_REPORT.md` | Automated validation |

---

## What Remains

### 1. Bug Fixes Required 🔄

| Issue | Priority | Status |
|-------|----------|--------|
| Spectral clustering fails | Medium | ❌ Open |
| Component coupling empty | Medium | ❌ Open |

### 2. Additional Testing (Optional)

- [ ] Test with second reference repository
- [ ] Performance testing with larger repos
- [ ] Frontend UI validation
- [ ] Snapshot CRUD endpoint testing

### 3. Acceptance Criteria Status

| Criterion | Status | Notes |
|-----------|--------|-------|
| Commit count matches git | ⚠️ Partial | 5,844 vs 5,971 (bulk filtered) |
| File count matches git | ⚠️ Partial | 1,462 vs 2,765 (min_revisions filtered) |
| Top 10 hottest files match | ⚠️ Partial | Ranking differs due to filtering |
| Known coupled pairs Jaccard > 0.5 | ✅ Pass | Lock files at 0.94 |
| Isolated files Jaccard < 0.1 | ✅ Pass | Singletons have 0 edges |
| Clusters logically related | ✅ Pass | Package cluster, i18n cluster |

**Note:** Discrepancies are expected and correct - LFCA intentionally filters bulk commits and low-activity files.

---

## Validation Results Summary

### Automated Validation: 33% Pass Rate

| Category | Passed | Total | Notes |
|----------|--------|-------|-------|
| File Counts | 0 | 1 | Expected - filtering applied |
| Hotspot Ranking | 0 | 9 | Expected - bulk commits filtered |
| Coupling Pairs | 2 | 3 | Working correctly |
| Clustering | 4 | 7 | Louvain works, spectral fails |
| Component Coupling | 0 | 3 | API returns empty |
| Evidence API | 6 | 10 | File IDs work, commits fail |

**Key Finding:** Most "failures" are expected due to LFCA's filtering behavior, not bugs.

---

## Key Findings

### 1. Data Filtering Explains Discrepancies

LFCA analysis configuration filters data:
- `min_revisions=5` → Files with <5 commits excluded
- `max_changeset_size=50` → Bulk commits excluded
- `min_cooccurrence=5` → Pairs with <5 co-occurrences excluded

This results in:
- 1,462 files (vs 2,765 raw)
- 5,844 commits (vs 5,971 raw)
- 410 edges (only pairs with ≥5 co-occurrences)
- 61 files with edges (13.4% of files)

### 2. Sparse Clustering Expected

With only 61 files having edges:
- Louvain produces 447 clusters, 445 singletons (99.6%)
- Only 2 meaningful clusters:
  - Package management (7 files)
  - i18n files (2 files)

### 3. Coupling Detection Works Correctly

High-coupling pairs verified:
- `package.json ↔ package-lock.json`: Jaccard = 0.94 ✅
- `translation.json ↔ declaration.ts`: Jaccard = 0.67 ✅
- `compose.yml ↔ docker-compose.yml`: Jaccard = 0.69 ✅

---

## Test Scenarios

For comprehensive end-to-end test scenarios including:
- Project lifecycle (create, analyze, delete)
- File exploration and details
- Coupling analysis
- All clustering algorithms and parameter combinations
- Snapshot management
- Error handling

**See: [E2E Test Scenarios](e2e.md)**

---

## References

- [E2E Test Scenarios](e2e.md)
- [QA Output Index](details/QA_INDEX.md)
- [API QA Findings](details/API_QA_FINDINGS.md)
- [Detailed QA Report](details/DETAILED_QA_REPORT.md)
- [Ground Truth Findings](details/FINDINGS_REPORT.md)
- [Validation Report](details/VALIDATION_REPORT.md)
- [API Test Summary](details/API_TEST_SUMMARY.md)
- [Issues Tracker](issues.md)
