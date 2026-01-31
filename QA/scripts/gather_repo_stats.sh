#!/bin/bash
# gather_repo_stats.sh - Gather comprehensive repository statistics
# Usage: ./gather_repo_stats.sh /path/to/repo [output_dir]

set -e

REPO_PATH="${1:-.}"
OUTPUT_DIR="${2:-./output}"

# Validate repo path
if [ ! -d "$REPO_PATH/.git" ]; then
    echo "ERROR: Not a git repository: $REPO_PATH"
    exit 1
fi

cd "$REPO_PATH"
mkdir -p "$OUTPUT_DIR"

echo "=== GATHERING REPOSITORY STATISTICS ==="
echo "Repository: $REPO_PATH"
echo "Output: $OUTPUT_DIR"
echo ""

# Create JSON output
JSON_FILE="$OUTPUT_DIR/repo_stats.json"

# Basic counts
TOTAL_COMMITS=$(git rev-list --count HEAD)
CURRENT_FILES=$(git ls-tree -r HEAD --name-only | wc -l)
TOTAL_BRANCHES=$(git branch -r 2>/dev/null | wc -l || echo 0)

# Commit range
FIRST_COMMIT_OID=$(git log --reverse --format='%H' | head -1)
FIRST_COMMIT_DATE=$(git log --reverse --format='%ci' | head -1)
LAST_COMMIT_OID=$(git log -1 --format='%H')
LAST_COMMIT_DATE=$(git log -1 --format='%ci')

# Merge commits
MERGE_COMMITS=$(git log --merges --oneline | wc -l)
NON_MERGE_COMMITS=$(git log --no-merges --oneline | wc -l)

# Authors
UNIQUE_AUTHORS=$(git log --format='%ae' | sort -u | wc -l)

# File types at HEAD
PYTHON_FILES=$(git ls-tree -r HEAD --name-only | grep -c '\.py$' || echo 0)
JS_TS_FILES=$(git ls-tree -r HEAD --name-only | grep -cE '\.(js|ts|tsx|jsx)$' || echo 0)
CONFIG_FILES=$(git ls-tree -r HEAD --name-only | grep -cE '\.(json|yaml|yml|toml|ini)$' || echo 0)
TEST_FILES=$(git ls-tree -r HEAD --name-only | grep -cE '(test_|_test\.|\.test\.|tests/)' || echo 0)
MARKDOWN_FILES=$(git ls-tree -r HEAD --name-only | grep -c '\.md$' || echo 0)

# Folder structure
MAX_DEPTH=$(git ls-tree -r HEAD --name-only | awk -F'/' '{print NF-1}' | sort -rn | head -1)
TOP_LEVEL_FOLDERS=$(git ls-tree -d HEAD --name-only | wc -l)

# Write JSON
cat > "$JSON_FILE" << EOF
{
  "repository": {
    "path": "$(pwd)",
    "analyzed_at": "$(date -Iseconds)"
  },
  "commits": {
    "total": $TOTAL_COMMITS,
    "merge_commits": $MERGE_COMMITS,
    "non_merge_commits": $NON_MERGE_COMMITS,
    "first_commit": {
      "oid": "$FIRST_COMMIT_OID",
      "date": "$FIRST_COMMIT_DATE"
    },
    "last_commit": {
      "oid": "$LAST_COMMIT_OID",
      "date": "$LAST_COMMIT_DATE"
    }
  },
  "files": {
    "current_total": $CURRENT_FILES,
    "by_type": {
      "python": $PYTHON_FILES,
      "javascript_typescript": $JS_TS_FILES,
      "config": $CONFIG_FILES,
      "tests": $TEST_FILES,
      "markdown": $MARKDOWN_FILES
    }
  },
  "structure": {
    "max_folder_depth": $MAX_DEPTH,
    "top_level_folders": $TOP_LEVEL_FOLDERS,
    "branches_count": $TOTAL_BRANCHES
  },
  "authors": {
    "unique_count": $UNIQUE_AUTHORS
  }
}
EOF

echo "Basic statistics saved to: $JSON_FILE"

# Also write human-readable report
REPORT_FILE="$OUTPUT_DIR/repo_stats_report.txt"
cat > "$REPORT_FILE" << EOF
=== REPOSITORY STATISTICS REPORT ===
Generated: $(date)
Repository: $(pwd)

## Basic Counts
- Total commits: $TOTAL_COMMITS
- Merge commits: $MERGE_COMMITS
- Non-merge commits: $NON_MERGE_COMMITS
- Current files at HEAD: $CURRENT_FILES
- Total branches: $TOTAL_BRANCHES

## Commit Range
- First commit: $FIRST_COMMIT_OID
  Date: $FIRST_COMMIT_DATE
- Last commit: $LAST_COMMIT_OID
  Date: $LAST_COMMIT_DATE

## File Types at HEAD
- Python files (.py): $PYTHON_FILES
- JS/TS files: $JS_TS_FILES
- Config files (json/yaml/toml/ini): $CONFIG_FILES
- Test files: $TEST_FILES
- Markdown files: $MARKDOWN_FILES

## Repository Structure
- Max folder depth: $MAX_DEPTH
- Top-level folders: $TOP_LEVEL_FOLDERS

## Contributors
- Unique authors: $UNIQUE_AUTHORS
EOF

echo "Report saved to: $REPORT_FILE"

# Export top-level folders
echo "Exporting top-level folders..."
git ls-tree -d HEAD --name-only > "$OUTPUT_DIR/top_level_folders.txt"

# Export all current file paths
echo "Exporting current file list..."
git ls-tree -r HEAD --name-only > "$OUTPUT_DIR/current_files.txt"

# Export authors list
echo "Exporting authors list..."
git log --format='%ae' | sort | uniq -c | sort -rn > "$OUTPUT_DIR/authors_by_commits.txt"

echo ""
echo "=== STATISTICS GATHERING COMPLETE ==="
