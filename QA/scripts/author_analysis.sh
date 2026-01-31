#!/bin/bash
# author_analysis.sh - Analyze author contributions and patterns
# Usage: ./author_analysis.sh /path/to/repo [output_dir]

set -e

REPO_PATH="${1:-.}"
OUTPUT_DIR="${2:-./output}"

if [ ! -d "$REPO_PATH/.git" ]; then
    echo "ERROR: Not a git repository: $REPO_PATH"
    exit 1
fi

cd "$REPO_PATH"
mkdir -p "$OUTPUT_DIR"

echo "=== ANALYZING AUTHOR CONTRIBUTIONS ==="
echo "Repository: $REPO_PATH"
echo ""

CSV_FILE="$OUTPUT_DIR/author_stats.csv"
JSON_FILE="$OUTPUT_DIR/author_analysis.json"
AUTHOR_FILES="$OUTPUT_DIR/author_file_ownership.csv"
ACTIVITY_FILE="$OUTPUT_DIR/monthly_activity.csv"

# Get author statistics
echo "Analyzing author contributions..."
echo "author_email,commit_count,first_commit,last_commit,active_days" > "$CSV_FILE"

git log --format='%ae|%ci' | sort | uniq -c | \
while read -r count rest; do
    author=$(echo "$rest" | cut -d'|' -f1)
    first=$(git log --author="$author" --reverse --format='%ci' | head -1 | cut -d' ' -f1)
    last=$(git log --author="$author" --format='%ci' | head -1 | cut -d' ' -f1)
    active_days=$(git log --author="$author" --format='%ci' | cut -d' ' -f1 | sort -u | wc -l)
    echo "$author,$count,$first,$last,$active_days"
done | sort -t',' -k2 -rn >> "$CSV_FILE"

AUTHOR_COUNT=$(wc -l < "$CSV_FILE")
AUTHOR_COUNT=$((AUTHOR_COUNT - 1))
echo "Found $AUTHOR_COUNT unique authors"

# Get top contributors by commit count
TOP_CONTRIBUTORS=$(tail -n +2 "$CSV_FILE" | head -20)

# File ownership (primary author per file)
echo ""
echo "Analyzing file ownership (primary author per file)..."
echo "file_path,primary_author,total_commits,author_commits,ownership_pct" > "$AUTHOR_FILES"

git ls-tree -r HEAD --name-only | head -500 | while read -r filepath; do
    # Get commit counts per author for this file
    author_data=$(git log --format='%ae' -- "$filepath" 2>/dev/null | sort | uniq -c | sort -rn | head -1)
    if [ -n "$author_data" ]; then
        author_commits=$(echo "$author_data" | awk '{print $1}')
        primary_author=$(echo "$author_data" | awk '{print $2}')
        total_commits=$(git log --oneline -- "$filepath" 2>/dev/null | wc -l)
        if [ "$total_commits" -gt 0 ]; then
            ownership_pct=$(echo "scale=2; $author_commits * 100 / $total_commits" | bc)
            echo "$filepath,$primary_author,$total_commits,$author_commits,$ownership_pct" >> "$AUTHOR_FILES"
        fi
    fi
done

# Monthly activity timeline
echo ""
echo "Generating monthly activity timeline..."
echo "year_month,commit_count,unique_authors,files_changed" > "$ACTIVITY_FILE"

git log --format='%ci|%ae' --name-only | \
awk -F'|' '
/^[0-9]{4}-[0-9]{2}/ {
    ym = substr($1, 1, 7)
    author = $2
    if (current_ym != ym && current_ym != "") {
        print current_ym "," commit_count "," length(authors) "," length(files)
        delete authors
        delete files
        commit_count = 0
    }
    current_ym = ym
    authors[author] = 1
    next
}
/^$/ { commit_count++; next }
/./ { files[$0] = 1 }
END {
    if (current_ym != "") {
        print current_ym "," commit_count "," length(authors) "," length(files)
    }
}
' | sort >> "$ACTIVITY_FILE"

# Create JSON output
echo "{" > "$JSON_FILE"
echo "  \"analysis_date\": \"$(date -Iseconds)\"," >> "$JSON_FILE"
echo "  \"total_authors\": $AUTHOR_COUNT," >> "$JSON_FILE"

