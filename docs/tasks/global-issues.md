# Global Issues

Issues that were discovered during feature development but are not directly related to specific features.

## Data Extraction Issues

### Low Commit Counts
**Status:** Needs Investigation  
**Discovered:** During File Details Panel implementation  
**Symptom:** Files show fewer commits than GitHub reports (e.g., .gitignore shows 3 commits, GitHub shows 20+)

**Analysis:**
- The extraction uses `git log --name-status` which works correctly
- Commit counts are stored in `files.total_commits` column in SQLite
- The parquet changes are correctly filtered by file_id
- Likely cause: The analysis was run with `--since` or `--until` filters limiting the time range

**Resolution Steps:**
1. Check how the analysis was started (any date filters?)
2. Re-run the analysis without date restrictions to capture full history
3. Verify the mirror.git contains all commits

### Missing `lines_added` / `lines_deleted` in Changes Parquet
**Status:** By Design (not a bug)  
**Discovered:** During File Details Panel implementation  
**Symptom:** Additions/Deletions always show 0 in file details

**Analysis:**
- The extract process uses `git log --name-status` which provides status (A/M/D) but NOT line counts
- To get line counts, would need to use `git log --numstat` instead
- This is a known limitation of the current extraction design

**Resolution Options:**
1. Modify extraction to include `--numstat` parsing
2. Add a separate pass to collect line statistics
3. Accept that line counts are not currently tracked

**Trade-offs:**
- `--numstat` adds processing overhead
- Would require re-extraction of all repos
- Line counts are not critical for coupling analysis (the core feature)

---

## UI/UX Issues

### URL State for File Details
**Status:** Needs Implementation  
**Discovered:** During File Details Panel testing  
**Symptom:** When opening file-details, refreshing the page loses the selected file

**Root Cause:** The file path is stored in React state, not in the URL

**Resolution:**
1. Add file path to URL as query parameter: `/repos/{id}/file-details?file=path/to/file.ts`
2. Parse query params on component mount
3. Update URL when file selection changes

---

## Potential Improvements

### Performance Optimization for Large Repos
- Consider pagination for file lists with many files
- Add caching for frequently accessed file details
- Optimize parquet queries with more selective filtering

### Data Quality Improvements
- Add validation for extracted data completeness
- Consider storing extraction metadata (date ranges, filters used)
- Add ability to incrementally update after new commits
