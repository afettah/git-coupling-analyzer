# Issue: /files/{path}/details returns empty coupled_files despite edges existing

**Severity:** Medium  
**Date:** 2026-02-07  
**Status:** Open  
**Component:** API - File Details Endpoint

## Description

The `/repos/{repo_id}/files/{path}/details` endpoint returns `coupled_files: null` or empty for files that have known coupling edges in the database.

## Reproduction

```bash
# Details endpoint shows no coupled files
curl -s "http://localhost:8000/repos/openhands/files/pyproject.toml/details"
# "coupled_files": null or empty

# But coupling endpoint returns edges
curl -s "http://localhost:8000/repos/openhands/coupling?path=pyproject.toml&limit=5"
# Returns 5 coupled files with jaccard values
```

## Expected

The details endpoint should include the coupled files list, consistent with the coupling endpoint.

## Impact

The file details panel in the frontend may show no coupling information even when coupling data exists.
