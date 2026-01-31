#!/bin/bash
# commit_patterns.sh - Analyze commit patterns and trends
# Usage: ./commit_patterns.sh /path/to/repo [output_dir]

set -e

REPO_PATH="${1:-.}"
OUTPUT_DIR="${2:-./output}"

if [ ! -d "$REPO_PATH/.git" ]; then
    echo "ERROR: Not a git repository: $REPO_PATH"
    exit 1
fi

cd "$REPO_PATH"
mkdir -p "$OUTPUT_DIR"

echo "=== ANALYZING COMMIT PATTERNS ==="
echo "Repository: $REPO_PATH"
echo ""

JSON_FILE="$OUTPUT_DIR/commit_patterns.json"
DAILY_FILE="$OUTPUT_DIR/daily_commits.csv"
MESSAGE_PATTERNS_FILE="$OUTPUT_DIR/commit_message_patterns.csv"

# Daily commit distribution
echo "Analyzing daily commit patterns..."
echo "date,commit_count,merge_count,file_changes" > "$DAILY_FILE"

git log --format='%ci|%P' --name-only | \
awk -F'|' '
/^[0-9]{4}-[0-9]{2}-[0-9]{2}/ {
    date = substr($1, 1, 10)
    is_merge = (split($2, parents, " ") > 1) ? 1 : 0
    
    if (current_date != date && current_date != "") {
        print current_date "," commit_count "," merge_count "," file_count
        commit_count = 0
        merge_count = 0
        file_count = 0
    }
    current_date = date
    commit_count++
    if (is_merge) merge_count++
    next
}
/^$/ { next }
/./ { file_count++ }
END {
    if (current_date != "") {
        print current_date "," commit_count "," merge_count "," file_count
    }
}
' | sort >> "$DAILY_FILE"

# Commit message patterns
echo ""
echo "Analyzing commit message patterns..."
echo "pattern,count,example" > "$MESSAGE_PATTERNS_FILE"

# Common prefixes
git log --format='%s' | \
awk '
{
    # Extract first word/pattern
    if (match($0, /^[A-Za-z]+(\([^)]+\))?:/)) {
        prefix = substr($0, RSTART, RLENGTH-1)
        patterns[prefix]++
        if (!(prefix in examples)) {
            examples[prefix] = $0
        }
    } else if (match($0, /^\[[^\]]+\]/)) {
        prefix = substr($0, RSTART, RLENGTH)
        patterns[prefix]++
        if (!(prefix in examples)) {
            examples[prefix] = $0
        }
    } else if (match($0, /^(Merge|Revert|Update|Add|Fix|Remove|Refactor|Initial)/)) {
        prefix = substr($0, RSTART, RLENGTH)
        patterns[prefix]++
        if (!(prefix in examples)) {
            examples[prefix] = $0
        }
    }
}
END {
    for (p in patterns) {
        gsub(/"/, "\\\"", examples[p])
        gsub(/,/, ";", examples[p])
        print p "," patterns[p] ",\"" substr(examples[p], 1, 100) "\""
    }
}
' | sort -t',' -k2 -rn >> "$MESSAGE_PATTERNS_FILE"

# Commit size distribution
echo ""
echo "Analyzing commit size distribution..."

COMMIT_SIZES_FILE="$OUTPUT_DIR/commit_sizes.csv"
echo "size_bucket,count" > "$COMMIT_SIZES_FILE"

git log --pretty=format:'%H' | while read -r commit; do
    count=$(git show --stat --oneline "$commit" 2>/dev/null | tail -1 | grep -oP '\d+ file' | grep -oP '\d+' || echo 0)
    echo "$count"
done | \
awk '
{
    if ($1 == 0) bucket = "0"
    else if ($1 == 1) bucket = "1"
    else if ($1 <= 5) bucket = "2-5"
    else if ($1 <= 10) bucket = "6-10"
    else if ($1 <= 20) bucket = "11-20"
    else if ($1 <= 50) bucket = "21-50"
    else if ($1 <= 100) bucket = "51-100"
    else bucket = "100+"
    
    buckets[bucket]++
}
END {
    order[1] = "0"; order[2] = "1"; order[3] = "2-5"; order[4] = "6-10"
    order[5] = "11-20"; order[6] = "21-50"; order[7] = "51-100"; order[8] = "100+"
    for (i = 1; i <= 8; i++) {
        b = order[i]
        print b "," (buckets[b] ? buckets[b] : 0)
    }
}
' >> "$COMMIT_SIZES_FILE"

