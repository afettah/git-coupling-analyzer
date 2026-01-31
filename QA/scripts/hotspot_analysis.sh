#!/bin/bash
# hotspot_analysis.sh - Identify change hotspots and code churn
# Usage: ./hotspot_analysis.sh /path/to/repo [output_dir]

set -e

REPO_PATH="${1:-.}"
OUTPUT_DIR="${2:-./output}"

if [ ! -d "$REPO_PATH/.git" ]; then
    echo "ERROR: Not a git repository: $REPO_PATH"
    exit 1
fi

cd "$REPO_PATH"
mkdir -p "$OUTPUT_DIR"

echo "=== ANALYZING CODE HOTSPOTS ==="
echo "Repository: $REPO_PATH"
echo ""

JSON_FILE="$OUTPUT_DIR/hotspot_analysis.json"
CHURN_FILE="$OUTPUT_DIR/file_churn.csv"
RECENT_HOTSPOTS="$OUTPUT_DIR/recent_hotspots.csv"

# Calculate file churn (lines added + deleted over time)
echo "Calculating file churn (this may take a while)..."
echo "path,commits,total_insertions,total_deletions,churn,exists_at_head" > "$CHURN_FILE"

# Get list of files with their stats
git log --numstat --pretty=format:'COMMIT:%H' | \
awk '
/^COMMIT:/ { next }
/^$/ { next }
/^[0-9]+\t[0-9]+\t/ {
    insertions = $1
    deletions = $2
    file = $3
    
    # Handle binary files
    if (insertions == "-") insertions = 0
    if (deletions == "-") deletions = 0
    
    commits[file]++
    ins[file] += insertions
    del[file] += deletions
}
END {
    for (f in commits) {
        churn = ins[f] + del[f]
        print f "," commits[f] "," ins[f] "," del[f] "," churn
    }
}
' | sort -t',' -k5 -rn > "$OUTPUT_DIR/.churn_temp"

# Add exists_at_head flag
while IFS=',' read -r path commits ins del churn; do
    if git ls-tree -r HEAD --name-only | grep -qF "$path"; then
        exists="true"
    else
        exists="false"
    fi
    echo "$path,$commits,$ins,$del,$churn,$exists"
done < "$OUTPUT_DIR/.churn_temp" >> "$CHURN_FILE"
rm -f "$OUTPUT_DIR/.churn_temp"

# Recent hotspots (last 90 days)
echo ""
echo "Finding recent hotspots (last 90 days)..."
echo "path,recent_commits,recent_churn" > "$RECENT_HOTSPOTS"

SINCE_DATE=$(date -d "90 days ago" +%Y-%m-%d)

git log --since="$SINCE_DATE" --numstat --pretty=format:'COMMIT:%H' | \
awk '
/^COMMIT:/ { next }
/^$/ { next }
/^[0-9]+\t[0-9]+\t/ {
    insertions = $1
    deletions = $2
    file = $3
    
    if (insertions == "-") insertions = 0
    if (deletions == "-") deletions = 0
    
    commits[file]++
    churn[file] += insertions + deletions
}
END {
    for (f in commits) {
        print f "," commits[f] "," churn[f]
    }
}
' | sort -t',' -k2 -rn | head -100 >> "$RECENT_HOTSPOTS"

# File age analysis (days since first and last change)
echo ""
echo "Analyzing file age and staleness..."
AGE_FILE="$OUTPUT_DIR/file_age.csv"
echo "path,first_commit_date,last_commit_date,age_days,staleness_days" > "$AGE_FILE"

TODAY=$(date +%s)

git ls-tree -r HEAD --name-only | head -500 | while read -r filepath; do
    first_date=$(git log --reverse --format='%ci' -- "$filepath" 2>/dev/null | head -1 | cut -d' ' -f1)
    last_date=$(git log --format='%ci' -- "$filepath" 2>/dev/null | head -1 | cut -d' ' -f1)
    
    if [ -n "$first_date" ] && [ -n "$last_date" ]; then
        first_ts=$(date -d "$first_date" +%s 2>/dev/null || echo 0)
        last_ts=$(date -d "$last_date" +%s 2>/dev/null || echo 0)
        
        age_days=$(( (TODAY - first_ts) / 86400 ))
        staleness_days=$(( (TODAY - last_ts) / 86400 ))
        
        echo "$filepath,$first_date,$last_date,$age_days,$staleness_days" >> "$AGE_FILE"
    fi
