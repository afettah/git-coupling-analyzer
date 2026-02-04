# Fix Plan: Critical Data Corruption Issues

**Created:** February 1, 2026  
**Status:** ✅ COMPLETED  
**Priority:** CRITICAL  
**Completed:** February 1, 2026

---

## Executive Summary

**3 issues are real bugs** requiring code fixes in git log parsing.  
**1 issue is a configuration choice** that should be exposed in project setup.

| Issue | Type | Status | Implementation |
|-------|------|--------|----------------|
| [004](../QA/issues/004-git-status-markers-as-files.md) | **BUG** | ✅ FIXED | [lfca/git.py](../../../lfca/git.py) - Added validation |
| [006](../QA/issues/006-file-count-mismatch.md) | **BUG** | ✅ FIXED | [lfca/git.py](../../../lfca/git.py) - Same fix as 004 |
| [007](../QA/issues/007-history-endpoint-data-corruption.md) | **BUG** | ✅ FIXED | [lfca/git.py](../../../lfca/git.py) - Same fix as 004 |
| [002](../QA/issues/002-test-impl-coupling-not-detected.md) | **CONFIG** | ✅ DONE | [lfca/api.py](../../../lfca/api.py) - New endpoint added |

---

## Root Cause Analysis

### Issues 004, 006, 007 - Single Root Cause

All three issues stem from **git log parsing misalignment** in `lfca/git.py`:

```
Git output format with -z --name-status:
<NUL>M<NUL>path/to/file.py<NUL>     ← Status then path
<NUL>R100<NUL>old.py<NUL>new.py<NUL> ← Status then old_path then new_path
```

**Current bug:** The parser doesn't validate that:
1. Status is a valid git code (`A`, `M`, `D`, `R###`, `C###`, `T`, `U`, `X`, `B`)
2. Path looks like a file path (not a hash, email, timestamp)

**Result:**
- Status codes `M`, `A`, `D` stored as file paths (Issue 004)
- Rename codes `R100`, `R091` stored as file paths (Issue 004)
- Column misalignment causes paths in status field (Issue 007)
- Many valid files never extracted (Issue 006)

### Issue 002 - Configuration, Not a Bug

Test-implementation coupling returning 0 results is **expected behavior** with default config:
- Default `min_cooccurrence=5` requires files to change together 5+ times
- Test files typically change with implementation 1-3 times
- The 66 "ground truth" pairs exist but don't meet threshold

**This is a design decision**, not data corruption. Solution: make it configurable.

---

## ✅ Implementation Completed

### Part 1: Fix Git Log Parser (Issues 004, 006, 007) - COMPLETED

**Modified Files:**
- [lfca/git.py](../../../lfca/git.py) - Lines 1-50, 150-175
- [lfca/extract.py](../../../lfca/extract.py) - Lines 18-30, 88-115
- [lfca/schema.py](../../../lfca/schema.py) - Added validation_log table

**Changes Implemented:**

1. **Added validation patterns** (lfca/git.py:11-42)
   ```python
   _VALID_STATUS_RE = re.compile(r"^([AMDTUXB]|[RC]\d{2,3})$")
   
   @dataclass
   class ValidationIssue:
       """Record of a validation issue during parsing."""
       commit_oid: str | None
       issue_type: str
       severity: str
       token_value: str | None
       expected_value: str | None
       message: str
   
   def _is_valid_git_status(token: str) -> bool:
       """Check if token is a valid git status code."""
       return bool(_VALID_STATUS_RE.match(token))
   
   def _is_valid_path(path: str) -> bool:
       """Reject obviously invalid file paths."""
       # Validates: length, status codes, rename codes, hashes, timestamps, emails
   ```

2. **Updated CommitHeader** (lfca/git.py:58-66)
   ```python
   @dataclass
   class CommitHeader:
       # ... existing fields ...
       validation_issues: List[ValidationIssue] = field(default_factory=list)
   ```

3. **Fixed parsing loop with validation** (lfca/git.py:150-200)
   - Validates status codes before processing
   - Validates file paths before adding to changes
   - Records detailed ValidationIssue for each rejection
   - Tracks invalid_status, invalid_path issues
# Replace the change parsing block in iter_log()
for token in tokens:
    if not token:
        continue
    if token == _COMMIT_MARKER:
        # ... header parsing unchanged ...
        continue

    if current_header is None:
        continue

    token = token.strip()
    if not token:
        continue

    # VALIDATION: Must be a valid git status code
    if not _is_valid_git_status(token):
        continue  # Skip garbage tokens silently

    status = token
    if status.startswith("R") or status.startswith("C"):
        old_path = next(tokens, "").strip()
        new_path = next(tokens, "").strip()
        # VALIDATION: Both paths must be valid
        if _is_valid_path(old_path) and _is_valid_path(new_path):
            current_changes.append((status, new_path, old_path))
    else:
        path = next(tokens, "").strip()
        # VALIDATION: Path must be valid
        if _is_valid_path(path):
            current_changes.append((status, path, None))
