# Issue: Hotspots Endpoint Returns Incompatible Response Format

**Severity**: High
**Reproducibility**: Always
**Likelihood**: Likely

## Description
The hotspots endpoint returns a different response structure than documented. Instead of a simple array or flat object, it returns a complex nested structure with "modules" containing arrays of module objects. This causes JSON parsing errors in tools expecting the documented format (e.g., `jq` filtering fails with "Cannot index object with object").

## URL
`GET /repos/openhands/hotspots?limit=10`

## Expected Result
Array or object with hotspot files:
```json
[
  {
    "file_id": <int>,
    "path": "<string>",
    "churn": <int>,
    ...
  }
]
```

## Current Result
Complex nested structure:
```json
{
  "modules": [
    {
      "id": 380,
      "size": 5,
      "file_ids": [...],
      "files": [...],
      "total_churn": 45,
      "hot_files": [...]
    },
    ...
  ],
  "metrics": {
    "modularity": 0.123...
  }
}
```

## Steps to Reproduce
1. GET: `http://localhost:8000/repos/openhands/hotspots?limit=10`
2. Try to parse as flat array: `jq '.[:3]'`
3. Error: "Cannot index object with object"

**Business Impact**: Documentation doesn't match API contract. Developers/users cannot correctly integrate hotspots endpoint. Frontend integration requires workarounds.

---
**Created**: 2026-02-01T14:37:50Z
