# Issue #008: File Tree Endpoint Shows Fewer Files Than List Endpoint

## Description
The `/repos/{repo_id}/files/tree` endpoint returns 420 files while the `/repos/{repo_id}/files` endpoint returns 451 files - a discrepancy of 31 files (6.9% missing).

## Severity
**LOW** - Minor data inconsistency

## Reproducibility
**Always**

## URLs
- `GET /repos/openhands/files` - Returns 451 files
- `GET /repos/openhands/files/tree` - Returns 420 files

## Expected Behavior
Both endpoints should represent the same set of current files:
- Tree endpoint: 451 file nodes (nested structure)
- List endpoint: 451 file records (flat list)

## Current Behavior
```bash
# List endpoint
curl -s "http://localhost:8000/repos/openhands/files" | jq 'length'
# Returns: 451

# Tree endpoint file count
curl -s "http://localhost:8000/repos/openhands/files/tree" | python3 -c "
import json, sys

def count_files(obj):
    count = 0
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k.startswith('__'):
                continue
            if isinstance(v, dict):
                if v.get('__type') == 'file':
                    count += 1
                elif v.get('__type') == 'dir':
                    count += count_files(v.get('__children', {}))
    return count

print(count_files(json.load(sys.stdin)))
"
# Returns: 420
```

## Steps to Reproduce
1. Query list endpoint: `GET /repos/openhands/files`
2. Count results: 451 files
3. Query tree endpoint: `GET /repos/openhands/files/tree`
4. Count file nodes: 420 files
5. Observe 31 files missing from tree

## Impact
- Minor UI inconsistency if both views are compared
- Some files may not appear in tree navigation but exist in list view
- Could confuse users who notice files in list but not in tree

## Root Cause Hypothesis
Possible causes:
1. Root-level files (without directory) may be handled differently
2. Files with special characters in paths may be excluded from tree
3. Edge case in tree building logic missing certain paths
4. Different query or filter applied to tree endpoint

## Recommended Fix
1. Compare file paths from both endpoints to identify missing 31 files
2. Debug tree building logic in API
3. Ensure consistent file set between endpoints

## Priority
Low - functional impact is minimal, both views work independently