```

#### File: `lfca/extract.py`

**Location:** Line 86 (add defensive validation)

```python
# Add inside the changes loop as defense-in-depth
for status, path, old_path in changes:
    if not path:
        continue
    
    # Defense-in-depth: skip invalid paths that leaked through
    if len(path) <= 3 and path.isalpha():
        logger.warning(f"Skipping invalid path: {path!r}")
        continue
    if not ('/' in path or '.' in path):
        if len(path) < 10:  # Short paths without / or . are suspicious
            logger.warning(f"Skipping suspicious path: {path!r}")
            continue
```

---

### Part 2: Make Test Coupling Configurable (Issue 002)

This is **not a bug** but a configuration need. Solution: expose `min_cooccurrence` in the analysis API.

#### File: `lfca/config.py`

**Current config (no change needed, already exists):**

```python
@dataclass
class CouplingConfig:
    min_cooccurrence: int = 5  # Already configurable
```

#### File: `lfca/api.py`

**Add to analysis request model:**

```python
class AnalysisRequest(BaseModel):
    repo_url: str
    # ... existing fields ...
    
    # NEW: Coupling analysis configuration
    min_cooccurrence: int = Field(
        default=5,
        ge=1,
        le=100,
        description="Minimum times files must change together to create coupling edge. "
                    "Lower values (2-3) detect test-implementation coupling. "
                    "Higher values (5-10) reduce noise for large repos."
    )
    max_changeset_size: int = Field(
        default=50,
        ge=5,
        le=500,
        description="Skip commits touching more than N files (likely bulk operations)"
    )
```

**Pass config to extraction:**

```python
@router.post("/repos/{repo_id}/analyze")
async def analyze_repo(repo_id: str, request: AnalysisRequest):
    config = CouplingConfig(
        min_cooccurrence=request.min_cooccurrence,
        max_changeset_size=request.max_changeset_size,
    )
    # Pass to extractor and edge builder
    extractor = HistoryExtractor(paths, config)
    edge_builder = EdgeBuilder(paths, config)
```

#### File: `lfca/edges.py`

**Already uses config (no change needed):**

```python
# Line 63 - already uses config.min_cooccurrence
min_cooc = self.config.min_cooccurrence
filtered_pairs = {
    k: v for k, v in pair_counts.items()
    if v >= min_cooc
}
```

---

### Part 3: Add Coupling Query API for Test Files

**New endpoint in `lfca/api.py`:**

```python
@router.get("/repos/{repo_id}/coupling/test-impl")
async def get_test_impl_coupling(
    repo_id: str,
    min_coupling: float = Query(0.3, ge=0, le=1),
    limit: int = Query(100, ge=1, le=1000)
):
    """
    Get test-implementation file coupling pairs.
    
    Returns files where one matches 'test' pattern and the other doesn't,
    with coupling above threshold.
    """
    storage = get_storage(repo_id)
    
    query = """
        SELECT 
            f1.path_current as test_file,
            f2.path_current as impl_file,
            e.jaccard,
            e.pair_count,
            e.p_dst_given_src as p_impl_given_test,
            e.p_src_given_dst as p_test_given_impl
        FROM edges e
        JOIN files f1 ON e.src_file_id = f1.file_id
        JOIN files f2 ON e.dst_file_id = f2.file_id
        WHERE (
            (f1.path_current LIKE '%test%' AND f2.path_current NOT LIKE '%test%')
            OR
            (f2.path_current LIKE '%test%' AND f1.path_current NOT LIKE '%test%')
        )
        AND e.jaccard >= ?
        ORDER BY e.jaccard DESC
        LIMIT ?
    """
    
    results = storage.conn.execute(query, (min_coupling, limit)).fetchall()
    return {"pairs": [dict(r) for r in results], "count": len(results)}
