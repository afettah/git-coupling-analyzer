#!/bin/bash
# file_change_frequency.sh - Get commit counts per file
# Usage: ./file_change_frequency.sh /path/to/repo [output_dir]

set -e

REPO_PATH="${1:-.}"
OUTPUT_DIR="${2:-./output}"

if [ ! -d "$REPO_PATH/.git" ]; then
    echo "ERROR: Not a git repository: $REPO_PATH"
    exit 1
fi

cd "$REPO_PATH"
mkdir -p "$OUTPUT_DIR"

echo "=== ANALYZING FILE CHANGE FREQUENCY ==="
echo "Repository: $REPO_PATH"
echo ""

CSV_FILE="$OUTPUT_DIR/file_commits.csv"
JSON_FILE="$OUTPUT_DIR/file_commits.json"

echo "Counting commits per file (this may take a while)..."

# Create CSV with commit counts
echo "path,commit_count" > "$CSV_FILE"

git log --name-only --pretty=format: | \
    grep -v '^$' | \
    sort | uniq -c | sort -rn | \
    awk '{print $2","$1}' >> "$CSV_FILE"

# Count total files processed
TOTAL_FILES=$(wc -l < "$CSV_FILE")
TOTAL_FILES=$((TOTAL_FILES - 1))  # Subtract header

echo "Processed $TOTAL_FILES unique file paths"

# Get top 50 most changed files
echo ""
echo "Generating top 50 hotspots..."
TOP_50_FILE="$OUTPUT_DIR/top_50_hotspots.csv"
head -51 "$CSV_FILE" > "$TOP_50_FILE"

# Create JSON for top files
echo "Creating JSON output..."
echo "{" > "$JSON_FILE"
echo "  \"analysis_date\": \"$(date -Iseconds)\"," >> "$JSON_FILE"
echo "  \"total_unique_files\": $TOTAL_FILES," >> "$JSON_FILE"
echo "  \"top_50_hotspots\": [" >> "$JSON_FILE"

# Parse top 50 and create JSON array
tail -n +2 "$TOP_50_FILE" | head -50 | while IFS=',' read -r path count; do
    echo "    {\"path\": \"$path\", \"commit_count\": $count},"
done | sed '$ s/,$//' >> "$JSON_FILE"

echo "  ]," >> "$JSON_FILE"

# Calculate statistics
TOTAL_CHANGES=$(tail -n +2 "$CSV_FILE" | awk -F',' '{sum += $2} END {print sum}')
MAX_CHANGES=$(tail -n +2 "$CSV_FILE" | head -1 | cut -d',' -f2)
AVG_CHANGES=$(echo "scale=2; $TOTAL_CHANGES / $TOTAL_FILES" | bc)

echo "  \"statistics\": {" >> "$JSON_FILE"
echo "    \"total_file_changes\": $TOTAL_CHANGES," >> "$JSON_FILE"
echo "    \"max_changes_single_file\": $MAX_CHANGES," >> "$JSON_FILE"
echo "    \"average_changes_per_file\": $AVG_CHANGES" >> "$JSON_FILE"
echo "  }" >> "$JSON_FILE"
echo "}" >> "$JSON_FILE"

# Distribution analysis
echo ""
echo "Analyzing change distribution..."
DIST_FILE="$OUTPUT_DIR/change_distribution.csv"
echo "change_range,file_count" > "$DIST_FILE"

tail -n +2 "$CSV_FILE" | awk -F',' '
{
    count = $2
    if (count == 1) range = "1"
    else if (count <= 5) range = "2-5"
    else if (count <= 10) range = "6-10"
    else if (count <= 25) range = "11-25"
    else if (count <= 50) range = "26-50"
    else if (count <= 100) range = "51-100"
    else range = "100+"
    
    dist[range]++
}
END {
    print "1," dist["1"]+0
    print "2-5," dist["2-5"]+0
    print "6-10," dist["6-10"]+0
    print "11-25," dist["11-25"]+0
    print "26-50," dist["26-50"]+0
    print "51-100," dist["51-100"]+0
    print "100+," dist["100+"]+0
}' >> "$DIST_FILE"

echo ""
echo "=== FILE CHANGE FREQUENCY ANALYSIS COMPLETE ==="
echo "Files created:"
echo "  - $CSV_FILE"
echo "  - $TOP_50_FILE"
echo "  - $JSON_FILE"
echo "  - $DIST_FILE"
