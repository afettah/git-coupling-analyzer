# QA Issues Index

**Date Generated**: 2026-02-01  
**Total Issues**: 13  
**Test Subject**: Git Coupling Analyzer - OpenHands Project  

---

## Quick Navigation

### 🔴 Critical Issues (Block Core Features)

| # | Title | Status | Effort |
|---|-------|--------|--------|
| [1](issues/1769908129883-file_details_empty.md) | File Details Endpoint Returns Null Values | Not Started | Medium |
| [2](issues/1769908129884-file_list_prefix_broken.md) | File List Prefix Parameter Not Working | Not Started | Low |
| [3](issues/1769908129885-clustering_null_response.md) | Clustering Endpoint Returns Null Fields | Not Started | Medium |
| [6](issues/1769908129888-missing_endpoints.md) | Multiple Required Endpoints Return 404 | Not Started | Medium |

---

### 🟡 Medium Issues (Impacts Usability)

| # | Title | Status | Effort |
|---|-------|--------|--------|
| [5](issues/1769908129887-file_search_broken.md) | File Search Parameter Does Not Filter | Not Started | Low |
| [9](issues/1769908129889-clustering_response_format.md) | Clustering Response Format Inconsistency | Not Started | Low |

---

### ℹ️ Informational/Validation Issues

| # | Title | Purpose | Status |
|---|-------|---------|--------|
| [4](issues/1769908129886-hotspots_response_format.md) | Hotspots Response Format | API Design | Documented |
| [7](issues/1769908129890-coupling_data_validation.md) | Coupling Accuracy Validation | Verification | ✓ PASSED |
| [8](issues/1769908129892-verify_analysis_accuracy.md) | Analysis Accuracy Validation | Verification | ✓ PASSED |
| [10](issues/1769908129893-real_world_coupling_examples.md) | Real-World Use Cases | Business | ✓ VERIFIED |
| [11](issues/1769908129894-e2e_workflow_completeness.md) | Workflow Status | Summary | ✓ DOCUMENTED |
| [12](issues/1769908129895-performance_baseline.md) | Performance Baseline | Scalability | ✓ MEASURED |

---

## Issue Details by Category

### API Endpoints

**Status: ✗ Mostly Broken**

- ✗ `GET /repos/{repo}/files/{path}/details` - Returns null
- ✗ `GET /repos/{repo}/files?search=...` - Ignores search parameter
- ✗ `GET /repos/{repo}/files?prefix=...` - Ignores prefix parameter
- ✗ `GET /repos/{repo}/coupling-stats` - Endpoint missing (404)
- ✗ `GET /repos/{repo}/modules` - Endpoint missing (404)
- ⚠ `POST /repos/{repo}/clustering/run` - Works but response format inconsistent
- ✓ `GET /repos/{repo}/coupling?path=...` - Working correctly

### Data Integrity

**Status: ✓ Verified Correct**

- ✓ File counts match ground truth (1,462 files)
- ✓ Commit counts match ground truth (5,871 commits)
- ✓ Coupling calculations accurate
- ✓ Jaccard similarity validated
- ✓ Database schema correct

### Business Features

**Status: ✓ Core Working, Some Gaps**

- ✓ Identify hidden dependencies
- ✓ Cross-component coupling analysis
- ✓ Change impact prediction
- ⚠ Knowledge distribution analysis (needs file details endpoint)

---

## Critical Path to MVP

### Phase 1: Core Fixes (2-3 days)
1. Fix file details endpoint - [Issue #1](issues/1769908129883-file_details_empty.md)
2. Implement file search - [Issue #5](issues/1769908129887-file_search_broken.md)
3. Fix prefix/directory browsing - [Issue #2](issues/1769908129884-file_list_prefix_broken.md)

### Phase 2: API Completeness (1-2 days)
1. Standardize response formats - [Issue #3, #9](issues/1769908129889-clustering_response_format.md)
2. Add coupling-stats endpoint - [Issue #6](issues/1769908129888-missing_endpoints.md)
3. Add modules endpoint - [Issue #6](issues/1769908129888-missing_endpoints.md)

### Phase 3: Quality (1+ days)
1. Performance optimization - [Issue #12](issues/1769908129895-performance_baseline.md)
2. Edge case testing
3. Documentation updates

---

## Test Results Summary

```
Total Scenarios: 10
Passed:          6 (60%)
Failed:          4 (40%)

✓ Coupling Analysis:     PASS
✓ Limit Parameters:      PASS  
✓ Project Metrics:       PASS
✓ Error Handling:        PASS
✓ Empty Results:         PASS
✓ Clustering Algorithm:  PASS (with format issues)

✗ File Details:          FAIL
✗ File Search:           FAIL
✗ Directory Browse:      FAIL
✗ Missing Endpoints:     FAIL
```

---

## Evidence Files

### Test Documents
- [E2E Test Summary](E2E_TEST_SUMMARY.md) - Comprehensive report
- [Issues Index](ISSUES_INDEX.md) - This file
- [e2e.md](e2e.md) - Original test specification

### Test Scripts
- `/tmp/e2e_tests.sh` - API test suite
- `/tmp/extended_e2e_tests.sh` - Extended scenarios
- `/tmp/create_issues.sh` - Issue documentation script

### Test Database
- Path: `/home/afettah/workspace/git-coupling-analyzer/data/repos/openhands/lfca.sqlite`
- Files: 1,462 total (451 at HEAD)
- Edges: 410 verified

---

## How to Use This Index

### For Developers Fixing Issues
1. Pick an issue from the **Critical Issues** section
2. Open the issue file (e.g., [Issue #1](issues/1769908129883-file_details_empty.md))
3. Read: Description, Expected Result, Current Result, Steps to Reproduce
4. Implement fix
5. Verify with provided test case
6. Update issue status in this index

### For Project Managers
1. Review **Critical Path to MVP** section
2. Estimate fix effort using provided effort ratings
3. Track progress using issue status column
4. Review **Test Results Summary** for current completion

### For QA/Testing
1. Review **Evidence Files** section for test artifacts
2. Run test scripts to reproduce issues
3. Update issue status as fixes are verified
4. Add regression tests for fixed issues

---

## Success Criteria

### MVP Success
- [ ] All critical issues fixed
- [ ] API endpoints return proper responses
- [ ] File metadata accessible
- [ ] File search working
- [ ] Response formats standardized
- [ ] All 13 test scenarios pass

### Launch Success
- [ ] 0 critical issues open
- [ ] All endpoints documented
- [ ] Performance tested at scale
- [ ] User guide available
- [ ] No data integrity issues

---

## Notes

- All timestamps use ISO 8601 format (UTC)
- File paths are absolute and workspace-relative
- Test database preserved for reference
- Original e2e.md specification untouched

---

**Last Updated**: 2026-02-01  
**Tester**: Automated E2E Suite  
**Status**: Testing Complete, Issues Documented
