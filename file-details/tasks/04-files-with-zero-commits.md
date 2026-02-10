# Task 04: Files Showing 0 Commits

## Issue
Some files (e.g., `.devcontainer/README.md`) display 0 commits in the file tree/details, which should not be possible — every tracked file must have been added by at least one commit.

## Expected Behavior
- Every file in the tree should show at least 1 commit (the commit that added the file).
- If a file exists in the tree, it was part of at least one commit and the count must reflect that.

## Root Cause Analysis

The bug is caused by a **timing gap between commit extraction and HEAD synchronization**, combined with **large-changeset filtering**.

### Exact execution flow (in `extract.py` → `run()`, lines 225–239):

1. **Step 1 — Extract commits** (`extract.py`, line 103): Git log is walked and each commit's changed files are recorded. However, commits touching more than `max_changeset_size` files (default: **50**, see `config.py:15`) are **completely skipped** (`continue` on line 104). The per-file commit counter `file_commit_counts[fid]` (line 196) is only incremented for files seen in non-skipped commits.

2. **Step 2 — Write file stats** (`extract.py`, line 228): `_update_file_stats()` iterates over `file_commit_counts` (line 261: `for entity_id, count in counts.items()`) and writes `meta["total_commits"] = count` (line 269) to the `entities.metadata_json` column. **Only files present in the counter are updated.**

3. **Step 3 — Sync HEAD** (`extract.py`, line 239): `sync_head_files()` runs `git ls-tree -r --name-only HEAD` (`sync.py:14`) to get ALL files at HEAD, then calls `storage.update_head_status_bulk()` (`storage.py:281`). This marks every current file as `exists_at_head = TRUE`. **Crucially, if a file doesn't exist in the DB yet, it creates a brand-new entity** (lines 299–309 in `storage.py`) **with no metadata at all** — no `total_commits` field.

4. **Step 4 — Build tree** (`sync.py`, line 60): `build_file_tree()` reads `metadata.get("total_commits", 0)` which defaults to **0** for entities created in step 3 that were never processed in step 1.

5. **Step 5 — Frontend** (`FilesPage.tsx`, line 54): `flattenTree()` reads `node.commits ?? 0`, displaying 0.

### Why specific files are affected:

- **Files introduced only in large commits** (e.g., initial repository commit, large refactors, dependency lock file additions) — these commits exceed `max_changeset_size=50` and are entirely skipped.
- **Files added via merge commits** with large diffs — same filtering applies.
- **Files that exist at HEAD but whose only "add" commit was filtered out** — they get created as entities in step 3 with empty metadata, so `total_commits` is never set.

### Verified with QA data (OpenHands repo):

- `current_files.txt`: 2,765 files at HEAD
- `file_commits.csv`: 6,276 file entries (includes deleted/renamed files)
- Every current file has a commit entry in the QA data (collected via raw `git log`), confirming the issue is in the extraction filtering, not in git itself.

## Files to Modify

| File | Line(s) | What to change |
|------|---------|----------------|
| `src/git-analyzer/git_analyzer/extract.py` | 103–104 | The `max_changeset_size` filter skips the entire commit including file entity creation. Files from skipped commits are never counted. |
| `src/git-analyzer/git_analyzer/extract.py` | 228–239 | `_update_file_stats()` runs BEFORE `sync_head_files()`. Files created during HEAD sync get no metadata. |
| `src/git-analyzer/git_analyzer/sync.py` | 60–61 | `build_file_tree()` defaults `total_commits` to 0 with no floor. |
| `src/frontend/src/features/git/FilesPage.tsx` | 54 | `node.commits ?? 0` has no minimum guard. |

## Suggested Fix

### Fix 1 — Primary fix: Count commits even in skipped changesets (`extract.py`)

The `max_changeset_size` filter should skip **co-change edge creation** but still track per-file commit counts. Currently the `continue` on line 104 skips everything. Instead, still register each file entity and increment `file_commit_counts`, but skip the co-change/coupling analysis for oversized changesets.

```python
# Line 103-104: Instead of skipping entirely:
if len(changes) > self.config.max_changeset_size:
    continue  # ← This drops ALL file tracking for this commit

# Change to: still track file entities and counts, skip only coupling
skip_coupling = len(changes) > self.config.max_changeset_size
```

### Fix 2 — Reorder: Sync HEAD before updating stats (`extract.py`)

Move `sync_head_files()` (line 239) to **before** `_update_file_stats()` (line 228). This ensures all HEAD entities exist in the DB before stats are written. Then, after `_update_file_stats()`, do a second pass to set `total_commits = 1` for any entity at HEAD that still has no `total_commits` in metadata.

### Fix 3 — Safety net in tree builder (`sync.py`, line 60)

```python
"commits": max(1, int(metadata.get("total_commits", 0) or 0)),
```

Every file in the tree exists at HEAD, meaning at least one commit added it. A floor of 1 is semantically correct.

### Fix 4 — Frontend guard (`FilesPage.tsx`, line 54)

```typescript
const commits = Math.max(1, node.commits ?? 1);
```

### Recommended approach

Apply **Fix 1** (primary — ensures correct counts) + **Fix 3** (safety net — guarantees no zeros in tree) + **Fix 4** (defense-in-depth on frontend). Fix 2 is optional but improves correctness of the pipeline ordering.
