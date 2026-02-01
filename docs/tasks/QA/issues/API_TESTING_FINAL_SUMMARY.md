# LFCA API Testing Final Summary

**Date:** 2026-02-01  
**Repository Tested:** openhands  
**Test Method:** API-only testing via HTTP endpoints  
**Server:** http://localhost:8000

---

## Overview

Comprehensive API testing revealed **critical data accuracy issues** alongside several functional problems. The core issue is that the analysis pipeline produces incomplete and corrupted data.

---

## Test Results by Category

### ✅ Functional (Working)

| Endpoint Category | Status | Notes |
|-------------------|--------|-------|
| Repository CRUD | ✅ Pass | Create, list, delete work correctly |
| Analysis trigger/status | ✅ Pass | Analysis runs and reports status |
| File listing | ✅ Pass | Basic listing, sorting, filtering work |
| Coupling queries | ✅ Pass | Returns coupled files with metrics |
| Clustering algorithms | ✅ Pass | 5 algorithms available and functional |
| Snapshot management | ✅ Pass | Save, load, delete snapshots work |

### ❌ Critical Issues

| ID | Issue | Impact |
|----|-------|--------|
| **006** | 84% of current files missing (451 vs 2,765) | Most files not analyzed |
| **004** | Git status markers (A, D, M) stored as files | Pollutes coupling results |
| **007** | History/lineage data corrupted | File history unusable |
| **COMP-1** | Test-implementation coupling not detected | Core use case broken |
| **COMP-2** | Enterprise module completely absent | Cannot analyze newer code |

### ⚠️ High Severity Issues

| ID | Issue | Impact |
|----|-------|--------|
| **COMP-3** | Commit counts underreported by 88-98% | Hotspot analysis misleading |
| **EDGE-004** | Empty folders array runs full clustering | Unexpected resource usage |
| **CLUST-3** | Inter-cluster edges always empty | Cluster comparison broken |

### ⚡ Medium/Low Severity Issues

| ID | Issue | Impact |
|----|-------|--------|
| **EDGE-001** | Non-existent repo returns 200 [] instead of 404 | API contract violation |
| **EDGE-002** | Negative limit parameter accepted | Validation gap |
| **EDGE-003** | Invalid algorithm returns empty results | Silent failure |
| **CLUST-1** | Invalid weight_column accepted silently | Confusing behavior |
| **008** | Tree shows fewer files than list (420 vs 451) | Minor inconsistency |

---

## Data Accuracy Summary

### Baseline vs API Comparison (openhands repo)

| Metric | Baseline (Ground Truth) | API Result | Delta |
|--------|-------------------------|------------|-------|
| Total Commits | 5,971 | 5,871 | -1.7% |
| Current Files | 2,765 | 451 | **-84%** |
| Total Files (historical) | 6,276 | 1,462 | **-77%** |
| Coupling Edges | N/A | 410 | - |

### Why Files Are Missing

1. **`min_revisions=5` threshold** - Files with <5 commits excluded
2. **`max_changeset_size=50`** - Large commits excluded
3. **Extraction errors** - Status codes (A/D/M) parsed as file paths

### Coupling Detection Failures

| Known Coupling Pair | Expected | API Result |
|---------------------|----------|------------|
| test_X.py ↔ X.py patterns | High Jaccard | NOT DETECTED |
| Enterprise module files | Present | FILE NOT FOUND |
| Core files (llm.py, agent_controller.py) | Have couplings | Empty `[]` |

---

## Root Cause Analysis

### 1. Git Log Parsing Corruption (`extract.py`)

Evidence in database:
```
file_id | path_latest          | total_commits
3       | M                    | 3272
2       | A                    | 773
1       | D                    | 249
46      | __LFCA_COMMIT__      | 95
47      | 437046f5a4519aa77... | 1
48      | engel.nyst@gmail.com | 1
```

These are clearly git log metadata (status codes, commit hashes, emails) being parsed as file paths.

### 2. Overly Aggressive Filtering

Default config excludes:
- Files with <5 commits (`min_revisions=5`)
- Commits touching >50 files (`max_changeset_size=50`)
- Pairs with <5 co-occurrences (`min_cooccurrence=5`)

Result: 84% of files and 88%+ of commit history excluded.

### 3. No Raw Data Preservation

Filtered metrics overwrite raw data, making it impossible to:
- Show actual commit counts for hotspot analysis
- Adjust thresholds after analysis
- Compare filtered vs unfiltered results

---

## Recommendations

### Immediate (P0)

1. **Fix git log parsing** - Root cause of file path corruption
2. **Filter synthetic entries** - Exclude A/D/M/__LFCA_COMMIT__ from API
3. **Add data quality warning** - Alert when <50% of HEAD files indexed

### Short-term (P1)

4. **Lower default thresholds** - `min_revisions=2` for better coverage
5. **Store raw commit counts** - Separate from filtered transaction counts
6. **Return proper HTTP errors** - 404 for missing repos, 400 for bad params

### Long-term (P2)

7. **Separate extraction from analysis** - Store all data, filter at query time
8. **Add incremental updates** - Allow re-analysis without full re-extraction
9. **Expose config in API** - Include thresholds in status response

---

## Test Artifacts Created

All issue files in `/docs/tasks/QA/issues/`:

### New Issues from This Testing Session
- `006-file-count-mismatch.md` - CRITICAL file count discrepancy
- `007-history-endpoint-data-corruption.md` - History data corruption
- `008-tree-endpoint-file-count-discrepancy.md` - Tree vs list mismatch
- `api-vs-baseline-comparison.md` - Full comparison report
- `coupling-api-test-report.md` - Coupling endpoint testing
- `clustering-api-issues.md` - Clustering issues
- `edge-cases-error-handling.md` - Error handling issues
- `ISSUE-001-invalid-metric-500-error.md` - Metric validation
- `ISSUE-002-component-naming-documentation.md` - Component naming
- `API_TESTING_FINAL_SUMMARY.md` - This summary

---

## Conclusion

The LFCA API is **functionally operational** but has **critical data accuracy problems** that render it unreliable for real-world use:

1. **Most files missing** (84%) due to aggressive filtering and parsing errors
2. **Coupling detection broken** for core use cases (test-impl pairs)
3. **Metrics misleading** (commit counts off by 88-98%)

**Priority:** Fix git log parsing and lower default thresholds before production use.
