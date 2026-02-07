# Issue: exists_at_head file count doesn't match git HEAD

**Severity:** High  
**Date:** 2026-02-07  
**Status:** Open  
**Component:** Analysis Engine - File Tracking

## Description

The number of files with `exists_at_head=TRUE` in the database (2065) does not match the actual number of files at HEAD in git (2765). 700 files are missing.

## Expected vs Actual

- **Expected:** ~2765 files with `exists_at_head=TRUE` (matching `git ls-tree -r HEAD | wc -l`)
- **Actual:** 2065 files with `exists_at_head=TRUE`
- **Discrepancy:** 700 files (~25%) not recognized as existing at HEAD

## Evidence

```bash
# Git HEAD count
cd /home/afettah/workspace/git-coupling-analyzer/tmp/OpenHands
git ls-tree -r HEAD --name-only | wc -l
# 2765

# DB count
sqlite3 data/repos/openhands/lfca.sqlite "SELECT SUM(exists_at_head) FROM files;"
# 2065

# Total tracked files in DB
sqlite3 data/repos/openhands/lfca.sqlite "SELECT COUNT(*) FROM files;"
# 4450
```

## Impact

- File tree view is incomplete - missing 25% of files
- Coupling analysis may miss relationships for untracked files
- `current_only=True` filter excludes real files

## Likely Cause

Files that were only added in bulk commits (>50 files, filtered by `max_changeset_size=50`) may never get their `exists_at_head` flag set if they only appear in filtered-out commits.
