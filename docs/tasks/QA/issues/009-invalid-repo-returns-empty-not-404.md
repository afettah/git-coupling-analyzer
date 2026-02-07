# Issue: Invalid repo ID returns empty array instead of 404

**Severity:** Low  
**Date:** 2026-02-07  
**Status:** Open  
**Component:** API - Error Handling

## Description

Querying files for a non-existent repository returns `[]` (200 OK) instead of a 404 error.

## Reproduction

```bash
curl -s "http://localhost:8000/repos/nonexistent_xyz/files"
# Returns: []
```

## Expected

```json
{"error": {"code": "HTTP_404", "message": "Repository not found: nonexistent_xyz"}}
```

## Impact

Clients cannot distinguish between "repo exists but has no files" and "repo doesn't exist".
