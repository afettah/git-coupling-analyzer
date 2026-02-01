# Issue #001: API Method Not Allowed Error

## Description
The API endpoint `GET /repos/{repo_id}` returns a "Method Not Allowed" error instead of repository details.

## Severity
**HIGH** - Critical API endpoint not functioning

## Reproducibility
**Always**

## URL
`http://localhost:8000/repos/openhands`

## Expected Behavior
Should return JSON with repository details:
```json
{
  "id": "openhands",
  "name": "openhands",
  "state": "complete",
  "file_count": 1462,
  "commit_count": 5871,
  "edge_count": 410,
  ...
}
```

## Current Behavior
Returns:
```json
{"detail":"Method Not Allowed"}
```

## Steps to Reproduce
1. Start LFCA backend server
2. Analyze OpenHands repository
3. Send GET request: `curl http://localhost:8000/repos/openhands`
4. Observe "Method Not Allowed" error

## Impact
- Documentation references this endpoint in E2E tests (Scenario 1.2)
- API consumers cannot retrieve single repository status
- Workaround: Use `GET /repos` to list all and filter client-side

## Related
- E2E Test: Scenario 1.2 - List Repositories (Step 1.3: Get individual repo)
- API Documentation: Missing or incorrect route definition