# Top 20 contributors
echo "  \"top_contributors\": [" >> "$JSON_FILE"
tail -n +2 "$CSV_FILE" | head -20 | while IFS=',' read -r email commits first last days; do
    email_escaped=$(echo "$email" | sed 's/"/\\"/g')
    echo "    {\"email\": \"$email_escaped\", \"commits\": $commits, \"first_commit\": \"$first\", \"last_commit\": \"$last\", \"active_days\": $days},"
done | sed '$ s/,$//' >> "$JSON_FILE"
echo "  ]," >> "$JSON_FILE"

# Bus factor calculation (authors covering 50% of commits)
TOTAL_COMMITS=$(git rev-list --count HEAD)
HALF_COMMITS=$((TOTAL_COMMITS / 2))
BUS_FACTOR=0
RUNNING_SUM=0

while IFS=',' read -r email commits first last days; do
    RUNNING_SUM=$((RUNNING_SUM + commits))
    BUS_FACTOR=$((BUS_FACTOR + 1))
    if [ "$RUNNING_SUM" -ge "$HALF_COMMITS" ]; then
        break
    fi
done < <(tail -n +2 "$CSV_FILE" | head -100)

echo "  \"metrics\": {" >> "$JSON_FILE"
echo "    \"total_commits\": $TOTAL_COMMITS," >> "$JSON_FILE"
echo "    \"bus_factor\": $BUS_FACTOR," >> "$JSON_FILE"

# Contribution distribution
TOP_1_PCT=$(tail -n +2 "$CSV_FILE" | head -1 | cut -d',' -f2)
TOP_1_SHARE=$(echo "scale=2; $TOP_1_PCT * 100 / $TOTAL_COMMITS" | bc)
TOP_5_COMMITS=$(tail -n +2 "$CSV_FILE" | head -5 | awk -F',' '{sum+=$2} END {print sum}')
TOP_5_SHARE=$(echo "scale=2; $TOP_5_COMMITS * 100 / $TOTAL_COMMITS" | bc)
TOP_10_COMMITS=$(tail -n +2 "$CSV_FILE" | head -10 | awk -F',' '{sum+=$2} END {print sum}')
TOP_10_SHARE=$(echo "scale=2; $TOP_10_COMMITS * 100 / $TOTAL_COMMITS" | bc)

echo "    \"top_1_contributor_share_pct\": $TOP_1_SHARE," >> "$JSON_FILE"
echo "    \"top_5_contributors_share_pct\": $TOP_5_SHARE," >> "$JSON_FILE"
echo "    \"top_10_contributors_share_pct\": $TOP_10_SHARE" >> "$JSON_FILE"
echo "  }," >> "$JSON_FILE"

# Commit distribution by day of week
echo "  \"commit_by_day_of_week\": {" >> "$JSON_FILE"
git log --format='%ad' --date=format:'%A' | sort | uniq -c | sort -k2 | \
awk '{
    day = $2
    count = $1
    printf "    \"%s\": %d,\n", day, count
}' | sed '$ s/,$//' >> "$JSON_FILE"
echo "  }," >> "$JSON_FILE"

# Commit distribution by hour
echo "  \"commit_by_hour\": {" >> "$JSON_FILE"
git log --format='%ad' --date=format:'%H' | sort | uniq -c | sort -k2 | \
awk '{
    hour = $2
    count = $1
    printf "    \"%s\": %d,\n", hour, count
}' | sed '$ s/,$//' >> "$JSON_FILE"
echo "  }" >> "$JSON_FILE"

echo "}" >> "$JSON_FILE"

echo ""
echo "Output files:"
echo "  Author stats: $CSV_FILE"
echo "  File ownership: $AUTHOR_FILES"
echo "  Monthly activity: $ACTIVITY_FILE"
echo "  JSON report: $JSON_FILE"
echo ""
echo "Summary:"
echo "  Total authors: $AUTHOR_COUNT"
echo "  Bus factor: $BUS_FACTOR"
echo "  Top contributor share: $TOP_1_SHARE%"
echo "  Top 5 share: $TOP_5_SHARE%"
echo "  Top 10 share: $TOP_10_SHARE%"
