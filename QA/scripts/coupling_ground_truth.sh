#!/bin/bash
# coupling_ground_truth.sh - Generate ground truth coupling data for validation
# Usage: ./coupling_ground_truth.sh /path/to/repo [output_dir]

set -e

REPO_PATH="${1:-.}"
OUTPUT_DIR="${2:-./output}"

if [ ! -d "$REPO_PATH/.git" ]; then
    echo "ERROR: Not a git repository: $REPO_PATH"
    exit 1
fi

cd "$REPO_PATH"
mkdir -p "$OUTPUT_DIR"

echo "=== GENERATING COUPLING GROUND TRUTH ==="
echo "Repository: $REPO_PATH"
echo ""

JSON_FILE="$OUTPUT_DIR/coupling_ground_truth.json"
PAIRS_FILE="$OUTPUT_DIR/file_pairs_coupling.csv"
INIT_FILES="$OUTPUT_DIR/init_file_coupling.csv"
CONFIG_FILES="$OUTPUT_DIR/config_file_coupling.csv"

# Calculate coupling metrics for top file pairs
echo "Calculating coupling metrics for file pairs..."
echo "file_a,file_b,commits_a,commits_b,pair_count,jaccard,prob_b_given_a,prob_a_given_b" > "$PAIRS_FILE"

