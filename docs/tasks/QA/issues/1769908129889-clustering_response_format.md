# Issue: Clustering Response Format Differs from Initial Expected Format

**Severity**: Medium
**Reproducibility**: Always
**Likelihood**: Likely

## Description
The clustering endpoint returns clusters with different field names and structure than initially expected in test 5. The response shows `clusters` array with different metadata instead of the `modules` format seen in hotspots endpoint.

## URL
`POST /repos/openhands/clustering/run`

## Expected vs Actual Mismatch

### Expected (based on hotspots endpoint)
```json
{
  "clustering_id": "...",
  "module_count": 444,
  "modules": [
    {
      "id": 1,
      "size": 7,
      "files": [...],
      ...
    }
  ]
}
```

### Actual
```json
{
  "algorithm": "louvain",
  "parameters": {...},
  "cluster_count": 444,
  "clusters": [
    {
      "id": 1,
      "size": 7,
      "file_ids": [129, 130, ...],
      ...
    }
  ]
}
```

## Issues
1. No `clustering_id` field (returned null in earlier test)
2. Uses `clusters` not `modules`
3. Uses `cluster_count` not `module_count`
4. Uses `file_ids` (integers) not `files` (file paths)

## Steps to Reproduce
```bash
curl -X POST http://localhost:8000/repos/openhands/clustering/run \
  -H "Content-Type: application/json" \
  -d '{"algorithm":"louvain"}'
```

**Business Impact**: API contract inconsistency makes frontend/client integration confusing. Returns both field names (`cluster_count`/`module_count`) interchangeably.

---
**Created**: 2026-02-01T14:40:05Z
