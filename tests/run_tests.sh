#!/bin/bash

# Create reports directory if it doesn't exist
mkdir -p tests/reports
mkdir -p tests/logs

# Test orchestration script
ROOT_DIR="$(pwd)"
LOG_DIR="${ROOT_DIR}/tests/logs"
DATE_TAG=$(date +%Y%m%d_%H%M%S)

# Function to run a test module and log results
run_test_module() {
    local module_name=$1
    local log_file="${LOG_DIR}/${module_name}_${DATE_TAG}.log"

    echo "Running test module: ${module_name}"
    echo "Test started at: $(date)" > "$log_file"
    echo "----------------------------------------" >> "$log_file"

    case $module_name in
        "frontend")
            cd frontend && timeout 120 npm run test:coverage >> "$log_file" 2>&1
            ;;
        "database")
            timeout 60 python -m pytest tests/test_database.py -v >> "$log_file" 2>&1
            ;;
        "graph")
            timeout 60 python -m pytest tests/test_graph.py -v >> "$log_file" 2>&1
            ;;
        "api")
            timeout 60 python -m pytest tests/test_api.py -v >> "$log_file" 2>&1
            ;;
        "integration")
            timeout 120 python -m pytest tests/test_integration.py -v >> "$log_file" 2>&1
            ;;
        *)
            echo "Unknown test module: ${module_name}" >> "$log_file"
            return 1
            ;;
    esac

    local test_status=$?
    echo "----------------------------------------" >> "$log_file"
    echo "Test completed at: $(date)" >> "$log_file"
    echo "Test exit status: ${test_status}" >> "$log_file"

    # Generate analysis report
    bash tests/analyze_strategy.sh >> "$log_file"

    return $test_status
}

# Function to read previous test summary
read_previous_summary() {
    local module_name=$1
    local latest_log=$(ls -t "${LOG_DIR}/${module_name}_"*.log 2>/dev/null | head -n 2 | tail -n 1)

    if [ -f "$latest_log" ]; then
        echo "Previous test summary for ${module_name}:"
        sed -n '/Summary:/,$p' "$latest_log"
    else
        echo "No previous test results found for ${module_name}"
    fi
}

# Main test execution
main() {
    local test_modules=("frontend" "database" "graph" "api" "integration")
    local failed_modules=()
    local timeout_modules=()

    # Clear previous test output
    echo "Test Run Started at $(date)" > "${ROOT_DIR}/tests/reports/test-output.txt"
    echo "----------------------------------------" >> "${ROOT_DIR}/tests/reports/test-output.txt"

    for module in "${test_modules[@]}"; do
        # Read previous summary before running new tests
        read_previous_summary "$module"
        echo "----------------------------------------"

        run_test_module "$module"
        local status=$?

        if [ $status -eq 0 ]; then
            echo "✅ ${module} tests completed successfully"
        elif [ $status -eq 124 ]; then
            echo "⚠️ ${module} tests timed out"
            timeout_modules+=("$module")
        else
            echo "❌ ${module} tests failed"
            failed_modules+=("$module")
        fi
        echo "----------------------------------------"
    done

    # Generate final report with analysis
    bash tests/generate-test-report.sh

    # Final summary
    echo "Test Run Complete at $(date)" >> "${ROOT_DIR}/tests/reports/test-output.txt"
    echo "----------------------------------------" >> "${ROOT_DIR}/tests/reports/test-output.txt"

    if [ ${#failed_modules[@]} -eq 0 ] && [ ${#timeout_modules[@]} -eq 0 ]; then
        echo "All test modules passed successfully! 🎉"
    else
        if [ ${#failed_modules[@]} -gt 0 ]; then
            echo "The following modules had failures: ${failed_modules[*]} ❌"
        fi
        if [ ${#timeout_modules[@]} -gt 0 ]; then
            echo "The following modules timed out: ${timeout_modules[*]} ⚠️"
        fi
        exit 1
    fi
}

# Execute main function
main "$@"