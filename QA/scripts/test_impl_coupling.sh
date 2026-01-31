#!/bin/bash
# test_impl_coupling.sh - Analyze test file ↔ implementation file coupling
# Usage: ./test_impl_coupling.sh /path/to/repo [output_dir]

set -e

REPO_PATH="${1:-.}"
OUTPUT_DIR="${2:-./output}"

if [ ! -d "$REPO_PATH/.git" ]; then
    echo "ERROR: Not a git repository: $REPO_PATH"
    exit 1
fi

cd "$REPO_PATH"
mkdir -p "$OUTPUT_DIR"

echo "=== ANALYZING TEST-IMPLEMENTATION COUPLING ==="
echo "Repository: $REPO_PATH"
echo ""

CSV_FILE="$OUTPUT_DIR/test_impl_pairs.csv"
JSON_FILE="$OUTPUT_DIR/test_impl_coupling.json"

# Find test files and their potential implementations
echo "Finding test files..."
TEST_FILES_TEMP="$OUTPUT_DIR/.test_files_temp"
git ls-tree -r HEAD --name-only | grep -E '(test_.*\.py$|_test\.py$|\.test\.(ts|js|tsx|jsx)$|__tests__/)' > "$TEST_FILES_TEMP" || true
TEST_COUNT=$(wc -l < "$TEST_FILES_TEMP")
echo "Found $TEST_COUNT test files"

echo ""
echo "Analyzing test-implementation co-changes..."
echo "test_file,impl_file,test_commits,impl_commits,cochange_count,jaccard" > "$CSV_FILE"

# Process Python test files (test_*.py pattern)
while read -r test_file; do
    # Skip if empty
    [ -z "$test_file" ] && continue
    
    # Extract potential implementation file name
    base_name=$(basename "$test_file")
    dir_name=$(dirname "$test_file")
    
    # Try different patterns to find implementation
    impl_file=""
    
    if [[ "$base_name" =~ ^test_(.*)\.py$ ]]; then
        # test_foo.py -> foo.py
        impl_name="${BASH_REMATCH[1]}.py"
        
        # Look in same directory, parent, or standard locations
        for search_dir in "$dir_name" "$(dirname "$dir_name")" "$(dirname "$dir_name")/$(basename "$(dirname "$dir_name")")"; do
            candidate="$search_dir/$impl_name"
            if git ls-tree -r HEAD --name-only | grep -q "^$candidate$"; then
                impl_file="$candidate"
                break
            fi
        done
        
        # Also try removing 'tests/' from path
        if [ -z "$impl_file" ]; then
            impl_candidate=$(echo "$dir_name/$impl_name" | sed 's|tests/||g' | sed 's|test/||g')
            if git ls-tree -r HEAD --name-only | grep -qF "$impl_name"; then
                impl_file=$(git ls-tree -r HEAD --name-only | grep -F "$impl_name" | head -1)
            fi
        fi
    elif [[ "$base_name" =~ ^(.*)_test\.py$ ]]; then
        # foo_test.py -> foo.py
        impl_name="${BASH_REMATCH[1]}.py"
        if git ls-tree -r HEAD --name-only | grep -qF "$impl_name"; then
            impl_file=$(git ls-tree -r HEAD --name-only | grep -F "/$impl_name$" | head -1)
        fi
    fi
    
    # If we found an implementation file, calculate coupling
    if [ -n "$impl_file" ] && [ "$impl_file" != "$test_file" ]; then
        test_commits=$(git log --oneline -- "$test_file" 2>/dev/null | wc -l)
        impl_commits=$(git log --oneline -- "$impl_file" 2>/dev/null | wc -l)
        
        # Get cochange count (commits where both files changed)
        cochange=$(git log --oneline -- "$test_file" "$impl_file" 2>/dev/null | wc -l)
        
        # This overcounts - need intersection
        test_oids=$(git log --pretty=format:'%H' -- "$test_file" 2>/dev/null | sort)
        impl_oids=$(git log --pretty=format:'%H' -- "$impl_file" 2>/dev/null | sort)
        
        if [ -n "$test_oids" ] && [ -n "$impl_oids" ]; then
            cochange=$(comm -12 <(echo "$test_oids") <(echo "$impl_oids") | wc -l)
            
            # Calculate Jaccard: intersection / union
            union=$((test_commits + impl_commits - cochange))
            if [ "$union" -gt 0 ]; then
                jaccard=$(echo "scale=4; $cochange / $union" | bc)
            else
                jaccard="0"
            fi
            
            echo "$test_file,$impl_file,$test_commits,$impl_commits,$cochange,$jaccard" >> "$CSV_FILE"
        fi
    fi
done < "$TEST_FILES_TEMP"

# Count results
PAIR_COUNT=$(wc -l < "$CSV_FILE")
PAIR_COUNT=$((PAIR_COUNT - 1))

echo ""
echo "Found $PAIR_COUNT test-implementation pairs"

# Create JSON output
echo "{" > "$JSON_FILE"
echo "  \"analysis_date\": \"$(date -Iseconds)\"," >> "$JSON_FILE"
echo "  \"total_test_files\": $TEST_COUNT," >> "$JSON_FILE"
echo "  \"matched_pairs\": $PAIR_COUNT," >> "$JSON_FILE"
echo "  \"pairs\": [" >> "$JSON_FILE"

# Add pairs with high coupling
tail -n +2 "$CSV_FILE" | sort -t',' -k6 -rn | head -50 | while IFS=',' read -r test impl tc ic cc jac; do
    echo "    {\"test\": \"$test\", \"impl\": \"$impl\", \"test_commits\": $tc, \"impl_commits\": $ic, \"cochange\": $cc, \"jaccard\": $jac},"
done | sed '$ s/,$//' >> "$JSON_FILE"

echo "  ]," >> "$JSON_FILE"

# Summary statistics
AVG_JACCARD=$(tail -n +2 "$CSV_FILE" | awk -F',' '{sum += $6; count++} END {if(count>0) printf "%.4f", sum/count; else print "0"}')
HIGH_COUPLING=$(tail -n +2 "$CSV_FILE" | awk -F',' '$6 > 0.3 {count++} END {print count+0}')

echo "  \"statistics\": {" >> "$JSON_FILE"
echo "    \"average_jaccard\": $AVG_JACCARD," >> "$JSON_FILE"
echo "    \"high_coupling_pairs\": $HIGH_COUPLING" >> "$JSON_FILE"
echo "  }" >> "$JSON_FILE"
echo "}" >> "$JSON_FILE"

# Cleanup
rm -f "$TEST_FILES_TEMP"

echo ""
echo "Output files:"
echo "  CSV: $CSV_FILE"
echo "  JSON: $JSON_FILE"
echo ""
echo "Top 10 coupled test-implementation pairs:"
echo "---"
tail -n +2 "$CSV_FILE" | sort -t',' -k6 -rn | head -10 | \
    awk -F',' '{printf "  %s <-> %s (Jaccard: %s)\n", $1, $2, $6}'
