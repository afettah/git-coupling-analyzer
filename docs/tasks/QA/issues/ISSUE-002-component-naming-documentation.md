# ISSUE-002: Component Coupling Endpoint Uses Unintuitive Component Names

**Severity**: Low  
**Endpoint**: `GET /repos/{repo_id}/coupling/components`  
**Status**: Open

## Description

The `/coupling/components` endpoint uses component names that are not intuitive folder paths. The available component names include git change types (A, D, M), internal markers (__LFCA_COMMIT__), and short file/folder names rather than full directory paths.

## Steps to Reproduce

```bash
# Expected to work (using folder path):
curl "http://localhost:8000/repos/openhands/coupling/components?component=enterprise"
# Returns: {"component": "enterprise", "depth": 2, "coupled_components": []}

curl "http://localhost:8000/repos/openhands/coupling/components?component=frontend"
# Returns: {"component": "frontend", "depth": 2, "coupled_components": []}

# Actually works (using internal component names):
curl "http://localhost:8000/repos/openhands/coupling/components?component=M"
# Returns: actual coupled components
```

## Available Component Names (openhands repo)

Querying the database reveals these component names:
- `A` - Added files marker
- `D` - Deleted files marker  
- `M` - Modified files marker
- `R100`, `R080` - Rename markers
- `__LFCA_COMMIT__` - Internal commit marker
- `compose.yml` - File name
- `containers/dev` - Partial path
- `docs/i18n` - Partial path
- `frontend/package-lock.json` - Full file path
- `poetry.lock` - File name
- etc.

## Expected Behavior

Users should be able to:
1. Query by intuitive folder paths like `enterprise/`, `frontend/src/`, `openhands/core/`
2. Discover available component names via the API
3. Understand what component names represent

## Suggested Improvements

### Option 1: Add Component Discovery Endpoint

```python
@app.get("/repos/{repo_id}/coupling/components/list")
def list_components(repo_id: str, depth: int = 2, data_dir: str = "data") -> dict:
    """List available component names for querying."""
    storage = get_storage(repo_id, data_dir)
    try:
        rows = storage.conn.execute("""
            SELECT DISTINCT src_component 
            FROM component_edges 
            WHERE depth = ?
            ORDER BY src_component
        """, (depth,)).fetchall()
        return {
            "depth": depth,
            "components": [r[0] for r in rows]
        }
    finally:
        storage.close()
```

### Option 2: Improve Documentation

Add API documentation explaining:
- How component names are derived
- What depth parameter means
- Examples of valid component names per repository

### Option 3: Support Folder Path Prefix Matching

Allow users to query by folder prefix that matches any component starting with that path:

```python
# Query: component=frontend
# Would match: frontend/package.json, frontend/src, frontend/package-lock.json
```

## Impact

- API is difficult to use without knowledge of internal component naming
- Users must query the database directly to find valid component names
- Documentation gap makes the feature less accessible

## Technical Context

The component_edges table appears to be built from:
1. Git diff status markers (A/D/M/R###)
2. File paths at various depths
3. Internal markers for change tracking

The `depth` parameter controls the granularity of path splitting.

## Related Files

- `/home/afettah/workspace/git-coupling-analyzer/lfca/api.py` (lines 1431-1459)
- Database table: `component_edges`
