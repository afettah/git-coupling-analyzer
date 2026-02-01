# Issue #004: Git Status Markers Parsed as Filenames

## Description
Git status markers ('M' for Modified, 'A' for Added, 'D' for Deleted) are being incorrectly parsed as actual filenames and stored in the database with high commit counts and coupling relationships.

## Severity
**CRITICAL** - Data corruption / Invalid analysis results

## Reproducibility
**Always**

## URL
N/A (Data Extraction Bug)

## Expected Behavior
Git log parsing should:
1. Recognize status markers as metadata, not filenames
2. Only extract actual file paths
3. Not create file records for 'M', 'A', 'D'

## Current Behavior
Database contains invalid file records:
```
path_current | total_commits | exists_at_head
M            | 3272          | 0
A            | 773           | 0  
D            | 249           | 0
```

These fake files have coupling relationships:
- 'M' has **40 coupling relationships** (highest in the repo!)
- 'A' has multiple coupling relationships
- 'D' has coupling relationships

## Steps to Reproduce
1. Analyze any repository
2. Query: `SELECT * FROM files WHERE path_current IN ('M', 'A', 'D')`
3. Observe status markers treated as files
4. Check coupling: 'M' appears as most coupled "file"

## Root Cause
Git log command output includes status markers:
```
commit abc123
M    pyproject.toml
A    new_file.py
D    old_file.py
```

Parser is treating 'M', 'A', 'D' lines as file paths instead of recognizing them as status indicators followed by actual paths.

## Impact
- **Data Integrity**: Invalid records pollute the database
- **Analysis Accuracy**: Coupling metrics include fake files
- **UI Display**: May show 'M', 'A', 'D' in file lists
- **Business Decisions**: Users may see "M is your most coupled file" (nonsense)
- **Trust**: Undermines confidence in all analysis results

## Verification
```sql
-- Check for status markers
SELECT path_current, total_commits, exists_at_head 
FROM files 
WHERE length(path_current) <= 3 
ORDER BY total_commits DESC;

-- Result shows:
-- M|3272|0
-- A|773|0
-- D|249|0
```

## Recommended Fix
1. **Immediate**: Filter out single-letter filenames in extract.py
2. **Proper Fix**: Update git log parsing to handle status markers correctly
3. **Validation**: Add sanity check - reject paths that are just status markers
4. **Migration**: Delete existing M/A/D records from database
5. **Re-analysis**: Flag all existing analyses as potentially corrupted

## Git Log Format
The issue likely stems from using `git log --name-status` or similar without properly parsing the format:
```
M\tpath/to/file.py    # Tab-separated: status \t path
```

Should use `--name-only` or properly parse `--name-status` format.

## Related
- File: `lfca/extract.py` - Git log parsing logic
- Database: All `files` and `edges` tables potentially affected
- All analyses performed may have invalid coupling data
