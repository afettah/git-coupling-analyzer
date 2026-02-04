# QA Issues Tracker

**Last Updated:** February 1, 2026  
**Repository:** OpenHands (reference project)  
**Total Issues:** 28 Open | 5 Validated | 1 Known WIP | 1 Informational

---

## Quick Navigation

- [Critical Severity Issues (4)](#critical-severity-issues) 🔴
- [High Severity Issues (8)](#high-severity-issues) 🟠
- [Medium Severity Issues (13)](#medium-severity-issues) 🟡
- [Low Severity Issues (10)](#low-severity-issues) 🔵
- [Validated/Informational (6)](#validatedinformational-issues) ✅

---

## Issues Summary Table

| ID | Title | Severity | Category | Reproducibility | Status | Issue File |
|----|-------|----------|----------|-----------------|--------|------------|
| 002 | [Test-Implementation Coupling Not Detected](#issue-002) | 🔴 CRITICAL | Data Corruption | Always | Open | [002-test-impl-coupling-not-detected.md](issues/002-test-impl-coupling-not-detected.md) |
| 004 | [Git Status Markers Parsed as Filenames](#issue-004) | 🔴 CRITICAL | Data Corruption | Always | Open | [004-git-status-markers-as-files.md](issues/004-git-status-markers-as-files.md) |
| 006 | [Current Files Count Mismatch](#issue-006) | 🔴 CRITICAL | Data Corruption | Always | Open | [006-file-count-mismatch.md](issues/006-file-count-mismatch.md) |
| 007 | [File History Data Corruption](#issue-007) | 🔴 CRITICAL | Data Corruption | Always | Open | [007-history-endpoint-data-corruption.md](issues/007-history-endpoint-data-corruption.md) |
| 001 | [API Method Not Allowed Error](#issue-001) | 🟠 HIGH | API Bug | Always | Open | [001-api-method-not-allowed.md](issues/001-api-method-not-allowed.md) |
| 005 | [Incomplete Rename Detection](#issue-005) | 🟠 HIGH | Feature Missing | Always | Open | [005-rename-detection-not-working.md](issues/005-rename-detection-not-working.md) |
| E2E-001 | [File Details Returns Null Values](#issue-e2e-001) | 🟠 HIGH | API Bug | Always | Open | [1769908129883-file_details_empty.md](issues/1769908129883-file_details_empty.md) |
| E2E-003 | [Clustering Response Format Issues](#issue-e2e-003) | 🟠 HIGH | API Bug | Always | Open | [1769908129885-clustering_null_response.md](issues/1769908129885-clustering_null_response.md) |
| E2E-004 | [Hotspots Response Format Incompatible](#issue-e2e-004) | 🟠 HIGH | API Bug | Always | Open | [1769908129886-hotspots_response_format.md](issues/1769908129886-hotspots_response_format.md) |
| E2E-006 | [Required Endpoints Return 404](#issue-e2e-006) | 🟠 HIGH | Feature Missing | Always | Open | [1769908129888-missing_endpoints.md](issues/1769908129888-missing_endpoints.md) |
| EDGE-004 | [Empty Folders Array Runs Full Clustering](#issue-edge-004) | 🟠 HIGH | Validation Bug | Always | Open | [edge-cases-error-handling.md](issues/edge-cases-error-handling.md) |
| FE-002 | [Louvain Average Coupling Shows 0%](#issue-fe-002) | 🟠 HIGH | Data Bug | Always | Open | [issue-002-louvain-zero-coupling.md](issues/issue-002-louvain-zero-coupling.md) |
| 003 | [API Missing 'risk' Sort Option](#issue-003) | 🟡 MEDIUM | Feature Missing | Always | Open | [003-api-missing-risk-sort.md](issues/003-api-missing-risk-sort.md) |
| E2E-002 | [File List Filtering Broken](#issue-e2e-002) | 🟡 MEDIUM | API Bug | Always | Open | [1769908129884-file_list_prefix_broken.md](issues/1769908129884-file_list_prefix_broken.md) |
| VAL-001 | [Invalid Metric Parameter Causes 500 Error](#issue-val-001) | 🟡 MEDIUM | Validation Bug | Always | Open | [ISSUE-001-invalid-metric-500-error.md](issues/ISSUE-001-invalid-metric-500-error.md) |
| FE-001 | [File Details - Additions/Deletions Always Zero](#issue-fe-001) | 🟡 MEDIUM | Display Bug | Always | Open | [issue-001-zero-additions-deletions.md](issues/issue-001-zero-additions-deletions.md) |
| EDGE-001 | [Non-existent Repository Returns Empty Array](#issue-edge-001) | 🟡 MEDIUM | Validation Bug | Always | Open | [edge-cases-error-handling.md](issues/edge-cases-error-handling.md) |
| EDGE-003 | [Invalid Algorithm Returns Empty Results](#issue-edge-003) | 🟡 MEDIUM | Validation Bug | Always | Open | [edge-cases-error-handling.md](issues/edge-cases-error-handling.md) |
| EDGE-005 | [Missing Required Fields Uses Defaults](#issue-edge-005) | 🟡 MEDIUM | Validation Bug | Always | Open | [edge-cases-error-handling.md](issues/edge-cases-error-handling.md) |
| CLUS-001 | [Invalid weight_column Accepted Without Error](#issue-clus-001) | 🟡 MEDIUM | Validation Bug | Always | Open | [clustering-api-issues.md](issues/clustering-api-issues.md) |
| CLUS-003 | [Snapshot with Zero Clusters Exists](#issue-clus-003) | 🟡 MEDIUM | Data Bug | Always | Open | [clustering-api-issues.md](issues/clustering-api-issues.md) |
| CLUS-004 | [Inter-cluster Edges Always Empty](#issue-clus-004) | 🟡 MEDIUM | Feature Bug | Always | Open | [clustering-api-issues.md](issues/clustering-api-issues.md) |
| E2E-008 | [Verify Analysis Accuracy](#issue-e2e-008) | 🟡 MEDIUM | Validation | Always | Validation | [1769908129892-verify_analysis_accuracy.md](issues/1769908129892-verify_analysis_accuracy.md) |
| 008 | [Tree Endpoint File Count Discrepancy](#issue-008) | 🔵 LOW | Data Inconsistency | Always | Open | [008-tree-endpoint-file-count-discrepancy.md](issues/008-tree-endpoint-file-count-discrepancy.md) |
| DOC-002 | [Component Naming Documentation Gap](#issue-doc-002) | 🔵 LOW | Documentation | Always | Open | [ISSUE-002-component-naming-documentation.md](issues/ISSUE-002-component-naming-documentation.md) |
| FE-003 | [Analysis Options Not Implemented](#issue-fe-003) | 🔵 LOW | Feature Missing | Always | Expected | [issue-003-settings-not-implemented.md](issues/issue-003-settings-not-implemented.md) |
| FE-004 | [File Details Error Message Repeated](#issue-fe-004) | 🔵 LOW | UX Bug | Always | Open | [issue-004-repeated-error-messages.md](issues/issue-004-repeated-error-messages.md) |
| CLUS-002 | [Hierarchical Missing Parameter Validation](#issue-clus-002) | 🔵 LOW | Validation Bug | Always | Open | [clustering-api-issues.md](issues/clustering-api-issues.md) |
| EDGE-002 | [Negative Limit Parameter Accepted](#issue-edge-002) | 🔵 LOW | Validation Bug | Always | Open | [edge-cases-error-handling.md](issues/edge-cases-error-handling.md) |
| E2E-007 | [Coupling Data Validation](#issue-e2e-007) | 🔵 LOW | Validation | Always | Validated | [1769908129890-coupling_data_validation.md](issues/1769908129890-coupling_data_validation.md) |
| E2E-009 | [Hidden Dependencies Discovery](#issue-e2e-009) | 🔵 LOW | Validation | Always | Validated | [1769908129891-hidden_deps_discovery.md](issues/1769908129891-hidden_deps_discovery.md) |
| E2E-010 | [Real-World Coupling Examples](#issue-e2e-010) | 🔵 LOW | Validation | Always | Validated | [1769908129893-real_world_coupling_examples.md](issues/1769908129893-real_world_coupling_examples.md) |
| E2E-012 | [Performance Baseline](#issue-e2e-012) | ℹ️ INFO | Informational | N/A | N/A | [1769908129895-performance_baseline.md](issues/1769908129895-performance_baseline.md) |
| E2E-011 | [E2E Workflow Completeness](#issue-e2e-011) | ℹ️ INFO | Assessment | N/A | Documented | [1769908129894-e2e_workflow_completeness.md](issues/1769908129894-e2e_workflow_completeness.md) |

---

## Critical Severity Issues

### Issue 002
**Title:** Test-Implementation Coupling Not Detected  
**Category:** Data Corruption  
**Reproducibility:** Always  
**Status:** Open

**Description:**  
Database query returns 0 test-implementation coupling pairs despite ground truth showing 66 matched pairs between `tests/` and implementation code. Core business value feature not working - prevents finding test coverage gaps and orphaned tests.

**Business Impact:**  
Teams cannot identify which tests cover which implementation files, defeating a primary use case for coupling analysis.

**File:** [002-test-impl-coupling-not-detected.md](issues/002-test-impl-coupling-not-detected.md)

---

### Issue 004
**Title:** Git Status Markers Parsed as Filenames  
**Category:** Data Corruption  
**Reproducibility:** Always  
**Status:** Open

**Description:**  
Git markers 'M' (Modified), 'A' (Added), 'D' (Deleted) incorrectly stored as files with high commit counts (M: 3,272 commits). Corrupts all coupling analysis results and undermines trust in data. Database also contains commit hashes, emails, and timestamps as file paths.

**Business Impact:**  
Completely invalidates coupling analysis. Users cannot trust any results when core data is corrupted.

**File:** [004-git-status-markers-as-files.md](issues/004-git-status-markers-as-files.md)

---

### Issue 006
**Title:** Current Files Count Mismatch  
**Category:** Data Corruption  
**Reproducibility:** Always  
**Status:** Open

**Description:**  
API returns only 451 current files while ground truth shows 2,765 (83.7% missing). Database contains corrupted entries like commit hashes, emails, and timestamps as file paths. Extraction process stopped prematurely or parsed git log incorrectly.

**Business Impact:**  
Analysis is incomplete for 83.7% of codebase. Missing critical coupling relationships and hotspots.

**File:** [006-file-count-mismatch.md](issues/006-file-count-mismatch.md)

---

### Issue 007
**Title:** File History Data Corruption  
**Category:** Data Corruption  
**Reproducibility:** Always  
**Status:** Open

**Description:**  
History/commits endpoints return corrupted data - status field contains file paths/messages instead of A/M/D codes. Root cause is git log parsing misalignment in changes.parquet where columns shifted.

**Business Impact:**  
File history feature unusable. Cannot track file evolution or identify change patterns.

**File:** [007-history-endpoint-data-corruption.md](issues/007-history-endpoint-data-corruption.md)

---

## High Severity Issues

### Issue 001
**Title:** API Method Not Allowed Error  
**Category:** API Bug  
**Reproducibility:** Always  
**Status:** Open

**Description:**  
GET /repos/{repo_id} returns "Method Not Allowed" instead of repository details, breaking E2E test Scenario 1.2.

**File:** [001-api-method-not-allowed.md](issues/001-api-method-not-allowed.md)

---

### Issue 005
**Title:** Incomplete Rename Detection  
**Category:** Feature Missing  
**Reproducibility:** Always  
**Status:** Open

**Description:**  
Only 399 of 1,541 renames detected (25.8% rate). Missing 1,142 renames breaks file evolution tracking and creates duplicate file entries. Git `--follow` flag may not be used correctly.

**File:** [005-rename-detection-not-working.md](issues/005-rename-detection-not-working.md)

---

### Issue E2E-001
**Title:** File Details Returns Null Values  
**Category:** API Bug  
**Reproducibility:** Always  
**Status:** Open

**Description:**  
File details endpoint returns all null fields (file_id, path_current, commit_count, authors) despite file existing in database. Prevents drill-down analysis of file metadata.

**File:** [1769908129883-file_details_empty.md](issues/1769908129883-file_details_empty.md)

---

### Issue E2E-003
**Title:** Clustering Response Format Issues  
**Category:** API Bug  
**Reproducibility:** Always  
**Status:** Open

**Description:**  
Clustering endpoint returns null for clustering_id, module_count, quality fields despite completing successfully. Also uses inconsistent field names ("clusters" vs "modules"). Core feature unusable.

**File:** [1769908129885-clustering_null_response.md](issues/1769908129885-clustering_null_response.md)

---

### Issue E2E-004
**Title:** Hotspots Response Format Incompatible  
**Category:** API Bug  
**Reproducibility:** Always  
**Status:** Open

**Description:**  
Returns nested module structure instead of documented flat array, causing JSON parsing errors and breaking API contract.

**File:** [1769908129886-hotspots_response_format.md](issues/1769908129886-hotspots_response_format.md)

---

### Issue E2E-006
**Title:** Required Endpoints Return 404  
**Category:** Feature Missing  
**Reproducibility:** Always  
**Status:** Open

**Description:**  
Coupling-stats and modules endpoints return 404 Not Found. Features not implemented despite documentation references.

**File:** [1769908129888-missing_endpoints.md](issues/1769908129888-missing_endpoints.md)

---

### Issue EDGE-004
**Title:** Empty Folders Array Runs Full Clustering  
**Category:** Validation Bug  
**Reproducibility:** Always  
**Status:** Open

**Description:**  
Empty folders[] parameter should error but runs clustering on entire repo with 422 status yet returns valid results.

**File:** [edge-cases-error-handling.md](issues/edge-cases-error-handling.md)

---

### Issue FE-002
**Title:** Louvain Average Coupling Shows 0%  
**Category:** Data Bug  
**Reproducibility:** Always  
**Status:** Open

**Description:**  
Louvain clustering displays 0% average coupling while DBSCAN correctly shows 72%. Issue isolated to Louvain average calculation logic.

**File:** [issue-002-louvain-zero-coupling.md](issues/issue-002-louvain-zero-coupling.md)

---

## Medium Severity Issues

### Issue 003
**Title:** API Missing 'risk' Sort Option  
**Category:** Feature Missing  
**Reproducibility:** Always  
**Status:** Open

**Description:**  
/files endpoint doesn't support sort_by=risk despite risk_score field existing. Business use case "show riskiest files" not working.

**File:** [003-api-missing-risk-sort.md](issues/003-api-missing-risk-sort.md)

---

### Issue E2E-002
**Title:** File List Filtering Broken  
**Category:** API Bug  
**Reproducibility:** Always  
**Status:** Open

**Description:**  
Both prefix and search parameters ignored. Prefix=frontend/src/ returns .github/ files. Search parameter returns random unrelated files. Cannot browse directory structure or find specific files.

**Note:** Consolidates issues 1769908129884 (prefix) and 1769908129887 (search) - same root cause.

**File:** [1769908129884-file_list_prefix_broken.md](issues/1769908129884-file_list_prefix_broken.md)

---

### Issue VAL-001
**Title:** Invalid Metric Parameter Causes 500 Error  
**Category:** Validation Bug  
**Reproducibility:** Always  
**Status:** Open

**Description:**  
Invalid metric parameter returns 500 instead of 400 validation error with helpful message listing valid options.

**File:** [ISSUE-001-invalid-metric-500-error.md](issues/ISSUE-001-invalid-metric-500-error.md)

---

### Issue FE-001
**Title:** File Details - Additions/Deletions Always Zero  
**Category:** Display Bug  
**Reproducibility:** Always  
**Status:** Open

**Description:**  
All files show 0 additions and 0 deletions despite significant history. Backend not calculating line changes from git.

**File:** [issue-001-zero-additions-deletions.md](issues/issue-001-zero-additions-deletions.md)

---

### Issue EDGE-001
**Title:** Non-existent Repository Returns Empty Array  
**Category:** Validation Bug  
**Reproducibility:** Always  
**Status:** Open

**Description:**  
Should return 404 but returns 200 with empty array instead. Missing repository validation middleware.

**File:** [edge-cases-error-handling.md](issues/edge-cases-error-handling.md)

---

### Issue EDGE-003
**Title:** Invalid Algorithm Returns Empty Results  
**Category:** Validation Bug  
**Reproducibility:** Always  
**Status:** Open

**Description:**  
Returns 422 with empty cluster data instead of clear error message listing valid algorithms.

**File:** [edge-cases-error-handling.md](issues/edge-cases-error-handling.md)

---

### Issue EDGE-005
**Title:** Missing Required Fields Uses Defaults  
**Category:** Validation Bug  
**Reproducibility:** Always  
**Status:** Open

**Description:**  
Empty request body uses defaults without validation error. Should require explicit parameters.

**File:** [edge-cases-error-handling.md](issues/edge-cases-error-handling.md)

---

### Issue CLUS-001
**Title:** Invalid weight_column Accepted Without Error  
**Category:** Validation Bug  
**Reproducibility:** Always  
**Status:** Open

**Description:**  
Invalid weight_column values accepted, returns results instead of 400 validation error.

**File:** [clustering-api-issues.md](issues/clustering-api-issues.md)

---

### Issue CLUS-003
**Title:** Snapshot with Zero Clusters Exists  
**Category:** Data Bug  
**Reproducibility:** Always  
**Status:** Open

**Description:**  
Snapshot test_snapshot_20260201_021841 has 0 clusters and 0 files, likely test artifact but indicates edge case.

**File:** [clustering-api-issues.md](issues/clustering-api-issues.md)

---

### Issue CLUS-004
**Title:** Inter-cluster Edges Always Empty  
**Category:** Feature Bug  
**Reproducibility:** Always  
**Status:** Open

**Description:**  
Edge endpoint always returns empty list even for multi-cluster snapshots. Cannot analyze inter-cluster relationships.

**File:** [clustering-api-issues.md](issues/clustering-api-issues.md)

---

### Issue E2E-008
**Title:** Verify Analysis Accuracy  
**Category:** Validation  
**Reproducibility:** Always  
**Status:** Validation (Passed)

**Description:**  
Spot-check metrics match ground truth. Commit count (5,871) and file count (1,462) confirmed within expected ranges after filtering.

**File:** [1769908129892-verify_analysis_accuracy.md](issues/1769908129892-verify_analysis_accuracy.md)

---

## Low Severity Issues

### Issue 008
**Title:** Tree Endpoint File Count Discrepancy  
**Category:** Data Inconsistency  
**Reproducibility:** Always  
**Status:** Open

**Description:**  
Tree endpoint returns 420 files while list endpoint returns 451 (31 missing, 6.9% discrepancy). Minor UI inconsistency.

**File:** [008-tree-endpoint-file-count-discrepancy.md](issues/008-tree-endpoint-file-count-discrepancy.md)

---

### Issue DOC-002
**Title:** Component Naming Documentation Gap  
**Category:** Documentation  
**Reproducibility:** Always  
**Status:** Open

**Description:**  
Component coupling endpoint uses unintuitive names (A, D, M, internal markers) instead of folder paths. No discovery endpoint.

**File:** [ISSUE-002-component-naming-documentation.md](issues/ISSUE-002-component-naming-documentation.md)

---

### Issue FE-003
**Title:** Analysis Options Not Implemented  
**Category:** Feature Missing  
**Reproducibility:** Always  
**Status:** Expected (Known WIP)

**Description:**  
Settings page shows "Settings View (TODO)" placeholder. Intentional work-in-progress, not a bug.

**File:** [issue-003-settings-not-implemented.md](issues/issue-003-settings-not-implemented.md)

---

### Issue FE-004
**Title:** File Details Error Message Repeated  
**Category:** UX Bug  
**Reproducibility:** Always  
**Status:** Open

**Description:**  
Non-existent file error message displayed 4 times instead of once. React component rendering issue.

**File:** [issue-004-repeated-error-messages.md](issues/issue-004-repeated-error-messages.md)

---

### Issue CLUS-002
**Title:** Hierarchical Missing Parameter Validation  
**Category:** Validation Bug  
**Reproducibility:** Always  
**Status:** Open

**Description:**  
Returns 1 cluster with all files instead of error when n_clusters/distance_threshold omitted.

**File:** [clustering-api-issues.md](issues/clustering-api-issues.md)

---

### Issue EDGE-002
**Title:** Negative Limit Parameter Accepted  
**Category:** Validation Bug  
**Reproducibility:** Always  
**Status:** Open

**Description:**  
Negative limit values accepted and return all data. Should validate limit >= 0.

**File:** [edge-cases-error-handling.md](issues/edge-cases-error-handling.md)

---

### Issue E2E-007
**Title:** Coupling Data Validation  
**Category:** Validation  
**Reproducibility:** Always  
**Status:** Validated

**Description:**  
Verified Jaccard/pair_count calculations match ground truth for package.json pairs. Metrics accurate.

**File:** [1769908129890-coupling_data_validation.md](issues/1769908129890-coupling_data_validation.md)

---

### Issue E2E-009
**Title:** Hidden Dependencies Discovery  
**Category:** Validation  
**Reproducibility:** Always  
**Status:** Validated

**Description:**  
Validated system identifies non-obvious relationships (package.json ↔ package-lock.json at 96.7%). Feature working correctly.

**File:** [1769908129891-hidden_deps_discovery.md](issues/1769908129891-hidden_deps_discovery.md)

---

### Issue E2E-010
**Title:** Real-World Coupling Examples  
**Category:** Validation  
**Reproducibility:** Always  
**Status:** Validated

**Description:**  
Confirmed system finds architectural dependencies (docs/i18n ↔ docs/modules, docker ↔ docs). Feature working correctly.

**File:** [1769908129893-real_world_coupling_examples.md](issues/1769908129893-real_world_coupling_examples.md)

---

## Validated/Informational Issues

### Issue E2E-012
**Title:** Performance Baseline  
**Category:** Informational  
**Status:** N/A

**Description:**  
Documents performance: coupling queries 50-100ms, clustering 2-5s for 1,462 files. Acceptable scalability for current dataset size.

**File:** [1769908129895-performance_baseline.md](issues/1769908129895-performance_baseline.md)

---

### Issue E2E-011
**Title:** E2E Workflow Completeness  
**Category:** Assessment  
**Status:** Documented

**Description:**  
Documents working features (core analysis, coupling, clustering) vs broken features (file details, search, stats endpoints).

**File:** [1769908129894-e2e_workflow_completeness.md](issues/1769908129894-e2e_workflow_completeness.md)

---

## Category Breakdown

| Category | Count | Issues |
|----------|-------|--------|
| Data Corruption | 4 | 002, 004, 006, 007 |
| API Bug | 8 | 001, E2E-001, E2E-002, E2E-003, E2E-004 |
| Feature Missing | 3 | 003, 005, E2E-006 |
| Validation Bug | 9 | VAL-001, EDGE-001, EDGE-002, EDGE-003, EDGE-004, EDGE-005, CLUS-001, CLUS-002 |
| Data Bug | 2 | FE-002, CLUS-003 |
| Feature Bug | 1 | CLUS-004 |
| Display Bug | 1 | FE-001 |
| Data Inconsistency | 1 | 008 |
| Documentation | 1 | DOC-002 |
| UX Bug | 1 | FE-004 |
| Validation/Assessment | 5 | E2E-007, E2E-008, E2E-009, E2E-010, E2E-011 |
| Informational | 1 | E2E-012 |

---

## Status Breakdown

| Status | Count |
|--------|-------|
| Open | 28 |
| Validated | 4 |
| Documented | 1 |
| Expected (WIP) | 1 |
| Informational | 1 |

---

## Critical Path to Fix

### Phase 1: Data Integrity (URGENT) 🚨
**Estimated Effort:** 5-7 days

Fix git log parsing that's causing corrupted data:

1. **Issue 004** - Git status markers as files (2 days)
   - Fix git log parsing in extract.py
   - Add validation to reject non-file entries
   
2. **Issue 006** - File count mismatch (2 days)
   - Ensure complete file extraction
   - Add HEAD file list validation
   
3. **Issue 007** - History endpoint corruption (1 day)
   - Fix column alignment in changes.parquet
   - Validate status field values
   
4. **Issue 002** - Test-impl coupling not detected (2 days)
   - Debug query logic for test file matching
   - Verify path pattern matching

### Phase 2: Critical API Fixes (HIGH) 🔴
**Estimated Effort:** 3-4 days

1. **Issue E2E-001** - File details null values (1 day)
2. **Issue E2E-003** - Clustering response format (1 day)
3. **Issue 005** - Rename detection (1-2 days)

### Phase 3: Feature Completion (MEDIUM) 🟡
**Estimated Effort:** 2-3 days

1. **Issue E2E-006** - Missing endpoints (1 day)
2. **Issue E2E-002** - File filtering (prefix/search) (1 day)
3. **Issue 003** - Risk sort option (0.5 days)

### Phase 4: Validation & Polish (LOW) 🔵
**Estimated Effort:** 2-3 days

1. Add proper validation for all API parameters (1 day)
2. Fix UI bugs and inconsistencies (1 day)
3. Update documentation (1 day)

---

## Notes on Removed Duplicates

The following duplicate issues were merged into consolidated issues:

- **1769908129887-file_search_broken.md** → Merged into E2E-002 (File List Filtering Broken)
- **1769908129889-clustering_response_format.md** → Merged into E2E-003 (Clustering Response Format Issues)

Issues 004, 006, and 007 all stem from the same root cause (git log parsing corruption) but affect different areas, so they are tracked separately for targeted fixes.

---

## References

- [E2E Test Summary](E2E_TEST_SUMMARY.md)
- [Issues Index](ISSUES_INDEX.md)
- [QA Summary](summary.md)
- [Individual Issue Files](issues/)
