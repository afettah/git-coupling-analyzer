#!/bin/bash
# rename_detection.sh - Find all file renames in git history
# Usage: ./rename_detection.sh /path/to/repo [output_dir]

set -e

REPO_PATH="${1:-.}"
OUTPUT_DIR="${2:-./output}"

if [ ! -d "$REPO_PATH/.git" ]; then
    echo "ERROR: Not a git repository: $REPO_PATH"
    exit 1
fi

cd "$REPO_PATH"
mkdir -p "$OUTPUT_DIR"

echo "=== DETECTING FILE RENAMES ==="
echo "Repository: $REPO_PATH"
echo ""

CSV_FILE="$OUTPUT_DIR/renames.csv"
JSON_FILE="$OUTPUT_DIR/renames.json"
CHAINS_FILE="$OUTPUT_DIR/rename_chains.json"

echo "Scanning for renames (using git -M flag)..."

# Get all renames
echo "commit_oid,old_path,new_path,similarity" > "$CSV_FILE"

git log --name-status --diff-filter=R -M90 --pretty=format:'COMMIT:%H' | \
awk '
/^COMMIT:/ {
    commit = substr($0, 8)
    next
}
/^R[0-9]*/ {
    similarity = substr($1, 2)
    if (similarity == "") similarity = "100"
    print commit "," $2 "," $3 "," similarity
}
' >> "$CSV_FILE"

RENAME_COUNT=$(wc -l < "$CSV_FILE")
RENAME_COUNT=$((RENAME_COUNT - 1))

echo "Found $RENAME_COUNT rename operations"

# Create JSON output
echo ""
echo "Creating JSON output..."

echo "{" > "$JSON_FILE"
echo "  \"analysis_date\": \"$(date -Iseconds)\"," >> "$JSON_FILE"
echo "  \"total_renames\": $RENAME_COUNT," >> "$JSON_FILE"
echo "  \"renames\": [" >> "$JSON_FILE"

tail -n +2 "$CSV_FILE" | while IFS=',' read -r commit old new similarity; do
    old_escaped=$(echo "$old" | sed 's/"/\\"/g')
    new_escaped=$(echo "$new" | sed 's/"/\\"/g')
    echo "    {\"commit\": \"$commit\", \"old_path\": \"$old_escaped\", \"new_path\": \"$new_escaped\", \"similarity\": $similarity},"
done | sed '$ s/,$//' >> "$JSON_FILE"

echo "  ]" >> "$JSON_FILE"
echo "}" >> "$JSON_FILE"

# Find rename chains (files renamed multiple times)
echo ""
echo "Detecting rename chains..."

# Build a graph of renames and find chains
python3 << 'PYTHON_SCRIPT' - "$CSV_FILE" "$CHAINS_FILE"
import sys
import csv
import json
from collections import defaultdict

csv_file = sys.argv[1]
output_file = sys.argv[2]

# Build rename graph: new_path -> old_path
rename_from = {}  # new -> old
rename_to = {}    # old -> new

with open(csv_file, 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        old = row['old_path']
        new = row['new_path']
        rename_from[new] = old
        rename_to[old] = new

# Find chains by following links
def find_chain_back(path, visited=None):
    """Find the oldest ancestor of a file"""
    if visited is None:
        visited = set()
    
    if path in visited:
        return [path]  # Cycle detected
    
    visited.add(path)
    
    if path in rename_from:
        chain = find_chain_back(rename_from[path], visited)
        return chain + [path]
    else:
        return [path]

# Find all chains (starting from files that were renamed TO)
chains = []
seen = set()

for new_path in rename_from:
    if new_path not in seen:
        chain = find_chain_back(new_path)
        if len(chain) > 1:
            chains.append(chain)
            seen.update(chain)

# Sort chains by length (longest first)
chains.sort(key=len, reverse=True)

# Output
result = {
    "analysis_date": __import__('datetime').datetime.now().isoformat(),
    "total_chains": len(chains),
    "multi_rename_chains": [c for c in chains if len(c) > 2],
    "chains": [{"length": len(c), "path_history": c} for c in chains[:100]]
}

with open(output_file, 'w') as f:
    json.dump(result, f, indent=2)

print(f"Found {len(chains)} rename chains total")
print(f"Found {len([c for c in chains if len(c) > 2])} files renamed more than once")
PYTHON_SCRIPT

echo ""
echo "=== RENAME DETECTION COMPLETE ==="
echo "Files created:"
echo "  - $CSV_FILE"
echo "  - $JSON_FILE"
echo "  - $CHAINS_FILE"
