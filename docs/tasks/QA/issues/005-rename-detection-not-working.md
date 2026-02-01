# Issue #005: Incomplete Rename Detection

## Description
File rename tracking is detecting only 399 renames out of 1,541 expected (25.8% detection rate). Ground truth shows 1,541 renames in the OpenHands repository, but the system only captured 399 in the `file_lineage` table.

## Severity
**HIGH** - Critical data accuracy issue, 74% of renames missing

## Reproducibility
**Always**

## URL
N/A (Missing Feature / Data Extraction Bug)

## Expected Behavior
System should:
1. Detect 1,541 renames via `git log --follow --find-renames`
2. Store lineage in `file_lineage` table
3. Display rename history in file details view
4. Show "Lineage" section with rename chain (visible in UI with "M d5d7c18 → HEAD")

Ground truth examples:
- `.openhands/microagents/repo.md` → `AGENTS.md` (100% similarity)
- `enterprise/migrations/versions/086_*.py` → `087_*.py` (94% similarity)
- 1,541 total renames detected

## Current Behavior
```sql
SELECT COUNT(*) FROM file_lineage;
-- Returns: 399 (should be 1,541!)

-- Detection rate: 399 / 1541 = 25.8%
-- Missing: 1,142 renames (74.2%)
```

System is detecting some renames but missing majority of them.

## Steps to Reproduce
1. Analyze OpenHands repository
2. Check `file_lineage` table: `SELECT * FROM file_lineage LIMIT 10;`
3. Observe empty result
4. Compare with ground truth: `/QA/output/openhands/renames.json` shows 1,541 renames

## Impact
- **Business Use Case**: "Track file evolution over time" - NOT WORKING
- **Coupling Accuracy**: Renamed files may create duplicate entries instead of linking history
- **File History**: Incomplete - only shows current path, not previous locations
- **Change Impact**: Can't see if file was previously in different location
- **Real-world Example**: If `src/old_name.py` → `src/new_name.py`, system treats them as separate files instead of same file evolution

## Verification
From `/QA/output/openhands/renames.json`:
```json
{
  "total_renames": 1541,
  "renames": [
    {
      "commit_oid": "9171986dde4442b5e65ae8ca7ea747344de53a42",
      "old_path": ".openhands/microagents/repo.md",
      "new_path": "AGENTS.md",
      "similarity": 100
    },
    ...
  ]
}
```

Database reality:
- `file_lineage` table: **399 rows** (expected 1,541)
- Detection rate: **25.8%**
- Missing renames: **1,142 (74.2%)**

## Root Cause Analysis
Possible causes:
1. **Git command not using `--follow --find-renames`**: Renames not being detected during extraction
2. **Parsing issue**: Rename format not recognized (R100\told\tnew)
3. **Storage issue**: Lineage data extracted but not stored
4. **Database migration**: `file_lineage` table exists but insert logic missing

## Recommended Fix
1. **Extraction**: Use `git log --follow --find-renames=90%` to detect renames
2. **Parsing**: Handle rename format: `R<similarity>\t<old_path>\t<new_path>`
3. **Storage**: Populate `file_lineage` table with rename chains
4. **API**: Add endpoint `/repos/{id}/files/{path}/lineage` to return rename history
5. **UI**: Display lineage in file details view with full rename chain

## Business Value Lost
- Can't answer: "Where did this file come from?"
- Can't answer: "What happened to old_feature.py?"
- Can't track: File evolution through refactorings
- Can't detect: Module reorganizations

## Related
- Ground Truth: `/QA/output/openhands/renames.json` - 1,541 renames
- Database: `file_lineage` table - empty
- File: `lfca/extract.py` - Git log parsing
- UI: File details "Lineage" section - may show placeholder data
