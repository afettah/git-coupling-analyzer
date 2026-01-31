#!/bin/bash
# run_all_qa.sh - Master script to run all QA analysis scripts
# Usage: ./run_all_qa.sh /path/to/repo [output_dir]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_PATH="${1:-.}"
OUTPUT_DIR="${2:-$SCRIPT_DIR/../output/openhands}"

# Validate repo path
if [ ! -d "$REPO_PATH/.git" ]; then
    echo "ERROR: Not a git repository: $REPO_PATH"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "=============================================="
echo "   LFCA QA - Ground Truth Data Collection"
echo "=============================================="
echo ""
echo "Repository: $REPO_PATH"
echo "Output Directory: $OUTPUT_DIR"
echo "Started at: $(date)"
echo ""

# Run all analysis scripts
START_TIME=$(date +%s)

echo "----------------------------------------------"
echo "1/6 - Repository Statistics"
echo "----------------------------------------------"
bash "$SCRIPT_DIR/gather_repo_stats.sh" "$REPO_PATH" "$OUTPUT_DIR"
echo ""

echo "----------------------------------------------"
echo "2/6 - File Change Frequency"
echo "----------------------------------------------"
bash "$SCRIPT_DIR/file_change_frequency.sh" "$REPO_PATH" "$OUTPUT_DIR"
echo ""

echo "----------------------------------------------"
echo "3/6 - Co-change Analysis"
echo "----------------------------------------------"
bash "$SCRIPT_DIR/cochange_analysis.sh" "$REPO_PATH" 3 "$OUTPUT_DIR"
echo ""

echo "----------------------------------------------"
echo "4/6 - Rename Detection"
echo "----------------------------------------------"
bash "$SCRIPT_DIR/rename_detection.sh" "$REPO_PATH" "$OUTPUT_DIR"
echo ""

echo "----------------------------------------------"
echo "5/6 - Bulk Commit Detection"
echo "----------------------------------------------"
bash "$SCRIPT_DIR/bulk_commits.sh" "$REPO_PATH" 50 "$OUTPUT_DIR"
echo ""

echo "----------------------------------------------"
echo "6/6 - Deleted Files Detection"
echo "----------------------------------------------"
bash "$SCRIPT_DIR/deleted_files.sh" "$REPO_PATH" "$OUTPUT_DIR"
echo ""

echo "----------------------------------------------"
echo "7/11 - Module Structure Analysis"
echo "----------------------------------------------"
bash "$SCRIPT_DIR/module_analysis.sh" "$REPO_PATH" "$OUTPUT_DIR"
echo ""

echo "----------------------------------------------"
echo "8/11 - Test-Implementation Coupling"
echo "----------------------------------------------"
bash "$SCRIPT_DIR/test_impl_coupling.sh" "$REPO_PATH" "$OUTPUT_DIR"
echo ""

echo "----------------------------------------------"
echo "9/11 - Author Analysis"
echo "----------------------------------------------"
bash "$SCRIPT_DIR/author_analysis.sh" "$REPO_PATH" "$OUTPUT_DIR"
echo ""

echo "----------------------------------------------"
echo "10/11 - Commit Patterns"
echo "----------------------------------------------"
bash "$SCRIPT_DIR/commit_patterns.sh" "$REPO_PATH" "$OUTPUT_DIR"
echo ""

echo "----------------------------------------------"
echo "11/11 - Hotspot Analysis"
echo "----------------------------------------------"
bash "$SCRIPT_DIR/hotspot_analysis.sh" "$REPO_PATH" "$OUTPUT_DIR"
echo ""

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Create summary JSON
SUMMARY_FILE="$OUTPUT_DIR/qa_summary.json"
echo "{" > "$SUMMARY_FILE"
echo "  \"analysis_date\": \"$(date -Iseconds)\"," >> "$SUMMARY_FILE"
echo "  \"repository\": \"$REPO_PATH\"," >> "$SUMMARY_FILE"
echo "  \"duration_seconds\": $DURATION," >> "$SUMMARY_FILE"
echo "  \"output_files\": [" >> "$SUMMARY_FILE"
ls -1 "$OUTPUT_DIR"/*.{json,csv,txt} 2>/dev/null | while read -r f; do
    basename "$f" | awk '{print "    \"" $0 "\","}'
done | sed '$ s/,$//' >> "$SUMMARY_FILE"
echo "  ]" >> "$SUMMARY_FILE"
echo "}" >> "$SUMMARY_FILE"

echo "=============================================="
echo "   QA Analysis Complete!"
echo "=============================================="
echo ""
echo "Duration: ${DURATION}s"
echo "Output directory: $OUTPUT_DIR"
echo ""
echo "Generated files:"
ls -la "$OUTPUT_DIR"/*.{json,csv,txt} 2>/dev/null | awk '{print "  " $NF " (" $5 " bytes)"}'
echo ""
