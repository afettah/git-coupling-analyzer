# Issue #007: File History and Commits Endpoints Return Corrupted Data

## Description
The `/repos/{repo_id}/files/{path}/history` and `/repos/{repo_id}/files/{path}/commits` endpoints return corrupted data where:
- The `status` field contains file paths, author names, or commit message fragments instead of status codes (A/M/D)
- The `old_path` field contains status codes like "M" instead of actual old paths
- Commit messages have status codes appended (e.g., `"message": "Fix bug (#123)\nM"`)

## Severity
**HIGH** - Data integrity issue affecting file history display

## Reproducibility
**Always** - affects all files with git history

## URLs
- `GET /repos/openhands/files/{path}/history`
- `GET /repos/openhands/files/{path}/commits`
- `GET /repos/openhands/files/{path}/lineage`

## Expected Behavior
History endpoint should return:
```json
{
  "commits": [
    {
      "commit_oid": "abc123...",
      "file_id": 415,
      "path": "openhands/core/config/llm_config.py",
      "status": "M",
      "old_path": null,
      "commit_ts": 1748021730
    }
  ]
}
```

## Current Behavior
History endpoint returns corrupted data:
```json
{
  "commits": [
    {
      "commit_oid": "2518901e6e4e3578fdda3b64c3b2ec76d682931f",
      "file_id": 415,
      "path": "openhands/core/config/llm_config.py",
      "status": "README.md",        // ❌ Should be "M", not a file path
      "old_path": "M",               // ❌ Should be null, status code leaked here
      "commit_ts": 1742840280
    },
    {
      "commit_oid": "d9e0344619b0dad48d8806e4d910c7fa183ec6d8",
      "file_id": 415,
      "path": "openhands/core/config/llm_config.py",
      "status": "Fix old string serializer (#4644)\nM",  // ❌ Contains commit message + status
      "old_path": null,
      "commit_ts": 1730316756
    }
  ]
}
```

Lineage endpoint also corrupted:
```json
{
  "renames": [
    {
      "path": "M",                    // ❌ Should be a file path
      "start_commit_oid": "2518901...",
      "end_commit_oid": null
    }
  ]
}
```

## Steps to Reproduce
```bash
# Test history endpoint
curl -s "http://localhost:8000/repos/openhands/files/openhands/core/config/llm_config.py/history" | jq '.commits[] | {status, old_path}'

# Test commits endpoint
curl -s "http://localhost:8000/repos/openhands/files/openhands/core/config/llm_config.py/commits" | jq '.commits[] | .message'

# Test lineage endpoint
curl -s "http://localhost:8000/repos/openhands/files/pyproject.toml/lineage" | jq '.renames'
```

## Root Cause Analysis
The parquet `changes.parquet` file contains corrupted data:
```python
import pandas as pd
changes = pd.read_parquet('data/repos/openhands/parquet/changes.parquet')
print(changes['status'].unique()[:10])
# Shows file paths, author names, timestamps instead of A/M/D codes
```

This is a **parsing bug in git log extraction**. The git log output format is being misaligned during parsing, causing:
1. Status codes (A/M/D) to be written to wrong columns
2. File paths to be written to status column
3. Commit messages to have status codes appended

## Impact
- **File history view**: Shows incorrect change status
- **Rename tracking**: Cannot determine actual renames vs modifications
- **Lineage display**: Shows "M" as renamed-from path
- **Audit trail**: Corrupted data for compliance/review purposes
- **User trust**: Obviously incorrect data undermines confidence

## Sample Corrupted Status Values
From `changes.parquet`:
```
'.github/ISSUE_TEMPLATE/bug_template.yml'       # file path in status column
'frontend/__tests__/utils/extract-model-and-provider.test.ts'
'enterprise/server/routes/org_models.py'
'Xiang Yue'                                      # author name in status column
'1710639192'                                     # timestamp in status column
'Update README (Xiang) (#28)\nA'                 # commit message with status
```

## Recommended Fix
1. **Root cause fix**: Review `lfca/extract.py` git log parsing
   - Ensure proper delimiter handling (tab-separated)
   - Handle multiline commit messages correctly
   - Validate status is single character (A/M/D/R/C/T)
2. **Data cleanup**: Re-extract data from git repository
3. **Validation**: Add schema validation during extraction
   - Status must be in [A, M, D, R, C, T, U, X, B]
   - Reject obviously invalid values (paths, names, numbers)

## Related Issues
- Issue #004: Git Status Markers Parsed as Filenames (same root cause)
- Issue #005: Incomplete Rename Detection (related parsing issue)

## Related Files
- `lfca/extract.py` - Git log parsing logic
- `data/repos/openhands/parquet/changes.parquet` - Corrupted data
- Database `file_lineage` table may also be affected