done

# Create JSON report
echo ""
echo "Creating JSON report..."

TOTAL_CHURN=$(tail -n +2 "$CHURN_FILE" | awk -F',' '{sum+=$5} END {print sum}')
FILE_COUNT=$(tail -n +2 "$CHURN_FILE" | wc -l)

echo "{" > "$JSON_FILE"
echo "  \"analysis_date\": \"$(date -Iseconds)\"," >> "$JSON_FILE"
echo "  \"summary\": {" >> "$JSON_FILE"
echo "    \"total_files_with_history\": $FILE_COUNT," >> "$JSON_FILE"
echo "    \"total_churn_lines\": $TOTAL_CHURN" >> "$JSON_FILE"
echo "  }," >> "$JSON_FILE"

# Top 20 by churn
echo "  \"top_churn_files\": [" >> "$JSON_FILE"
tail -n +2 "$CHURN_FILE" | sort -t',' -k5 -rn | head -20 | \
while IFS=',' read -r path commits ins del churn exists; do
    path_escaped=$(echo "$path" | sed 's/"/\\"/g')
    echo "    {\"path\": \"$path_escaped\", \"commits\": $commits, \"insertions\": $ins, \"deletions\": $del, \"churn\": $churn, \"exists_at_head\": $exists},"
done | sed '$ s/,$//' >> "$JSON_FILE"
echo "  ]," >> "$JSON_FILE"

# Top 20 by commit count
echo "  \"top_commit_count_files\": [" >> "$JSON_FILE"
tail -n +2 "$CHURN_FILE" | sort -t',' -k2 -rn | head -20 | \
while IFS=',' read -r path commits ins del churn exists; do
    path_escaped=$(echo "$path" | sed 's/"/\\"/g')
    echo "    {\"path\": \"$path_escaped\", \"commits\": $commits, \"churn\": $churn, \"exists_at_head\": $exists},"
done | sed '$ s/,$//' >> "$JSON_FILE"
echo "  ]," >> "$JSON_FILE"

# Recent hotspots
echo "  \"recent_hotspots_90d\": [" >> "$JSON_FILE"
tail -n +2 "$RECENT_HOTSPOTS" | head -20 | \
while IFS=',' read -r path commits churn; do
    path_escaped=$(echo "$path" | sed 's/"/\\"/g')
    echo "    {\"path\": \"$path_escaped\", \"recent_commits\": $commits, \"recent_churn\": $churn},"
done | sed '$ s/,$//' >> "$JSON_FILE"
echo "  ]," >> "$JSON_FILE"

# Stalest files (oldest without updates)
echo "  \"stalest_files\": [" >> "$JSON_FILE"
tail -n +2 "$AGE_FILE" | sort -t',' -k5 -rn | head -20 | \
while IFS=',' read -r path first last age stale; do
    path_escaped=$(echo "$path" | sed 's/"/\\"/g')
    echo "    {\"path\": \"$path_escaped\", \"last_change\": \"$last\", \"staleness_days\": $stale},"
done | sed '$ s/,$//' >> "$JSON_FILE"
echo "  ]" >> "$JSON_FILE"

echo "}" >> "$JSON_FILE"

echo ""
echo "Output files:"
echo "  File churn: $CHURN_FILE"
echo "  Recent hotspots: $RECENT_HOTSPOTS"
echo "  File age: $AGE_FILE"
echo "  JSON report: $JSON_FILE"
echo ""
echo "Top 10 churn hotspots:"
tail -n +2 "$CHURN_FILE" | sort -t',' -k5 -rn | head -10 | \
    awk -F',' '{printf "  %s - %d commits, %d lines churn\n", $1, $2, $5}'
