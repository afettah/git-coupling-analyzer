# Issue: File Search Parameter Does Not Filter by Filename

**Severity**: Medium
**Reproducibility**: Always
**Likelihood**: Likely

## Description
The `/files` endpoint's `search` parameter should filter files by filename/path, but it ignores the search term and returns random files. When searching for "package.json", it returns unrelated files like ".github/workflows/".

## URL
`GET /repos/openhands/files?search=package.json&limit=5`

## Expected Result
Files matching "package.json":
```json
[
  {
    "file_id": 133,
    "path": "frontend/package.json",
    "exists_at_head": true,
    "total_commits": 498
  },
  {
    "file_id": ...,
    "path": "containers/...",
    ...
  }
]
```

## Current Result
Random/unrelated files:
```json
[
  {
    "path": ".github/pull_request_template.md",  // ← Not a match!
    ...
  },
  {
    "path": ".github/workflows/ghcr-build.yml",  // ← Not a match!
    ...
  }
]
```

## Steps to Reproduce
1. Query: `curl "http://localhost:8000/repos/openhands/files?search=package.json&limit=5"`
2. Observe response doesn't match search term

**Root Cause**: Search parameter is likely not passed to database query filter.

**Business Impact**: Users cannot find specific files in large projects. Makes navigation extremely difficult.

---
**Created**: 2026-02-01T14:38:35Z
