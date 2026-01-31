#!/bin/bash
# cochange_analysis.sh - Find files that change together (co-occurrence analysis)
# Usage: ./cochange_analysis.sh /path/to/repo [min_cooccurrence] [output_dir]

set -e

REPO_PATH="${1:-.}"
MIN_COOCCURRENCE="${2:-3}"
OUTPUT_DIR="${3:-./output}"

if [ ! -d "$REPO_PATH/.git" ]; then
    echo "ERROR: Not a git repository: $REPO_PATH"
    exit 1
fi

cd "$REPO_PATH"
mkdir -p "$OUTPUT_DIR"

echo "=== ANALYZING CO-CHANGE PATTERNS ==="
echo "Repository: $REPO_PATH"
echo "Minimum co-occurrence threshold: $MIN_COOCCURRENCE"
echo ""

CSV_FILE="$OUTPUT_DIR/cochange_pairs.csv"
JSON_FILE="$OUTPUT_DIR/cochange_pairs.json"
TEMP_FILE="$OUTPUT_DIR/.cochange_temp"

echo "Extracting commit file lists (this may take several minutes)..."

# Create pairs from each commit
git log --name-only --pretty=format:'---COMMIT---' | \
awk -v min="$MIN_COOCCURRENCE" '
BEGIN { commit_count = 0 }
/^---COMMIT---$/ {
    # Process previous commit files
    if (n > 1 && n <= 100) {  # Skip bulk commits > 100 files
        for (i = 1; i <= n; i++) {
            for (j = i + 1; j <= n; j++) {
                # Ensure consistent ordering (file_a < file_b alphabetically)
                if (files[i] < files[j]) {
                    pair = files[i] "|||" files[j]
                } else {
                    pair = files[j] "|||" files[i]
                }
                pairs[pair]++
            }
        }
    }
    # Reset for next commit
    n = 0
    delete files
    commit_count++
    next
}
/^$/ { next }
{
    n++
    files[n] = $0
}
END {
    # Process last commit
    if (n > 1 && n <= 100) {
        for (i = 1; i <= n; i++) {
            for (j = i + 1; j <= n; j++) {
                if (files[i] < files[j]) {
                    pair = files[i] "|||" files[j]
                } else {
                    pair = files[j] "|||" files[i]
                }
                pairs[pair]++
            }
        }
    }
    
    # Output pairs meeting threshold
    for (pair in pairs) {
        if (pairs[pair] >= min) {
            split(pair, p, "\\|\\|\\|")
            print p[1] "," p[2] "," pairs[pair]
        }
    }
}
' > "$TEMP_FILE"

# Sort by co-occurrence count and create CSV
echo "file_a,file_b,cooccurrence_count" > "$CSV_FILE"
sort -t',' -k3 -rn "$TEMP_FILE" >> "$CSV_FILE"

PAIR_COUNT=$(wc -l < "$TEMP_FILE")
echo "Found $PAIR_COUNT file pairs with >= $MIN_COOCCURRENCE co-occurrences"

# Get top 100 pairs for JSON
echo ""
echo "Creating JSON output with top 100 pairs..."

echo "{" > "$JSON_FILE"
echo "  \"analysis_date\": \"$(date -Iseconds)\"," >> "$JSON_FILE"
echo "  \"min_cooccurrence_threshold\": $MIN_COOCCURRENCE," >> "$JSON_FILE"
echo "  \"total_pairs\": $PAIR_COUNT," >> "$JSON_FILE"
echo "  \"top_100_pairs\": [" >> "$JSON_FILE"

head -100 "$TEMP_FILE" | sort -t',' -k3 -rn | while IFS=',' read -r file_a file_b count; do
    # Escape any special characters in paths
    file_a_escaped=$(echo "$file_a" | sed 's/"/\\"/g')
    file_b_escaped=$(echo "$file_b" | sed 's/"/\\"/g')
    echo "    {\"file_a\": \"$file_a_escaped\", \"file_b\": \"$file_b_escaped\", \"cooccurrence_count\": $count},"
done | sed '$ s/,$//' >> "$JSON_FILE"

echo "  ]" >> "$JSON_FILE"
echo "}" >> "$JSON_FILE"

# Find test-implementation pairs
echo ""
echo "Finding test-implementation pairs..."
TEST_PAIRS_FILE="$OUTPUT_DIR/test_impl_pairs.csv"
echo "test_file,impl_file,cooccurrence_count" > "$TEST_PAIRS_FILE"

grep -E "(test_|_test\.)" "$TEMP_FILE" | sort -t',' -k3 -rn | head -100 >> "$TEST_PAIRS_FILE" 2>/dev/null || true

TEST_PAIR_COUNT=$(wc -l < "$TEST_PAIRS_FILE")
TEST_PAIR_COUNT=$((TEST_PAIR_COUNT - 1))
echo "Found $TEST_PAIR_COUNT test-implementation pairs"

# Cleanup
rm -f "$TEMP_FILE"

echo ""
echo "=== CO-CHANGE ANALYSIS COMPLETE ==="
echo "Files created:"
echo "  - $CSV_FILE"
echo "  - $JSON_FILE"
echo "  - $TEST_PAIRS_FILE"
