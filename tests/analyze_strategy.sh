#!/bin/bash

# Directory setup
STRATEGY_LOGS_DIR="tests/strategy_logs"
mkdir -p "$STRATEGY_LOGS_DIR"

# Run test analysis script
echo "Analyzing test results..."
python tests/analyze_test_strategy.py > "$STRATEGY_LOGS_DIR/latest_analysis.json"

# Extract critical issues and write to summary
echo "# Test Strategy Analysis" > "$STRATEGY_LOGS_DIR/latest_summary.md"
echo "Generated at: $(date)" >> "$STRATEGY_LOGS_DIR/latest_summary.md"
echo "" >> "$STRATEGY_LOGS_DIR/latest_summary.md"

echo "## Critical Issues" >> "$STRATEGY_LOGS_DIR/latest_summary.md"
echo "\`\`\`" >> "$STRATEGY_LOGS_DIR/latest_summary.md"
jq -r '.failures | to_entries[] | "\(.key) Module:\n  Failed Tests: \((.value | length))\n  Error Types: \(.value | map(.error_type) | unique | join(", "))\n"' \
    "$STRATEGY_LOGS_DIR/latest_analysis.json" >> "$STRATEGY_LOGS_DIR/latest_summary.md"
echo "\`\`\`" >> "$STRATEGY_LOGS_DIR/latest_summary.md"

echo "" >> "$STRATEGY_LOGS_DIR/latest_summary.md"
echo "## Recommendations" >> "$STRATEGY_LOGS_DIR/latest_summary.md"
jq -r '.recommendations[]' "$STRATEGY_LOGS_DIR/latest_analysis.json" | \
    sed 's/^/- /' >> "$STRATEGY_LOGS_DIR/latest_summary.md"

echo "" >> "$STRATEGY_LOGS_DIR/latest_summary.md"
echo "## Fix Priority Order" >> "$STRATEGY_LOGS_DIR/latest_summary.md"
jq -r '.priority_order[]' "$STRATEGY_LOGS_DIR/latest_analysis.json" | \
    nl -w2 -s'. ' >> "$STRATEGY_LOGS_DIR/latest_summary.md"

# Add failure details section
echo "" >> "$STRATEGY_LOGS_DIR/latest_summary.md"
echo "## Detailed Failure Analysis" >> "$STRATEGY_LOGS_DIR/latest_summary.md"
echo "\`\`\`" >> "$STRATEGY_LOGS_DIR/latest_summary.md"
jq -r '.failures | to_entries[] | .key as $module | .value[] | "\($module): \(.test)\n  Error: \(.error)\n  Type: \(.error_type)\n"' \
    "$STRATEGY_LOGS_DIR/latest_analysis.json" >> "$STRATEGY_LOGS_DIR/latest_summary.md"
echo "\`\`\`" >> "$STRATEGY_LOGS_DIR/latest_summary.md"

# Display the summary
cat "$STRATEGY_LOGS_DIR/latest_summary.md"