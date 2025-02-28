#!/bin/bash

# Test orchestration script
ROOT_DIR="$(pwd)"
LOG_DIR="${ROOT_DIR}/tests/logs"
DATE_TAG=$(date +%Y%m%d_%H%M%S)

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to run a test module and log results
run_test_module() {
    local module_name=$1
    local log_file="${LOG_DIR}/${module_name}_${DATE_TAG}.log"
    
    echo "Running test module: ${module_name}"
    echo "Test started at: $(date)" > "$log_file"
    echo "----------------------------------------" >> "$log_file"
    
    case $module_name in
        "database")
            python -m pytest tests/test_database.py -v >> "$log_file" 2>&1
            ;;
        "graph")
            python -m pytest tests/test_graph.py -v >> "$log_file" 2>&1
            ;;
        "api")
            python -m pytest tests/test_api.py -v >> "$log_file" 2>&1
            ;;
        "integration")
            python -m pytest tests/test_integration.py -v >> "$log_file" 2>&1
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
    
    # Generate summary
    echo "Summary:" >> "$log_file"
    if [ $test_status -eq 0 ]; then
        echo "✅ All tests passed" >> "$log_file"
    else
        echo "❌ Some tests failed" >> "$log_file"
        grep -B 1 "FAILED" "$log_file" | grep -v "^--$" >> "$log_file"
    fi
    
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
    local test_modules=("database" "graph" "api" "integration")
    local failed_modules=()
    
    for module in "${test_modules[@]}"; do
        # Read previous summary before running new tests
        read_previous_summary "$module"
        echo "----------------------------------------"
        
        if run_test_module "$module"; then
            echo "✅ ${module} tests completed successfully"
        else
            echo "❌ ${module} tests failed"
            failed_modules+=("$module")
        fi
        echo "----------------------------------------"
    done
    
    # Final summary
    echo "Test Run Complete at $(date)"
    if [ ${#failed_modules[@]} -eq 0 ]; then
        echo "All test modules passed successfully! 🎉"
    else
        echo "The following modules had failures: ${failed_modules[*]} ❌"
        exit 1
    fi
}

# Execute main function
main "$@"
