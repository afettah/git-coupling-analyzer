# Issue: Multiple Required Endpoints Return 404 Not Found

**Severity**: High
**Reproducibility**: Always
**Likelihood**: Likely

## Description
Several important endpoints documented and expected by the E2E tests return 404 Not Found. This suggests these features are not implemented or incorrectly registered in the API router.

## Missing/Broken Endpoints

### 1. Coupling Statistics
- **URL**: `GET /repos/{repo_id}/coupling-stats`
- **Expected**: Summary statistics of coupling relationships
- **Actual**: 404 Not Found with `{"detail": "Not Found"}`

### 2. Modules List
- **URL**: `GET /repos/{repo_id}/modules?limit=5`
- **Expected**: List of detected modules/clusters
- **Actual**: 404 Not Found with `{"detail": "Not Found"}`

## Steps to Reproduce
```bash
# Coupling stats
curl http://localhost:8000/repos/openhands/coupling-stats
# Returns: {"detail": "Not Found"}

# Modules list
curl http://localhost:8000/repos/openhands/modules?limit=5
# Returns: {"detail": "Not Found"}
```

## Expected Responses

**Coupling Stats:**
```json
{
  "total_edges": 410,
  "max_jaccard": 0.99,
  "min_jaccard": 0.05,
  "avg_jaccard": 0.35,
  "files_with_coupling": 234
}
```

**Modules:**
```json
[
  {
    "id": 1,
    "size": 45,
    "files": ["openhands/core/...", ...],
    "quality": 0.8
  }
]
```

## Business Impact
- Cannot retrieve project-wide coupling metrics
- Cannot analyze module structure
- UI features that depend on these endpoints are broken

---
**Created**: 2026-02-01T14:39:20Z