# Time between commits analysis
echo ""
echo "Analyzing commit frequency..."

# Create JSON output
echo "{" > "$JSON_FILE"
echo "  \"analysis_date\": \"$(date -Iseconds)\"," >> "$JSON_FILE"

# Basic stats
TOTAL_COMMITS=$(git rev-list --count HEAD)
MERGE_COMMITS=$(git log --merges --oneline | wc -l)
FIRST_DATE=$(git log --reverse --format='%ci' | head -1 | cut -d' ' -f1)
LAST_DATE=$(git log --format='%ci' | head -1 | cut -d' ' -f1)
DAYS_SPAN=$(( ($(date -d "$LAST_DATE" +%s) - $(date -d "$FIRST_DATE" +%s)) / 86400 ))
ACTIVE_DAYS=$(tail -n +2 "$DAILY_FILE" | wc -l)

echo "  \"summary\": {" >> "$JSON_FILE"
echo "    \"total_commits\": $TOTAL_COMMITS," >> "$JSON_FILE"
echo "    \"merge_commits\": $MERGE_COMMITS," >> "$JSON_FILE"
echo "    \"first_commit_date\": \"$FIRST_DATE\"," >> "$JSON_FILE"
echo "    \"last_commit_date\": \"$LAST_DATE\"," >> "$JSON_FILE"
echo "    \"total_days_span\": $DAYS_SPAN," >> "$JSON_FILE"
echo "    \"active_days\": $ACTIVE_DAYS," >> "$JSON_FILE"

AVG_COMMITS_PER_DAY=$(echo "scale=2; $TOTAL_COMMITS / $ACTIVE_DAYS" | bc)
echo "    \"avg_commits_per_active_day\": $AVG_COMMITS_PER_DAY" >> "$JSON_FILE"
echo "  }," >> "$JSON_FILE"

# Busiest days
echo "  \"busiest_days\": [" >> "$JSON_FILE"
tail -n +2 "$DAILY_FILE" | sort -t',' -k2 -rn | head -10 | \
while IFS=',' read -r date commits merges files; do
    echo "    {\"date\": \"$date\", \"commits\": $commits, \"merges\": $merges, \"file_changes\": $files},"
done | sed '$ s/,$//' >> "$JSON_FILE"
echo "  ]," >> "$JSON_FILE"

# Commit size buckets
echo "  \"commit_size_distribution\": {" >> "$JSON_FILE"
tail -n +2 "$COMMIT_SIZES_FILE" | while IFS=',' read -r bucket count; do
    echo "    \"$bucket\": $count,"
done | sed '$ s/,$//' >> "$JSON_FILE"
echo "  }," >> "$JSON_FILE"

# Top message patterns
echo "  \"top_commit_patterns\": [" >> "$JSON_FILE"
tail -n +2 "$MESSAGE_PATTERNS_FILE" | head -15 | while IFS=',' read -r pattern count example; do
    pattern_escaped=$(echo "$pattern" | sed 's/"/\\"/g')
    echo "    {\"pattern\": \"$pattern_escaped\", \"count\": $count},"
done | sed '$ s/,$//' >> "$JSON_FILE"
echo "  ]" >> "$JSON_FILE"

echo "}" >> "$JSON_FILE"

echo ""
echo "Output files:"
echo "  Daily commits: $DAILY_FILE"
echo "  Commit sizes: $COMMIT_SIZES_FILE"
echo "  Message patterns: $MESSAGE_PATTERNS_FILE"
echo "  JSON report: $JSON_FILE"
echo ""
echo "Summary:"
echo "  Total commits: $TOTAL_COMMITS"
echo "  Date range: $FIRST_DATE to $LAST_DATE ($DAYS_SPAN days)"
echo "  Active days: $ACTIVE_DAYS"
echo "  Avg commits/active day: $AVG_COMMITS_PER_DAY"
