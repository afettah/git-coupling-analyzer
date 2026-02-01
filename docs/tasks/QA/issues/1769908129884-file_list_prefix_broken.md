# Issue: File List Prefix Parameter Not Working - Returns Incorrect Results

**Severity**: Medium
**Reproducibility**: Always
**Likelihood**: Likely

## Description
The `/files` endpoint's `prefix` parameter should filter files by path prefix, but returns files that don't match the prefix. When requesting files with prefix "frontend/src/", it returns files from ".github/" directory instead.

## URL
`GET /repos/openhands/files?prefix=frontend/src/&limit=10`

## Expected Result
Files with paths starting with "frontend/src/":
- frontend/src/index.tsx
- frontend/src/App.tsx
- frontend/src/components/...
etc.

## Current Result
```json
[
  {
    "file_id": 996,
    "path": ".github/pull_request_template.md",  // ← Wrong directory!
    "exists_at_head": true,
    "total_commits": 2
  },
  {
    "file_id": 886,
    "path": ".github/workflows/ghcr-build.yml",  // ← Wrong directory!
    ...
  }
]
```

## Steps to Reproduce
1. Query: `curl "http://localhost:8000/repos/openhands/files?prefix=frontend/src/&limit=10"`
2. Observe returned paths don't match prefix

**Business Impact**: Cannot efficiently browse file directory structure, limiting ability to explore codebase organization.

---
**Created**: 2026-02-01T14:36:10Z
