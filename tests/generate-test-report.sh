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

# Run strategy analysis
echo "Analyzing test results..."
bash tests/analyze_strategy.sh

# Update the main test report with categorized issues
echo "# Test Report Summary" > tests/reports/test-report.md
echo "Generated at: $(date)" >> tests/reports/test-report.md

# Add quick summary section
echo -e "\n## Quick Summary" >> tests/reports/test-report.md
TOTAL_TESTS=$(grep -c "::test_" tests/reports/test-output.txt || echo "0")
FAILED_TESTS=$(grep -c "FAILED" tests/reports/test-output.txt || echo "0")
PASSED_TESTS=$((TOTAL_TESTS - FAILED_TESTS))
echo "* Total Tests: $TOTAL_TESTS" >> tests/reports/test-report.md
echo "* Passed: $PASSED_TESTS" >> tests/reports/test-report.md
echo "* Failed: $FAILED_TESTS" >> tests/reports/test-report.md

# Add test execution summary
echo -e "\n## Test Results" >> tests/reports/test-report.md
echo '```' >> tests/reports/test-report.md
grep -A 5 "Test Files" tests/reports/test-output.txt >> tests/reports/test-report.md || true
echo '```' >> tests/reports/test-report.md

# Add failed tests section if there are failures
echo -e "\n## Failed Tests" >> tests/reports/test-report.md
if grep -q "FAILED" tests/reports/test-output.txt; then
    # Group failures by module
    echo "### By Module:" >> tests/reports/test-report.md
    for module in api database graph integration; do
        if grep -q "test_${module}.py.*FAILED" tests/reports/test-output.txt; then
            echo -e "\n#### ${module^} Module" >> tests/reports/test-report.md
            echo '```' >> tests/reports/test-report.md
            grep -B 1 -A 3 "test_${module}.py.*FAILED" tests/reports/test-output.txt >> tests/reports/test-report.md || true
            echo '```' >> tests/reports/test-report.md
        fi
    done

    # Add error summary section
    echo -e "\n### Error Summary:" >> tests/reports/test-report.md
    echo '```' >> tests/reports/test-report.md
    grep "FAILED.*- .*Error:" tests/reports/test-output.txt | sort | uniq -c | \
        sed 's/^[ ]*//' >> tests/reports/test-report.md || true
    echo '```' >> tests/reports/test-report.md
else
    echo "✅ No test failures found." >> tests/reports/test-report.md
fi

# Add the latest strategy analysis
echo -e "\n## Strategy Analysis" >> tests/reports/test-report.md
if [ -f tests/strategy_logs/latest_summary.md ]; then
    # Skip the header from latest_summary.md (first 2 lines) to avoid duplication
    tail -n +3 tests/strategy_logs/latest_summary.md >> tests/reports/test-report.md
else
    echo "No strategy analysis available." >> tests/reports/test-report.md
fi

chmod +x tests/analyze_strategy.sh
chmod +x .git/hooks/pre-push

echo "Test report generated. View full report in tests/reports/test-report.md"

# Exit with test timeout status if needed
if [ $TEST_EXIT_CODE -eq 124 ]; then
    echo "Warning: Test execution timed out after 300 seconds. Results may be incomplete."
fi

# Exit with the test suite's exit code
exit $TEST_EXIT_CODE