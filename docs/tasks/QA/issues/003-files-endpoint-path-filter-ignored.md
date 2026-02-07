# Issue: /files endpoint `path` param not supported - uses `q` instead

**Severity:** High  
**Date:** 2026-02-07  
**Status:** Open  
**Component:** API - `/repos/{repo_id}/files`

## Description

The `/repos/{repo_id}/files` endpoint does not accept a `path` query parameter for filtering. The actual parameter is `q`, which performs a prefix match. Previous QA tests using `?path=pyproject.toml` returned unfiltered results, leading to false commit count comparisons.

## Expected vs Actual

- **Expected:** `GET /repos/openhands/files?path=pyproject.toml` returns the file `pyproject.toml`
- **Actual:** The `path` param is silently ignored; returns first 500 files alphabetically. The correct param is `q`.

## Evidence

```bash
# path= is ignored
curl -s "http://localhost:8000/repos/openhands/files?path=pyproject.toml&limit=3"
# Returns: .devcontainer/devcontainer.json, .devcontainer/setup.sh, .editorconfig

# q= works correctly (prefix match)
curl -s "http://localhost:8000/repos/openhands/files?q=pyproject.toml&limit=3"
# Would filter correctly
```

## Root Cause

API parameter is `q` (line 590 in api.py), not `path`. The `path` parameter is not defined, so FastAPI ignores it.

## Recommendation

Either:
1. Add `path` as an alias for exact match filtering
2. Document that `q` is the filter parameter
3. Add a dedicated `/repos/{repo_id}/files/{path}` endpoint for single-file lookup (already exists as `/files/{path}/details`)
