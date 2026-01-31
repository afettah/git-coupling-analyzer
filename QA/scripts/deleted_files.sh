#!/bin/bash
# deleted_files.sh - Find files that were deleted from the repository
# Usage: ./deleted_files.sh /path/to/repo [output_dir]

set -e

REPO_PATH="${1:-.}"
OUTPUT_DIR="${2:-./output}"

if [ ! -d "$REPO_PATH/.git" ]; then
    echo "ERROR: Not a git repository: $REPO_PATH"
    exit 1
fi

cd "$REPO_PATH"
mkdir -p "$OUTPUT_DIR"

echo "=== DETECTING DELETED FILES ==="
echo "Repository: $REPO_PATH"
echo ""

CSV_FILE="$OUTPUT_DIR/deleted_files.csv"
JSON_FILE="$OUTPUT_DIR/deleted_files.json"

echo "Finding files that existed in history but not at HEAD..."

# Get all files that ever existed
ALL_FILES_TEMP="$OUTPUT_DIR/.all_files_temp"
git log --all --name-only --pretty=format: | grep -v '^$' | sort -u > "$ALL_FILES_TEMP"
TOTAL_HISTORICAL=$(wc -l < "$ALL_FILES_TEMP")

# Get current files at HEAD
CURRENT_FILES_TEMP="$OUTPUT_DIR/.current_files_temp"
git ls-tree -r HEAD --name-only | sort > "$CURRENT_FILES_TEMP"
TOTAL_CURRENT=$(wc -l < "$CURRENT_FILES_TEMP")

# Find deleted files (in history but not at HEAD)
DELETED_FILES_TEMP="$OUTPUT_DIR/.deleted_files_temp"
comm -23 "$ALL_FILES_TEMP" "$CURRENT_FILES_TEMP" > "$DELETED_FILES_TEMP"
DELETED_COUNT=$(wc -l < "$DELETED_FILES_TEMP")

echo "Historical files: $TOTAL_HISTORICAL"
echo "Current files: $TOTAL_CURRENT"
echo "Deleted files: $DELETED_COUNT"

# Create CSV with commit counts for deleted files
echo ""
echo "Analyzing deleted files..."
echo "path,commit_count,last_commit,last_commit_date" > "$CSV_FILE"

while read -r filepath; do
    # Get commit count
    commit_count=$(git log --oneline -- "$filepath" 2>/dev/null | wc -l)
    
    # Get last commit info
    last_commit=$(git log -1 --pretty=format:'%H' -- "$filepath" 2>/dev/null || echo "unknown")
    last_date=$(git log -1 --pretty=format:'%ci' -- "$filepath" 2>/dev/null || echo "unknown")
    
    echo "$filepath,$commit_count,$last_commit,$last_date" >> "$CSV_FILE"
done < "$DELETED_FILES_TEMP"

# Create JSON
echo ""
echo "Creating JSON output..."

# Count by file type
PY_DELETED=$(grep -c '\.py$' "$DELETED_FILES_TEMP" || echo 0)
JS_DELETED=$(grep -cE '\.(js|ts|tsx|jsx)$' "$DELETED_FILES_TEMP" || echo 0)
TEST_DELETED=$(grep -cE '(test_|_test\.|\.test\.)' "$DELETED_FILES_TEMP" || echo 0)

echo "{" > "$JSON_FILE"
echo "  \"analysis_date\": \"$(date -Iseconds)\"," >> "$JSON_FILE"
echo "  \"summary\": {" >> "$JSON_FILE"
echo "    \"total_historical_files\": $TOTAL_HISTORICAL," >> "$JSON_FILE"
echo "    \"current_files\": $TOTAL_CURRENT," >> "$JSON_FILE"
echo "    \"deleted_files\": $DELETED_COUNT" >> "$JSON_FILE"
echo "  }," >> "$JSON_FILE"
echo "  \"deleted_by_type\": {" >> "$JSON_FILE"
echo "    \"python\": $PY_DELETED," >> "$JSON_FILE"
echo "    \"javascript_typescript\": $JS_DELETED," >> "$JSON_FILE"
echo "    \"tests\": $TEST_DELETED" >> "$JSON_FILE"
echo "  }," >> "$JSON_FILE"
echo "  \"deleted_files\": [" >> "$JSON_FILE"

# Add top 100 deleted files with most commits
tail -n +2 "$CSV_FILE" | sort -t',' -k2 -rn | head -100 | while IFS=',' read -r path count last_commit last_date; do
    path_escaped=$(echo "$path" | sed 's/"/\\"/g')
    echo "    {\"path\": \"$path_escaped\", \"commit_count\": $count, \"last_commit\": \"$last_commit\"},"
done | sed '$ s/,$//' >> "$JSON_FILE"

echo "  ]" >> "$JSON_FILE"
echo "}" >> "$JSON_FILE"

# Cleanup
rm -f "$ALL_FILES_TEMP" "$CURRENT_FILES_TEMP" "$DELETED_FILES_TEMP"

echo ""
echo "=== DELETED FILE DETECTION COMPLETE ==="
echo "Files created:"
echo "  - $CSV_FILE"
echo "  - $JSON_FILE"