# Get all co-changed pairs with minimum 3 co-changes
git log --name-only --pretty=format:'---COMMIT---' | \
awk '
/^---COMMIT---$/ {
    if (n > 1 && n <= 50) {  # Skip bulk commits
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
    n = 0
    delete files
    next
}
/^$/ { next }
{
    n++
    files[n] = $0
}
END {
    for (pair in pairs) {
        if (pairs[pair] >= 3) {
            split(pair, p, "\\|\\|\\|")
            print p[1] "|||" p[2] "|||" pairs[pair]
        }
    }
}
' | sort -t'|' -k5 -rn | head -500 > "$OUTPUT_DIR/.pairs_temp"

# Calculate full metrics for each pair
echo "Computing detailed metrics for top pairs..."
TOTAL_PAIRS=$(wc -l < "$OUTPUT_DIR/.pairs_temp")
CURRENT=0

while IFS='|||' read -r file_a file_b pair_count; do
    CURRENT=$((CURRENT + 1))
    
    # Skip empty lines
    [ -z "$file_a" ] && continue
    [ -z "$file_b" ] && continue
    
    # Get individual commit counts
    commits_a=$(git log --oneline -- "$file_a" 2>/dev/null | wc -l || echo 0)
    commits_b=$(git log --oneline -- "$file_b" 2>/dev/null | wc -l || echo 0)
    
    # Skip if no commits
    [ "$commits_a" -eq 0 ] && continue
    [ "$commits_b" -eq 0 ] && continue
    
    # Calculate metrics
    union=$((commits_a + commits_b - pair_count))
    if [ "$union" -gt 0 ]; then
        jaccard=$(echo "scale=4; $pair_count / $union" | bc)
    else
        jaccard="0"
    fi
    
    prob_b_given_a=$(echo "scale=4; $pair_count / $commits_a" | bc)
    prob_a_given_b=$(echo "scale=4; $pair_count / $commits_b" | bc)
    
    echo "$file_a,$file_b,$commits_a,$commits_b,$pair_count,$jaccard,$prob_b_given_a,$prob_a_given_b" >> "$PAIRS_FILE"
    
    # Progress indicator
    if [ $((CURRENT % 50)) -eq 0 ]; then
        echo "  Processed $CURRENT / $TOTAL_PAIRS pairs"
    fi
done < "$OUTPUT_DIR/.pairs_temp"

rm -f "$OUTPUT_DIR/.pairs_temp"

# Analyze __init__.py coupling patterns
echo ""
echo "Analyzing __init__.py coupling patterns..."
echo "init_file,coupled_file,pair_count,jaccard" > "$INIT_FILES"

git ls-tree -r HEAD --name-only | grep '__init__\.py$' | while read -r init_file; do
    init_dir=$(dirname "$init_file")
    init_commits=$(git log --oneline -- "$init_file" 2>/dev/null | wc -l)
    
    # Find files in same directory
    git ls-tree -r HEAD --name-only | grep "^$init_dir/" | grep -v '__init__\.py$' | head -10 | \
    while read -r sibling; do
        sibling_commits=$(git log --oneline -- "$sibling" 2>/dev/null | wc -l)
        
        # Get co-change count
        if [ "$init_commits" -gt 0 ] && [ "$sibling_commits" -gt 0 ]; then
            init_oids=$(git log --pretty=format:'%H' -- "$init_file" 2>/dev/null | sort)
            sibling_oids=$(git log --pretty=format:'%H' -- "$sibling" 2>/dev/null | sort)
            pair_count=$(comm -12 <(echo "$init_oids") <(echo "$sibling_oids") | wc -l)
            
            if [ "$pair_count" -gt 0 ]; then
                union=$((init_commits + sibling_commits - pair_count))
                jaccard=$(echo "scale=4; $pair_count / $union" | bc)
                echo "$init_file,$sibling,$pair_count,$jaccard" >> "$INIT_FILES"
            fi
        fi
    done
done

# Analyze config file coupling
echo ""
echo "Analyzing config file coupling patterns..."
echo "config_file,consumer_file,pair_count,jaccard" > "$CONFIG_FILES"

# Find config-like files
for config_file in $(git ls-tree -r HEAD --name-only | grep -E '(config|settings|constants).*\.(py|ts|js|json)$' | head -20); do
    config_commits=$(git log --oneline -- "$config_file" 2>/dev/null | wc -l)
    [ "$config_commits" -eq 0 ] && continue
    
    # Get files that often change with this config
    config_oids=$(git log --pretty=format:'%H' -- "$config_file" 2>/dev/null | sort)
    
    git ls-tree -r HEAD --name-only | grep -v "$config_file" | head -200 | \
    while read -r other_file; do
        other_commits=$(git log --oneline -- "$other_file" 2>/dev/null | wc -l)
        [ "$other_commits" -eq 0 ] && continue
        
        other_oids=$(git log --pretty=format:'%H' -- "$other_file" 2>/dev/null | sort)
        pair_count=$(comm -12 <(echo "$config_oids") <(echo "$other_oids") | wc -l)
        
        if [ "$pair_count" -ge 3 ]; then
            union=$((config_commits + other_commits - pair_count))
            jaccard=$(echo "scale=4; $pair_count / $union" | bc)
            echo "$config_file,$other_file,$pair_count,$jaccard" >> "$CONFIG_FILES"
        fi
    done
done

# Create JSON summary
echo ""
echo "Creating JSON report..."

TOTAL_FILE_PAIRS=$(tail -n +2 "$PAIRS_FILE" | wc -l)
HIGH_COUPLING=$(tail -n +2 "$PAIRS_FILE" | awk -F',' '$6 > 0.3 {count++} END {print count+0}')
VERY_HIGH=$(tail -n +2 "$PAIRS_FILE" | awk -F',' '$6 > 0.5 {count++} END {print count+0}')

echo "{" > "$JSON_FILE"
echo "  \"analysis_date\": \"$(date -Iseconds)\"," >> "$JSON_FILE"
echo "  \"summary\": {" >> "$JSON_FILE"
echo "    \"total_file_pairs_analyzed\": $TOTAL_FILE_PAIRS," >> "$JSON_FILE"
echo "    \"high_coupling_pairs\": $HIGH_COUPLING," >> "$JSON_FILE"
echo "    \"very_high_coupling_pairs\": $VERY_HIGH" >> "$JSON_FILE"
echo "  }," >> "$JSON_FILE"

# Top 30 coupled pairs
echo "  \"top_coupled_pairs\": [" >> "$JSON_FILE"
tail -n +2 "$PAIRS_FILE" | sort -t',' -k6 -rn | head -30 | \
while IFS=',' read -r fa fb ca cb pc jac pba pab; do
    fa_escaped=$(echo "$fa" | sed 's/"/\\"/g')
    fb_escaped=$(echo "$fb" | sed 's/"/\\"/g')
    echo "    {\"file_a\": \"$fa_escaped\", \"file_b\": \"$fb_escaped\", \"commits_a\": $ca, \"commits_b\": $cb, \"pair_count\": $pc, \"jaccard\": $jac, \"prob_b_given_a\": $pba, \"prob_a_given_b\": $pab},"
done | sed '$ s/,$//' >> "$JSON_FILE"
echo "  ]," >> "$JSON_FILE"

# Coupling distribution
echo "  \"coupling_distribution\": {" >> "$JSON_FILE"
tail -n +2 "$PAIRS_FILE" | awk -F',' '
{
    j = $6
    if (j < 0.1) buckets["0.0-0.1"]++
    else if (j < 0.2) buckets["0.1-0.2"]++
    else if (j < 0.3) buckets["0.2-0.3"]++
    else if (j < 0.4) buckets["0.3-0.4"]++
    else if (j < 0.5) buckets["0.4-0.5"]++
    else buckets["0.5+"]++
}
END {
    order[1]="0.0-0.1"; order[2]="0.1-0.2"; order[3]="0.2-0.3"
    order[4]="0.3-0.4"; order[5]="0.4-0.5"; order[6]="0.5+"
    for (i=1; i<=6; i++) {
        b = order[i]
        printf "    \"%s\": %d%s\n", b, (buckets[b] ? buckets[b] : 0), (i<6 ? "," : "")
    }
}
' >> "$JSON_FILE"
echo "  }," >> "$JSON_FILE"

# Init file patterns
INIT_PAIRS=$(tail -n +2 "$INIT_FILES" | wc -l)
echo "  \"init_file_coupling\": {" >> "$JSON_FILE"
echo "    \"total_pairs\": $INIT_PAIRS," >> "$JSON_FILE"
echo "    \"top_patterns\": [" >> "$JSON_FILE"
tail -n +2 "$INIT_FILES" | sort -t',' -k4 -rn | head -10 | \
while IFS=',' read -r init coupled pc jac; do
    init_escaped=$(echo "$init" | sed 's/"/\\"/g')
    coupled_escaped=$(echo "$coupled" | sed 's/"/\\"/g')
    echo "      {\"init\": \"$init_escaped\", \"coupled\": \"$coupled_escaped\", \"jaccard\": $jac},"
done | sed '$ s/,$//' >> "$JSON_FILE"
echo "    ]" >> "$JSON_FILE"
echo "  }," >> "$JSON_FILE"

# Config file patterns
CONFIG_PAIRS=$(tail -n +2 "$CONFIG_FILES" | wc -l)
echo "  \"config_file_coupling\": {" >> "$JSON_FILE"
echo "    \"total_pairs\": $CONFIG_PAIRS," >> "$JSON_FILE"
echo "    \"top_patterns\": [" >> "$JSON_FILE"
tail -n +2 "$CONFIG_FILES" | sort -t',' -k4 -rn | head -10 | \
while IFS=',' read -r config consumer pc jac; do
    config_escaped=$(echo "$config" | sed 's/"/\\"/g')
    consumer_escaped=$(echo "$consumer" | sed 's/"/\\"/g')
    echo "      {\"config\": \"$config_escaped\", \"consumer\": \"$consumer_escaped\", \"jaccard\": $jac},"
done | sed '$ s/,$//' >> "$JSON_FILE"
echo "    ]" >> "$JSON_FILE"
echo "  }" >> "$JSON_FILE"

echo "}" >> "$JSON_FILE"

echo ""
echo "Output files:"
echo "  File pairs: $PAIRS_FILE"
echo "  Init coupling: $INIT_FILES"
echo "  Config coupling: $CONFIG_FILES"
echo "  JSON report: $JSON_FILE"
echo ""
echo "Summary:"
echo "  Total pairs analyzed: $TOTAL_FILE_PAIRS"
echo "  High coupling (>0.3): $HIGH_COUPLING"
echo "  Very high coupling (>0.5): $VERY_HIGH"
