# Issue #001: File Details - Additions and Deletions Always Show Zero

## Description
When viewing file details page, the "ADDITIONS" and "DELETIONS" metrics consistently display 0 for all tested files, regardless of actual file modification history.

## Severity
**Medium** - Display issue, core coupling analysis still functions correctly

## Reproducibility
**Always**

## Likelihood
**Likely Real Issue** - Consistent reproduction across multiple files (pyproject.toml, translation.json, etc.)

## URL
- `http://localhost:5173/repos/openhands/file-details/pyproject.toml`
- `http://localhost:5173/repos/openhands/file-details/frontend/src/i18n/translation.json`

## Expected Result
For files with significant history (e.g., pyproject.toml with 71 commits), the ADDITIONS and DELETIONS fields should display the total lines added and deleted across all commits.

For example:
- pyproject.toml: ADDITIONS: ~500, DELETIONS: ~250 (estimated)
- translation.json: ADDITIONS: ~200, DELETIONS: ~100 (estimated)

## Current Result
All files display:
- ADDITIONS: 0
- DELETIONS: 0

This persists across the timeline view where individual periods also show +0/-0 for every month.

## Steps to Reproduce
1. Navigate to the OpenHands project
2. Go to Impact Graph tab
3. Click "View file details" for any file
4. Observe the ADDITIONS and DELETIONS metrics in the top card
5. Click the "Activity" tab and check the "Lines Changed Over Time" section
6. All time periods show +0/-0

## Additional Notes
- The "CHURN RATE" metric displays correctly (e.g., 0.86/wk)
- The "RISK SCORE" displays correctly (e.g., 80/100)
- The issue appears to be specific to addition/deletion counting, not overall metrics
- This likely indicates the backend is not properly calculating line additions and deletions from the git history
