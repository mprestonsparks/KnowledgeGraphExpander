from typing import Dict, List, Set
import json
import re
import os
from datetime import datetime
from collections import defaultdict
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TestAnalyzer:
    def __init__(self):
        self.test_logs_dir = "tests/reports"
        self.strategy_logs_dir = "tests/strategy_logs"
        self.dependency_patterns = {
            "database": r"database|db|sql|storage",
            "graph": r"graph|node|edge|cluster",
            "api": r"api|endpoint|route|request",
            "semantic": r"semantic|analyze|content|cluster",
            "integration": r"integration|workflow|end-to-end"
        }
        self.error_patterns = {
            "import": r"ImportError|ModuleNotFoundError",
            "attribute": r"AttributeError",
            "type": r"TypeError",
            "async": r"coroutine|awaitable",
            "database": r"DatabaseError|OperationalError",
            "value": r"ValueError",
            "key": r"KeyError",
            "assertion": r"AssertionError",
            "http": r"status.*500|HTTPError",
            "timeout": r"Test execution timed out|⚠️ Tests timed out"
        }

    def _determine_error_type(self, error: str) -> str:
        """Determine the type of error from the error message"""
        if not error:
            return "unknown"

        for error_type, pattern in self.error_patterns.items():
            if re.search(pattern, error, re.I):
                logger.debug(f"Matched error type {error_type} for: {error[:100]}...")
                return error_type
        return "unknown"

    def _get_module_from_path(self, file_path: str) -> str:
        """Extract module name from file path"""
        if not file_path:
            return "unknown"

        base = os.path.basename(file_path)
        if base.startswith("test_"):
            base = base[5:]  # Remove 'test_' prefix
        if base.endswith(".py"):
            base = base[:-3]  # Remove '.py' extension

        module_map = {
            "api": "api",
            "graph": "graph",
            "database": "database",
            "integration": "integration"
        }
        return module_map.get(base, base)

    def _parse_failures(self, test_output: str) -> Dict[str, List[dict]]:
        """Parse failures by module"""
        failures = defaultdict(list)
        current_module = None
        in_progress = True
        in_summary = False
        error_details = {}

        logger.info("Starting test output parsing")

        # First pass: collect error details from summary section
        for line in test_output.split('\n'):
            line = line.strip()
            if not line:
                continue

            if "=== short test summary info ===" in line:
                in_progress = False
                in_summary = True
                continue

            if in_summary and "FAILED" in line:
                summary_match = re.match(r"FAILED\s+(.+?)::(.+?)\s+-\s+(.+)", line)
                if summary_match:
                    file_path, test_name, error_msg = summary_match.groups()
                    key = f"{file_path}::{test_name}"
                    error_details[key] = error_msg
                    logger.debug(f"Found error details for {key}: {error_msg}")

        # Reset for second pass
        in_progress = True
        in_summary = False

        # Second pass: collect failures from progress section
        for line in test_output.split('\n'):
            line = line.strip()
            if not line:
                continue

            if "Running test module:" in line:
                current_module = line.split("Running test module:")[1].strip()
                logger.info(f"Found test module section: {current_module}")
                continue

            if "⚠️ Tests timed out" in line and current_module:
                failures[current_module].append({
                    "test": "module_timeout",
                    "error": "Test execution timed out",
                    "error_type": "timeout",
                    "file": f"tests/test_{current_module}.py"
                })
                logger.info(f"Recorded timeout for module: {current_module}")
                continue

            if current_module and "FAILED" in line and "::" in line:
                progress_match = re.match(r"(.+?)::(.+?)\s+FAILED\s*.*?(\[\s*\d+%\])?", line)
                if progress_match:
                    file_path, test_name = progress_match.groups()[:2]
                    key = f"{file_path}::{test_name}"
                    error_msg = error_details.get(key, "Test failed")
                    error_type = self._determine_error_type(error_msg)

                    failure = {
                        "test": test_name,
                        "file": file_path,
                        "error": error_msg,
                        "error_type": error_type
                    }
                    failures[current_module].append(failure)
                    logger.info(f"Found failure in {current_module}: {test_name} ({error_type})")

        # Log the final results
        logger.info(f"Found failures in modules: {list(failures.keys())}")
        for module, module_failures in failures.items():
            logger.info(f"Module {module}: {len(module_failures)} failures")

        return dict(failures)

    def _analyze_dependencies(self, failures: Dict[str, List[dict]]) -> Dict[str, Set[str]]:
        """Analyze dependencies between failing tests"""
        dependencies = defaultdict(set)

        # Count direct dependencies from error messages
        for module, module_failures in failures.items():
            for failure in module_failures:
                error_text = failure["error"].lower()
                test_name = failure["test"].lower()

                # Check for dependencies in error messages and test names
                for dep_module, pattern in self.dependency_patterns.items():
                    if re.search(pattern, error_text, re.I) or re.search(pattern, test_name, re.I):
                        if dep_module != module:  # Don't count self-dependencies
                            dependencies[module].add(dep_module)

        return dict(dependencies)

    def _generate_recommendations(self, failures: Dict[str, List[dict]], dependencies: Dict[str, Set[str]]) -> List[str]:
        """Generate recommendations based on analysis"""
        recommendations = []

        # Track error patterns per module
        module_patterns = defaultdict(lambda: defaultdict(int))
        for module, module_failures in failures.items():
            for failure in module_failures:
                module_patterns[module][failure["error_type"]] += 1

        # Generate specific recommendations based on error patterns
        for module, error_counts in module_patterns.items():
            # Handle timeouts first
            if error_counts["timeout"] > 0:
                recommendations.append(f"⚠️ {module} module tests are timing out - consider optimizing or splitting the test suite")

            # Handle other common error types
            if error_counts["import"] > 0:
                recommendations.append(f"Fix import issues in {module} module - check package installation and import paths")

            if error_counts["attribute"] > 0:
                recommendations.append(f"Review class interfaces in {module} module - ensure methods are implemented correctly")

            if error_counts["type"] > 0:
                recommendations.append(f"Fix type mismatches in {module} module - verify function signatures and parameters")

            if error_counts["async"] > 0:
                recommendations.append(f"Fix async/await usage in {module} module - ensure proper coroutine handling")

            if error_counts["http"] > 0:
                recommendations.append(f"Investigate server errors in {module} module - add error handling and logging")

            # Add failure count context
            total_failures = sum(error_counts.values())
            if total_failures > 3:
                recommendations.append(f"High failure rate in {module} module ({total_failures} failures) - consider focused debugging session")

        # Add dependency-based recommendations
        for module, deps in dependencies.items():
            if len(deps) >= 2:
                recommendations.append(f"High coupling detected in {module} - depends on {', '.join(deps)}. Consider reducing dependencies")
            elif deps:
                recommendations.append(f"Address {module} dependencies on: {', '.join(deps)}")

        # Sort recommendations by priority (critical issues first)
        return sorted(recommendations, key=lambda x: "⚠️" in x, reverse=True)

    def _determine_fix_order(self, failures: Dict[str, List[dict]], dependencies: Dict[str, Set[str]]) -> List[str]:
        """Determine optimal order for fixing issues"""
        priority_scores = defaultdict(float)

        for module in failures.keys():
            # Base score from number of other modules depending on this module
            dependent_modules = sum(1 for deps in dependencies.values() if module in deps)
            priority_scores[module] = dependent_modules * 2.0

            # Add score based on error types
            for failure in failures[module]:
                error_type = failure["error_type"]
                if error_type in ["import", "database", "timeout"]:  # Added timeout as critical
                    priority_scores[module] += 1.5  # Critical errors
                elif error_type in ["attribute", "type", "async"]:
                    priority_scores[module] += 1.0  # Major errors
                else:
                    priority_scores[module] += 0.5  # Minor errors

            # Bonus score for modules with many failures
            failure_count = len(failures[module])
            priority_scores[module] += min(failure_count * 0.5, 2.0)

        # Sort modules by priority score (higher scores first)
        modules = list(failures.keys())
        modules.sort(key=lambda m: (-priority_scores[m], m))

        return modules

    def analyze_logs(self) -> dict:
        """Analyze test logs and generate insights"""
        test_output = self._read_latest_test_output()
        if not test_output:
            return {"error": "No test output found"}

        # Parse failures and errors
        failures = self._parse_failures(test_output)
        logger.info(f"Parsed failures for modules: {list(failures.keys())}")

        # Analyze dependencies
        dependencies = self._analyze_dependencies(failures)
        logger.info(f"Analyzed dependencies between modules: {dependencies}")

        # Generate recommendations
        recommendations = self._generate_recommendations(failures, dependencies)

        # Convert dependencies sets to lists for JSON serialization
        serializable_dependencies = {
            module: list(deps) for module, deps in dependencies.items()
        }

        # Create strategy report
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        strategy = {
            "timestamp": timestamp,
            "failures": failures,
            "dependencies": serializable_dependencies,
            "recommendations": recommendations,
            "priority_order": self._determine_fix_order(failures, dependencies)
        }

        # Save strategy to file
        self._save_strategy_log(strategy)

        return strategy

    def _read_latest_test_output(self) -> str:
        """Read the most recent test output file"""
        try:
            test_output_path = os.path.join(self.test_logs_dir, "test-output.txt")
            if not os.path.exists(test_output_path):
                logger.error("Test output file not found")
                return ""

            with open(test_output_path, 'r') as f:
                content = f.read()
                logger.info(f"Read {len(content)} bytes from test output")
                if not content.strip():
                    logger.warning("Test output file is empty")
                return content
        except Exception as e:
            logger.error(f"Error reading test output: {e}", exc_info=True)
            return ""

    def _save_strategy_log(self, strategy: dict) -> None:
        """Save strategy analysis to log file"""
        if not os.path.exists(self.strategy_logs_dir):
            os.makedirs(self.strategy_logs_dir)

        # Save detailed JSON log
        log_file = os.path.join(
            self.strategy_logs_dir,
            f"strategy_{strategy['timestamp']}.json"
        )

        with open(log_file, 'w') as f:
            json.dump(strategy, f, indent=2)
            logger.info(f"Strategy log saved to {log_file}")

        # Create latest_summary.md with the most important information
        summary_file = os.path.join(self.strategy_logs_dir, "latest_summary.md")
        with open(summary_file, 'w') as f:
            f.write(f"# Test Strategy Analysis\n")
            f.write(f"Generated at: {datetime.now().strftime('%c')}\n\n")

            f.write("## Critical Issues\n")
            for module, module_failures in strategy["failures"].items():
                error_types = defaultdict(int)
                severity_count = {"high": 0, "medium": 0, "low": 0}

                for failure in module_failures:
                    error_type = failure["error_type"]
                    error_types[error_type] += 1

                    # Determine severity
                    if error_type in ["timeout", "import", "database"]:
                        severity_count["high"] += 1
                    elif error_type in ["attribute", "type", "async"]:
                        severity_count["medium"] += 1
                    else:
                        severity_count["low"] += 1

                f.write(f"\n### {module.title()} Module\n")
                f.write("#### Error Distribution\n")
                for error_type, count in error_types.items():
                    f.write(f"- {count} {error_type} errors\n")

                f.write("\n#### Severity Analysis\n")
                if severity_count["high"] > 0:
                    f.write(f"- ⚠️ **High Impact**: {severity_count['high']} critical errors\n")
                if severity_count["medium"] > 0:
                    f.write(f"- ⚡ **Medium Impact**: {severity_count['medium']} significant errors\n")
                if severity_count["low"] > 0:
                    f.write(f"- 📝 **Low Impact**: {severity_count['low']} minor errors\n")

                # Add dependency info if available
                if module in strategy["dependencies"] and strategy["dependencies"][module]:
                    f.write("\n#### Dependencies\n")
                    f.write(f"- Module depends on: {', '.join(strategy['dependencies'][module])}\n")

            f.write("\n## Recommendations\n")
            for rec in strategy["recommendations"]:
                f.write(f"- {rec}\n")

            f.write("\n## Fix Priority Order\n")
            for i, module in enumerate(strategy["priority_order"], 1):
                f.write(f"{i}. {module}\n")

            f.write("\n## Detailed Failure Analysis\n")
            for module, module_failures in strategy["failures"].items():
                f.write(f"\n### {module.title()} Module\n")
                for failure in module_failures:
                    test_name = failure["test"]
                    error = failure["error"]
                    error_type = failure["error_type"]

                    # Add severity indicator
                    severity = "⚠️" if error_type in ["timeout", "import", "database"] else "⚡" if error_type in ["attribute", "type", "async"] else "📝"

                    f.write(f"\n#### {test_name} {severity}\n")
                    f.write(f"- **Error Type**: {error_type}\n")
                    f.write(f"- **Details**: {error}\n")

                    # Add specific suggestions based on error type
                    if error_type == "attribute":
                        f.write("- **Suggestion**: Verify the method exists and is properly defined in the class\n")
                        f.write("- **Fix Complexity**: Medium - Requires implementation of missing methods\n")
                    elif error_type == "type":
                        f.write("- **Suggestion**: Check async/await usage and ensure proper type handling\n")
                        f.write("- **Fix Complexity**: Medium - Requires proper async/await implementation\n")
                    elif error_type == "import":
                        f.write("- **Suggestion**: Verify import paths and ensure dependencies are installed\n")
                        f.write("- **Fix Complexity**: Low - Update imports or install missing packages\n")
                    elif error_type == "async":
                        f.write("- **Suggestion**: Ensure proper async/await pattern usage in coroutines\n")
                        f.write("- **Fix Complexity**: Medium - Requires async/await pattern fixes\n")
                    elif error_type == "timeout":
                        f.write("- **Suggestion**: Optimize test execution or split into smaller suites\n")
                        f.write("- **Fix Complexity**: High - May require significant refactoring\n")
                    elif error_type == "database":
                        f.write("- **Suggestion**: Check database connection and query execution\n")
                        f.write("- **Fix Complexity**: High - Database issues may affect multiple components\n")

                    if strategy["dependencies"].get(module):
                        f.write(f"- **Related Modules**: {', '.join(strategy['dependencies'][module])}\n")
                    f.write("\n")

if __name__ == "__main__":
    analyzer = TestAnalyzer()
    result = analyzer.analyze_logs()
    print(json.dumps(result, indent=2))