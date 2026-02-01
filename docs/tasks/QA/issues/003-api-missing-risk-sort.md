# Issue #003: API Missing 'risk' Sort Option

## Description
The `/repos/{repo_id}/files` endpoint does not support sorting by `risk_score` despite this being a key metric for identifying problematic files.

## Severity
**MEDIUM** - Feature limitation, workaround exists

## Reproducibility
**Always**

## URL
`http://localhost:8000/repos/openhands/files?sort_by=risk&sort_dir=desc&limit=5`

## Expected Behavior
Should return files sorted by risk_score descending:
```json
[
  {"path": "pyproject.toml", "risk_score": 80, "total_commits": 71, ...},
  {"path": "frontend/package-lock.json", "risk_score": 75, ...},
  ...
]
```

## Current Behavior
Returns HTTP 400 error:
```json
{
  "error": {
    "code": "HTTP_400",
    "message": "sort_by must be 'path' or 'commits'",
    "details": null
  }
}
```

## Steps to Reproduce
1. Send GET request: `curl "http://localhost:8000/repos/openhands/files?sort_by=risk"`
2. Observe 400 error
3. Only 'path' and 'commits' are accepted

## Impact
- **Business Use Case**: "Show me the riskiest files to refactor" - NOT WORKING
- UI shows "⚠️ Risk 4" filter but API doesn't support it
- Workaround: Fetch all files (limit=500) and sort client-side (inefficient)

## Verification
- File details endpoint DOES return `risk_score` field
- Example: `pyproject.toml` has `risk_score: 80`
- Field exists in data model but not in sort options

## Recommended Fix
1. Add `'risk'` to allowed `sort_by` values in API endpoint
2. Update API schema/documentation
3. Consider adding more sort options: `churn_rate`, `coupling`, `authors`

## Related
- UI Component: "⚠️ Risk 4" filter button
- Data Model: `risk_score` field exists
- Business Use Case: Hotspot Analysis / Technical Debt Prioritization
