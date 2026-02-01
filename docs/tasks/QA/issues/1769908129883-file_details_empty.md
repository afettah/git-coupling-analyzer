# Issue: File Details Endpoint Returns Null Values for Existing Files

**Severity**: High
**Reproducibility**: Always
**Likelihood**: Likely

## Description
When querying file details for files that exist in the database (verified by coupling endpoint working correctly), the file details endpoint returns null values for all fields including `file_id`, `path_current`, `commit_count`, and author information. This breaks the ability to inspect individual file metadata.

## URL
`GET /repos/openhands/files/frontend/src/index.tsx/details`

## Expected Result
```json
{
  "file_id": <integer>,
  "path_current": "frontend/src/index.tsx",
  "commit_count": <positive_integer>,
  "first_author": "<string>",
  "last_author": "<string>",
  ...
}
```

## Current Result
```json
{
  "file_id": null,
  "path_current": null,
  "commit_count": null,
  "first_author": null,
  "last_author": null
}
```

## Steps to Reproduce
1. Open analyzed repository (OpenHands)
2. Query coupling endpoint: `GET /repos/openhands/coupling?path=frontend/package.json&limit=5` → returns 59 pair_count
3. Query file details for same file: `GET /repos/openhands/files/frontend/src/index.tsx/details`
4. Observe all fields are null despite file existing in database

**Business Impact**: Users cannot view file metadata, preventing drill-down analysis of file history, authors, and commit patterns.

---
**Created**: 2026-02-01T14:35:29Z
