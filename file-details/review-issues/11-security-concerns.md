# Issue 11: Security — Path Traversal, SQL Construction, CORS

## Severity: HIGH

## Problem
1. `repos.py`: No validation of `path` parameter for symlinks or directory traversal (`../../etc/passwd`)
2. `git.py` line 209: SQL placeholder generation via `"?" * len(node_ids)` — while parameterized, the dynamic SQL construction pattern is risky
3. CORS origins default to localhost only — production deployment will need proper configuration
4. No `repo_id` format validation — could inject unexpected characters

## Expected Behavior
- All file paths are canonicalized and validated against a jail directory
- SQL uses parameterized queries exclusively (already mostly done)
- CORS is properly configured per environment
- `repo_id` follows a safe alphanumeric pattern

## Value
Prevents path traversal attacks, ensures deployment security, protects against injection.

## Concerned Files

| File | Issue |
|------|-------|
| `src/platform/code_intel/routers/repos.py` | No path sanitization |
| `src/platform/code_intel/routers/git.py` | Line 209: dynamic SQL placeholder |
| `src/platform/code_intel/app.py` | CORS origins from env with permissive localhost default |
| `src/platform/code_intel/storage.py` | No parquet file path validation |

## Suggested Changes

### 1. Path validation utility
```python
def safe_path(base: Path, user_path: str) -> Path:
    resolved = (base / user_path).resolve()
    if not resolved.is_relative_to(base.resolve()):
        raise HTTPException(400, detail={"code": "ERR_PATH_TRAVERSAL", "message": "Invalid path"})
    return resolved
```

### 2. Validate repo_id format
```python
REPO_ID_PATTERN = re.compile(r'^[a-zA-Z0-9_-]{1,64}$')
def validate_repo_id(repo_id: str):
    if not REPO_ID_PATTERN.match(repo_id):
        raise HTTPException(400, detail={"code": "ERR_INVALID_REPO_ID", "message": "..."})
```

### 3. Document CORS configuration for production deployments