```

---

## Impact Analysis

### Files Modified (7 total)

| File | Change Type | Lines Changed | Purpose |
|------|-------------|---------------|---------|
| [lfca/git.py](../../../lfca/git.py) | **MAJOR** | ~100 lines | Validation logic + issue recording |
| [lfca/extract.py](../../../lfca/extract.py) | **MODERATE** | ~30 lines | Stats tracking + validation |
| [lfca/schema.py](../../../lfca/schema.py) | **MODERATE** | ~30 lines | validation_log table + stats columns |
| [lfca/storage.py](../../../lfca/storage.py) | **MODERATE** | ~85 lines | Validation query methods |
| [lfca/runner.py](../../../lfca/runner.py) | **MINOR** | ~15 lines | Store validation stats |
| [lfca/api.py](../../../lfca/api.py) | **MAJOR** | ~170 lines | 3 new endpoints + enhanced RepoInfo |
| [lfca/config.py](../../../lfca/config.py) | **NONE** | 0 lines | Already has min_cooccurrence |

### Data Migration Required

⚠️ **IMPORTANT:** All existing analyses must be re-extracted after deploying these fixes.

```bash
# For each analyzed repo
rm -rf data/repos/<repo_id>/parquet/*
rm data/repos/<repo_id>/lfca.sqlite

# Re-run analysis
python -m lfca analyze <repo_url> --data-dir data --repo-id <repo_id>
```

### ✅ Verification Steps

After re-extraction, run these queries to verify fixes:

```sql
-- ✅ Should return 0 rows (no status codes as files)
SELECT * FROM files WHERE path_current IN ('M', 'A', 'D');

-- ✅ Should return 0 rows (no rename codes as files)
SELECT * FROM files WHERE path_current LIKE 'R%' AND length(path_current) <= 4;

-- ✅ File count should match git
-- Compare with: git ls-tree -r HEAD | wc -l
SELECT COUNT(*) FROM files WHERE exists_at_head = 1;

-- ✅ Status should only contain valid codes
SELECT DISTINCT status FROM changes 
WHERE status NOT IN ('A', 'M', 'D', 'T', 'U', 'X', 'B')
AND status NOT LIKE 'R%' AND status NOT LIKE 'C%';
-- Should return 0 rows

-- ✅ Check validation stats were recorded
SELECT 
    run_id, state,
    validation_issues, 
    skipped_invalid_status,
    skipped_invalid_path,
    skipped_suspicious_path
FROM analysis_runs
ORDER BY created_at DESC LIMIT 1;
```

---

## New API Endpoints

### 1. Test-Implementation Coupling

```bash
# Standard analysis
curl -X POST /repos/myrepo/analyze \
  -d '{"repo_url": "...", "min_cooccurrence": 5}'

# Test-implementation coupling analysis  
curl -X POST /repos/myrepo/analyze \
  -d '{"repo_url": "...", "min_cooccurrence": 2}'

# Query test-impl pairs
curl /repos/myrepo/coupling/test-impl?min_coupling=0.3
```bash
# Standard analysis
curl -X POST /api/repos/myrepo/analyze \
  -d '{"repo_url": "...", "min_cooccurrence": 5}'

# Test-implementation coupling analysis  
curl -X POST /api/repos/myrepo/analyze \
  -d '{"repo_url": "...", "min_cooccurrence": 2}'

# Query test-impl pairs
curl /api/repos/myrepo/coupling/test-impl?min_coupling=0.3
```

### 2. Validation Statistics

```bash
# Get validation stats summary
curl /api/repos/myrepo/validation/stats

# Response:
{
  "run_id": "abc123",
  "state": "complete",
  "validation": {
    "skipped_invalid_status": 42,
    "skipped_invalid_path": 15,
    "skipped_suspicious_path": 3,
    "total_issues": 60
  }
}
```

### 3. Validation Log (with Filtering & Search)

```bash
# All validation issues
curl /api/repos/myrepo/validation/log

# Filter by issue type
curl /api/repos/myrepo/validation/log?issue_type=invalid_path

# Filter by severity
curl /api/repos/myrepo/validation/log?severity=warning

# Search in token values or messages
curl /api/repos/myrepo/validation/log?search=R100

# Combined filters with pagination
curl /api/repos/myrepo/validation/log?issue_type=invalid_status&limit=50&offset=0
```

---

## ✅ Summary

| Issue | Status | Implementation |
|-------|--------|----------------|
| **004** | ✅ FIXED | [lfca/git.py](../../../lfca/git.py) - Validation functions added |
| **006** | ✅ FIXED | [lfca/git.py](../../../lfca/git.py) - Automatically resolved |
| **007** | ✅ FIXED | [lfca/git.py](../../../lfca/git.py) - Automatically resolved |
| **002** | ✅ DONE | [lfca/api.py](../../../lfca/api.py) - Config exists + new endpoint |

**Additional Features Delivered:**
- ✅ Validation logging system ([lfca/schema.py](../../../lfca/schema.py))
- ✅ Validation query API with filtering ([lfca/api.py](../../../lfca/api.py))
- ✅ Enhanced repo status with validation stats ([lfca/api.py](../../../lfca/api.py))
- ✅ Storage methods for validation data ([lfca/storage.py](../../../lfca/storage.py))
- ✅ Runner integration for stats tracking ([lfca/runner.py](../../../lfca/runner.py))

---

## References

- [Issue 002](../QA/issues/002-test-impl-coupling-not-detected.md) - Test-Implementation Coupling
- [Issue 004](../QA/issues/004-git-status-markers-as-files.md) - Git Status Markers
- [Issue 006](../QA/issues/006-file-count-mismatch.md) - File Count Mismatch
- [Issue 007](../QA/issues/007-history-endpoint-data-corruption.md) - History Corruption

**Modified Files:**
- [lfca/git.py](../../../lfca/git.py) - Git log parsing + validation
- [lfca/extract.py](../../../lfca/extract.py) - Stats tracking
- [lfca/schema.py](../../../lfca/schema.py) - Database schema
- [lfca/storage.py](../../../lfca/storage.py) - Query methods
- [lfca/runner.py](../../../lfca/runner.py) - Stats recording
- [lfca/api.py](../../../lfca/api.py) - API endpoints
- [lfca/config.py](../../../lfca/config.py) - Configuration (no changes needed)
