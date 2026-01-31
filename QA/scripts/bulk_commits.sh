#!/bin/bash
# bulk_commits.sh - Find commits with many files (potential refactors/mass changes)
# Usage: ./bulk_commits.sh /path/to/repo [threshold] [output_dir]

set -e

REPO_PATH="${1:-.}"
THRESHOLD="${2:-50}"
OUTPUT_DIR="${3:-./output}"

if [ ! -d "$REPO_PATH/.git" ]; then
    echo "ERROR: Not a git repository: $REPO_PATH"
    exit 1
fi

cd "$REPO_PATH"
mkdir -p "$OUTPUT_DIR"

echo "=== DETECTING BULK COMMITS ==="
echo "Repository: $REPO_PATH"
echo "File count threshold: $THRESHOLD"
echo ""

CSV_FILE="$OUTPUT_DIR/bulk_commits.csv"
JSON_FILE="$OUTPUT_DIR/bulk_commits.json"
DIST_FILE="$OUTPUT_DIR/commit_size_distribution.csv"

echo "Analyzing commit sizes..."

# Get all commits with file counts
TEMP_FILE="$OUTPUT_DIR/.commit_sizes_temp"

git log --pretty=format:'COMMIT_START%H%n%s%n%ae%n%ci' --name-only | \
awk '
/^COMMIT_START/ {
    if (NR > 1 && file_count > 0) {
        gsub(/"/, "\\\"", subject)
        print commit_oid "," file_count "," author "," date ",\"" subject "\""
    }
    commit_oid = substr($0, 13)
    getline subject
    getline author
    getline date
    file_count = 0
    next
}
/^$/ { next }
{
    file_count++
}
END {
    if (file_count > 0) {
        gsub(/"/, "\\\"", subject)
        print commit_oid "," file_count "," author "," date ",\"" subject "\""
    }
}
' > "$TEMP_FILE"

# Create CSV with bulk commits (above threshold)
echo "commit_oid,file_count,author,date,subject" > "$CSV_FILE"
awk -F',' -v threshold="$THRESHOLD" '$2 >= threshold' "$TEMP_FILE" | sort -t',' -k2 -rn >> "$CSV_FILE"

BULK_COUNT=$(wc -l < "$CSV_FILE")
BULK_COUNT=$((BULK_COUNT - 1))
TOTAL_COMMITS=$(wc -l < "$TEMP_FILE")

echo "Found $BULK_COUNT bulk commits (>= $THRESHOLD files) out of $TOTAL_COMMITS total"

# Create distribution
echo ""
echo "Creating commit size distribution..."
echo "size_range,commit_count" > "$DIST_FILE"

awk -F',' '
{
    count = $2
    if (count == 1) range = "1"
    else if (count <= 5) range = "2-5"
    else if (count <= 10) range = "6-10"
    else if (count <= 25) range = "11-25"
    else if (count <= 50) range = "26-50"
    else if (count <= 100) range = "51-100"
    else if (count <= 200) range = "101-200"
    else range = "200+"
    
    dist[range]++
}
END {
    print "1," dist["1"]+0
    print "2-5," dist["2-5"]+0
    print "6-10," dist["6-10"]+0
    print "11-25," dist["11-25"]+0
    print "26-50," dist["26-50"]+0
    print "51-100," dist["51-100"]+0
    print "101-200," dist["101-200"]+0
    print "200+," dist["200+"]+0
}' "$TEMP_FILE" >> "$DIST_FILE"

# Create JSON with top bulk commits
echo ""
echo "Creating JSON output..."

echo "{" > "$JSON_FILE"
echo "  \"analysis_date\": \"$(date -Iseconds)\"," >> "$JSON_FILE"
echo "  \"threshold\": $THRESHOLD," >> "$JSON_FILE"
echo "  \"total_commits\": $TOTAL_COMMITS," >> "$JSON_FILE"
echo "  \"bulk_commits_count\": $BULK_COUNT," >> "$JSON_FILE"
echo "  \"bulk_commits\": [" >> "$JSON_FILE"

tail -n +2 "$CSV_FILE" | head -50 | while IFS=',' read -r oid count author date subject; do
    # Clean up subject (remove surrounding quotes if present)
    subject="${subject%\"}"
    subject="${subject#\"}"
    subject_escaped=$(echo "$subject" | sed 's/"/\\"/g')
    echo "    {\"commit_oid\": \"$oid\", \"file_count\": $count, \"author\": \"$author\", \"date\": \"${date% *}\", \"subject\": \"$subject_escaped\"},"
done | sed '$ s/,$//' >> "$JSON_FILE"

echo "  ]," >> "$JSON_FILE"

# Statistics
MAX_FILES=$(head -2 "$CSV_FILE" | tail -1 | cut -d',' -f2)
AVG_FILES=$(awk -F',' '{sum += $2; n++} END {printf "%.2f", sum/n}' "$TEMP_FILE")

echo "  \"statistics\": {" >> "$JSON_FILE"
echo "    \"max_files_in_commit\": ${MAX_FILES:-0}," >> "$JSON_FILE"
echo "    \"average_files_per_commit\": $AVG_FILES" >> "$JSON_FILE"
echo "  }" >> "$JSON_FILE"
echo "}" >> "$JSON_FILE"

# Cleanup
rm -f "$TEMP_FILE"

echo ""
echo "=== BULK COMMIT DETECTION COMPLETE ==="
echo "Files created:"
echo "  - $CSV_FILE"
echo "  - $JSON_FILE"
echo "  - $DIST_FILE"
