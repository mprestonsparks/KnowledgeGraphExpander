#!/bin/bash

# Create reports directory if it doesn't exist
mkdir -p tests/reports

# Run tests and capture full output
python -m pytest tests/ -v 2>&1 | tee tests/reports/test-output.txt

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

# Update the main test report with categorized issues
cat > tests/reports/test-report.md << 'EOL'
# Test Report Summary

## Core System Tests
- Database Connection Tests
- Graph Structure Tests
- API Integration Tests

## Graph Analysis Tests
- Node/Edge Operations
- Clustering Analysis
- Semantic Processing

## Test Execution Metrics
$(grep "Test Files" tests/reports/test-output.txt)

## Critical Issues
$(grep "FAIL" tests/reports/test-output.txt)

## Next Steps
1. Address any database connection issues
2. Fix semantic analysis failures
3. Resolve API integration errors
EOL