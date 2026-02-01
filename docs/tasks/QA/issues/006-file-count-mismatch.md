# Issue #006: Current Files Count Mismatch Between Analysis and API

## Description
The API returns only 451 current files (files with `exists_at_head=true`), while the ground truth analysis in `basic_stats.json` reports 2,765 current files. This represents an 83.7% discrepancy in file count.

## Severity
**CRITICAL** - Major data loss / incomplete analysis

## Reproducibility
**Always**

## URLs
- `GET /repos/openhands/files` - Returns 451 files
- `GET /repos/openhands/files?current_only=true` - Returns 451 files
- `GET /repos/openhands/files?limit=10000` - Still returns only 451 files

## Expected Behavior
- API should return ~2,765 current files (as per `basic_stats.json`)
- This includes:
  - 1,254 Python files
  - 958 TypeScript/JavaScript files
  - 526 test files
  - 138 Markdown files

## Current Behavior
```bash
# API returns only 451 current files
curl -s "http://localhost:8000/repos/openhands/files" | jq 'length'
# Returns: 451

# Database confirms 451
sqlite3 data/repos/openhands/lfca.sqlite "SELECT COUNT(*) FROM files WHERE exists_at_head = 1"
# Returns: 451

# But ground truth shows 2,765
cat QA/output/openhands/basic_stats.json | jq '.current_files_count'
# Returns: 2765
```

## Steps to Reproduce
1. Run API at localhost:8000
2. Call `GET /repos/openhands/files?limit=10000`
3. Count returned files: 451
4. Compare with ground truth: 2,765 expected

## Data Verification
```json
// From QA/output/openhands/basic_stats.json
{
  "current_files_count": 2765,
  "file_types": {
    "python": 1254,
    "typescript_javascript": 958,
    "tests": 526,
    "markdown": 138
  }
}
```

## Impact
- **83.7% of files missing** from analysis (2,314 files)
- Coupling analysis incomplete - missing relationships between ~2,300 files
- Hotspot detection incomplete - may miss actual hotspots
- Clustering results likely inaccurate
- Business decisions based on incomplete data

## Root Cause Hypothesis
The extraction process may have:
1. Stopped early before processing all files
2. Filtered out files incorrectly (e.g., based on extension)
3. Hit an error during git log parsing that caused early termination
4. Only processed files that appear in recent commits (not full history)

## Additional Context
- Total files in DB (including deleted): 1,462
- Changes parquet has 1,462 unique file_ids
- This suggests the extraction captured ~1,462 unique file paths total, but only 451 still exist at HEAD

## Additional Evidence of Parsing Corruption
The files table also contains corrupted entries that aren't real files:
```sql
SELECT file_id, path_current FROM files WHERE exists_at_head = 0 LIMIT 10;
-- Results include:
-- 1|D                                    -- Status code
-- 2|A                                    -- Status code
-- 3|M                                    -- Status code
-- 34|R091                                -- Rename similarity code
-- 46|__LFCA_COMMIT__                     -- Internal marker leaked
-- 47|437046f5a4519aa77e590acde2c040839887f30b  -- Commit hash
-- 48|engel.nyst@gmail.com                -- Email address
-- 49|1767292085                          -- Unix timestamp
```
This further explains the file count discrepancy - many "files" in the database aren't files at all.

## Recommended Fix
1. Investigate `lfca/extract.py` to understand why files are missing
2. Ensure `git ls-tree -r HEAD` is used to get complete current file list
3. Cross-reference with git history extraction
4. Re-run analysis with complete file extraction
5. Add validation check comparing extracted files to actual HEAD files

## Related
- Ground Truth: `/QA/output/openhands/basic_stats.json`
- Database: `files` table - only 1,462 total rows, 451 current
- File: `lfca/extract.py` - extraction logic
