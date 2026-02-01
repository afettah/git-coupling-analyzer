# Issue #002: Test-Implementation Coupling Not Detected

## Description
Database query fails to find test-implementation coupling pairs despite ground truth showing 66 matched pairs with high coupling scores.

## Severity
**CRITICAL** - Core business value feature not working

## Reproducibility
**Always**

## URL
N/A (Database/Backend Issue)

## Expected Behavior
Query should return 66 test-implementation coupling pairs as documented in ground truth:
- `enterprise/tests/unit/integrations/github/test_github_v1_callback_processor.py` ↔ `enterprise/integrations/github/github_v1_callback_processor.py` (Jaccard: 1.0)
- `enterprise/tests/unit/integrations/jira/test_jira_view.py` ↔ `enterprise/integrations/jira/jira_view.py` (Jaccard: 1.0)
- 66 total pairs
- 53 high coupling pairs (>0.5)

## Current Behavior
```sql
SELECT COUNT(*) as test_impl_pairs FROM edges e 
JOIN files f1 ON e.src_file_id = f1.file_id 
JOIN files f2 ON e.dst_file_id = f2.file_id 
WHERE (f1.path_current LIKE '%test%' AND f2.path_current NOT LIKE '%test%') 
   OR (f2.path_current LIKE '%test%' AND f1.path_current NOT LIKE '%test%');
```
Returns: **0**

## Steps to Reproduce
1. Analyze OpenHands repository
2. Check ground truth: `/QA/output/openhands/test_impl_coupling.json`
3. Query database for test-impl pairs
4. Observe 0 results

## Root Cause Analysis
Possible causes:
1. **Min co-occurrence threshold too high**: Default `min_cooccurrence=5` may filter out test-impl pairs that change together less frequently
2. **Path-based filtering**: Test files may be excluded during analysis
3. **Edge creation logic**: Test-impl relationships not being captured in edges table
4. **File filtering**: Files with `test` in path excluded from coupling analysis

## Impact
- **Business Critical**: Primary use case is identifying test coverage gaps via coupling
- Real-world scenario: "Which tests break when I change this file?" - NOT WORKING
- Feature mentioned in pitch: "Find orphaned tests" - NOT WORKING
- Module boundary detection via test coupling - NOT WORKING

## Verification Data
From ground truth (`/QA/output/openhands/test_impl_coupling.json`):
- Total test files: 438
- Matched pairs: 66
- High coupling pairs: 53
- Perfect coupling (1.0): Multiple pairs including Jira, GitHub, Linear integrations

## Recommended Fix
1. Lower `min_cooccurrence` threshold to 2-3 for test-impl pairs
2. Add explicit test-implementation coupling detection in `edges.py`
3. Create dedicated API endpoint: `GET /repos/{id}/coupling/test-impl`
4. Add test-impl coupling view in frontend

## Related
- E2E Test: Scenario 8 - Test-Implementation Coupling Analysis
- Ground Truth: `/QA/output/openhands/test_impl_coupling.json`
- Business Use Case: Test Coverage Analysis
