#!/bin/bash

# Create reports directory if it doesn't exist
mkdir -p tests/reports
mkdir -p tests/strategy_logs

# Run tests and capture full output
echo "Running test suite..."
timeout 300 python -m pytest tests/ -v --tb=short 2>&1 | tee tests/reports/test-output.txt
TEST_EXIT_CODE=${PIPESTATUS[0]}

# Check if test output was generated
if [ ! -s tests/reports/test-output.txt ]; then
    echo "Error: No test output generated"
    exit 1
fi

# Generate summary markdown
echo "# Test Execution Summary" > tests/reports/test-summary.md
echo "\`\`\`" >> tests/reports/test-summary.md
grep -A 5 "Test Files" tests/reports/test-output.txt >> tests/reports/test-summary.md || true
echo "\`\`\`" >> tests/reports/test-summary.md

# Extract failed tests if any
echo -e "\n## Failed Tests" >> tests/reports/test-summary.md
echo "\`\`\`" >> tests/reports/test-summary.md
grep -B 1 -A 3 "FAIL" tests/reports/test-output.txt >> tests/reports/test-summary.md || true
echo "\`\`\`" >> tests/reports/test-summary.md

# Run strategy analysis
echo "Analyzing test results..."
bash tests/analyze_strategy.sh

# Update the main test report with categorized issues
echo "# Test Report Summary" > tests/reports/test-report.md
echo -e "\nTest Results:" >> tests/reports/test-report.md
cat tests/reports/test-summary.md >> tests/reports/test-report.md

echo -e "\nStrategy Analysis:" >> tests/reports/test-report.md
cat tests/strategy_logs/latest_summary.md >> tests/reports/test-report.md

chmod +x tests/analyze_strategy.sh
chmod +x .git/hooks/pre-push

echo "Test report generated. View full report in tests/reports/test-report.md"

# Exit with test timeout status if needed
if [ $TEST_EXIT_CODE -eq 124 ]; then
    echo "Warning: Test execution timed out after 300 seconds. Results may be incomplete."
fi

# Exit with the test suite's exit code
exit $TEST_EXIT_CODE