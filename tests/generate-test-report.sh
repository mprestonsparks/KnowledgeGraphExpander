#!/bin/bash

# Create reports directory if it doesn't exist
mkdir -p tests/reports

# Run tests and capture full output
npx vitest run 2>&1 | tee tests/reports/test-output.txt

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

## Core Infrastructure Tests
- Database Connectivity Tests
- WebSocket Implementation Tests
- Graph Data Structure Tests

## Integration Tests
- React Component Tests
- Cytoscape Integration Tests

## UI/UX Tests
- Layout and Styling Tests
- User Interaction Tests

## Test Execution Metrics
$(grep "Test Files" tests/reports/test-output.txt)

## Critical Issues
$(grep "FAIL" tests/reports/test-output.txt)

## Next Steps
1. Address database connection handling in test environment
2. Fix WebSocket event simulation in tests
3. Resolve UI component test configuration
EOL
