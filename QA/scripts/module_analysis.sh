#!/bin/bash
# module_analysis.sh - Analyze folder/module structure and boundaries
# Usage: ./module_analysis.sh /path/to/repo [output_dir]

set -e

REPO_PATH="${1:-.}"
OUTPUT_DIR="${2:-./output}"

if [ ! -d "$REPO_PATH/.git" ]; then
    echo "ERROR: Not a git repository: $REPO_PATH"
    exit 1
fi

cd "$REPO_PATH"
mkdir -p "$OUTPUT_DIR"

echo "=== ANALYZING MODULE STRUCTURE ==="
echo "Repository: $REPO_PATH"
echo ""

JSON_FILE="$OUTPUT_DIR/module_analysis.json"
FOLDER_STATS_FILE="$OUTPUT_DIR/folder_stats.csv"
CROSS_MODULE_FILE="$OUTPUT_DIR/cross_module_changes.csv"

# Get folder statistics
echo "Analyzing folder structure..."
echo "folder,file_count,commit_count" > "$FOLDER_STATS_FILE"

# Get unique top-level and second-level folders
for folder in $(git ls-tree -r HEAD --name-only | cut -d'/' -f1,2 | sort -u | head -100); do
    file_count=$(git ls-tree -r HEAD --name-only | grep "^$folder" | wc -l)
    commit_count=$(git log --oneline -- "$folder" 2>/dev/null | wc -l)
    echo "$folder,$file_count,$commit_count" >> "$FOLDER_STATS_FILE"
done

# Analyze cross-module commits (commits touching multiple top-level folders)
echo ""
echo "Finding cross-module commits..."
echo "commit_oid,folder_count,folders" > "$CROSS_MODULE_FILE"

git log --name-only --pretty=format:'---COMMIT---%H' | \
awk '
/^---COMMIT---/ {
    if (length(folders) > 0 && folder_count > 1) {
        # Join folder names
        folder_list = ""
        for (f in seen_folders) {
            if (folder_list != "") folder_list = folder_list "|"
            folder_list = folder_list f
        }
        print commit "," folder_count "," folder_list
    }
    commit = substr($0, 13)
    delete seen_folders
    folder_count = 0
    next
}
/^$/ { next }
{
    # Get top-level folder
    split($0, parts, "/")
    top_folder = parts[1]
    if (!(top_folder in seen_folders)) {
        seen_folders[top_folder] = 1
        folder_count++
    }
}
END {
    if (folder_count > 1) {
        folder_list = ""
        for (f in seen_folders) {
            if (folder_list != "") folder_list = folder_list "|"
            folder_list = folder_list f
        }
        print commit "," folder_count "," folder_list
    }
}
' >> "$CROSS_MODULE_FILE"

CROSS_MODULE_COUNT=$(wc -l < "$CROSS_MODULE_FILE")
CROSS_MODULE_COUNT=$((CROSS_MODULE_COUNT - 1))

# Find folder coupling (folders that change together)
echo ""
echo "Analyzing folder coupling..."

FOLDER_COUPLING_FILE="$OUTPUT_DIR/folder_coupling.csv"
echo "folder_a,folder_b,cochange_count" > "$FOLDER_COUPLING_FILE"

git log --name-only --pretty=format:'---COMMIT---' | \
awk '
/^---COMMIT---/ {
    if (length(folders) > 1) {
        # Generate pairs
        n = 0
        for (f in seen_folders) {
            n++
            arr[n] = f
        }
        for (i = 1; i < n; i++) {
            for (j = i + 1; j <= n; j++) {
                if (arr[i] < arr[j]) {
                    pair = arr[i] "," arr[j]
                } else {
                    pair = arr[j] "," arr[i]
                }
                pairs[pair]++
            }
        }
    }
    delete seen_folders
    delete arr
    next
}
/^$/ { next }
{
    split($0, parts, "/")
    seen_folders[parts[1]] = 1
}
END {
    for (pair in pairs) {
        print pair "," pairs[pair]
    }
}
' | sort -t',' -k3 -rn >> "$FOLDER_COUPLING_FILE"

# Create comprehensive JSON
echo ""
echo "Creating JSON output..."

# Get top-level folder list
TOP_FOLDERS=$(git ls-tree -d HEAD --name-only | tr '\n' '|' | sed 's/|$//')

# Get folder depths
MAX_DEPTH=$(git ls-tree -r HEAD --name-only | awk -F'/' '{print NF-1}' | sort -rn | head -1)

echo "{" > "$JSON_FILE"
echo "  \"analysis_date\": \"$(date -Iseconds)\"," >> "$JSON_FILE"
echo "  \"structure\": {" >> "$JSON_FILE"
echo "    \"max_depth\": $MAX_DEPTH," >> "$JSON_FILE"
echo "    \"top_level_folders\": [" >> "$JSON_FILE"

git ls-tree -d HEAD --name-only | while read -r folder; do
    file_count=$(git ls-tree -r HEAD --name-only | grep -c "^$folder/" || echo 0)
    echo "      {\"name\": \"$folder\", \"file_count\": $file_count},"
done | sed '$ s/,$//' >> "$JSON_FILE"

echo "    ]" >> "$JSON_FILE"
echo "  }," >> "$JSON_FILE"

echo "  \"cross_module_analysis\": {" >> "$JSON_FILE"
echo "    \"total_cross_module_commits\": $CROSS_MODULE_COUNT" >> "$JSON_FILE"
echo "  }," >> "$JSON_FILE"

echo "  \"top_folder_couplings\": [" >> "$JSON_FILE"
tail -n +2 "$FOLDER_COUPLING_FILE" | head -20 | while IFS=',' read -r a b count; do
    echo "    {\"folder_a\": \"$a\", \"folder_b\": \"$b\", \"cochange_count\": $count},"
done | sed '$ s/,$//' >> "$JSON_FILE"

echo "  ]" >> "$JSON_FILE"
echo "}" >> "$JSON_FILE"

echo ""
echo "=== MODULE ANALYSIS COMPLETE ==="
echo "Files created:"
echo "  - $FOLDER_STATS_FILE"
echo "  - $CROSS_MODULE_FILE"
echo "  - $FOLDER_COUPLING_FILE"
echo "  - $JSON_FILE"
