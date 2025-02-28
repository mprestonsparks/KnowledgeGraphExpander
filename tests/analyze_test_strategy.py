import sys
import os
import json
import re
from datetime import datetime
from typing import Dict, List, Set
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
            "http": r"status.*500|HTTPError"
        }

    def analyze_logs(self) -> dict:
        """Analyze test logs and generate insights"""
        test_output = self._read_latest_test_output()
        if not test_output:
            return {"error": "No test output found"}

        # Parse failures and errors
        failures = self._parse_failures(test_output)

        # Analyze dependencies
        dependencies = self._analyze_dependencies(failures)

        # Generate recommendations
        recommendations = self._generate_recommendations(failures, dependencies)

        # Create strategy report
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        strategy = {
            "timestamp": timestamp,
            "failures": failures,
            "dependencies": dependencies,
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
                return ""
            with open(test_output_path, 'r') as f:
                return f.read()
        except Exception as e:
            logger.error(f"Error reading test output: {e}")
            return ""

    def _parse_test_section(self, section: str) -> List[dict]:
        """Parse a section of test output"""
        failures = []
        lines = section.split('\n')
        current_test = None
        current_error = []

        for line in lines:
            if "PASSED" in line or not line.strip():
                continue

            if "FAILED" in line:
                if current_test:
                    failures.append({
                        "test": current_test["name"],
                        "error": "\n".join(current_error),
                        "error_type": self._determine_error_type("\n".join(current_error)),
                        "file": current_test["file"]
                    })
                test_match = re.match(r".*FAILED\s+(.+?)::(.+?)\s+", line)
                if test_match:
                    current_test = {
                        "file": test_match.group(1),
                        "name": test_match.group(2)
                    }
                    current_error = []
            elif current_test:
                current_error.append(line.strip())

        if current_test and current_error:
            failures.append({
                "test": current_test["name"],
                "error": "\n".join(current_error),
                "error_type": self._determine_error_type("\n".join(current_error)),
                "file": current_test["file"]
            })

        return failures

    def _parse_failures(self, test_output: str) -> Dict[str, List[dict]]:
        """Parse test failures from output"""
        failures = defaultdict(list)

        # Split output into test module sections
        sections = re.split(r"Running test module: (\w+)", test_output)[1:]
        for i in range(0, len(sections), 2):
            if i + 1 >= len(sections):
                break

            module = sections[i]
            section_content = sections[i + 1]

            # Parse failures for this module
            module_failures = self._parse_test_section(section_content)
            if module_failures:
                failures[module].extend(module_failures)

        return dict(failures)

    def _determine_error_type(self, error: str) -> str:
        """Determine the type of error from the error message"""
        for error_type, pattern in self.error_patterns.items():
            if re.search(pattern, error, re.I):
                return error_type
        return "unknown"

    def _analyze_dependencies(self, failures: Dict[str, List[dict]]) -> Dict[str, Set[str]]:
        """Analyze dependencies between failing tests"""
        dependencies = defaultdict(set)
        dependency_counts = defaultdict(int)

        # Count direct dependencies from error messages
        for module, module_failures in failures.items():
            for failure in module_failures:
                error_text = failure["error"].lower()
                test_name = failure["test"].lower()

                # Check for dependencies in error messages and test names
                for dep_module, pattern in self.dependency_patterns.items():
                    if re.search(pattern, error_text, re.I) or re.search(pattern, test_name, re.I):
                        dependencies[module].add(dep_module)
                        dependency_counts[dep_module] += 1

        # Add implicit dependencies based on error types
        for module, module_failures in failures.items():
            for failure in module_failures:
                error_type = failure["error_type"]

                # Database errors likely affect data-dependent modules
                if error_type == "database":
                    for m in failures.keys():
                        if m != module and m in ["api", "integration"]:
                            dependencies[m].add(module)

                # Import errors suggest module dependencies
                elif error_type == "import":
                    import_match = re.search(r"cannot import.*from ['\"](.+?)['\"]", failure["error"])
                    if import_match:
                        imported_module = import_match.group(1)
                        for pattern, dep_module in self.dependency_patterns.items():
                            if re.search(pattern, imported_module, re.I):
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
            # Import errors suggest missing dependencies
            if error_counts["import"] > 0:
                recommendations.append(f"Fix import issues in {module} module - check package installation and import paths")

            # Attribute errors suggest interface mismatches
            if error_counts["attribute"] > 0:
                recommendations.append(f"Review class interfaces in {module} module - ensure methods are implemented correctly")

            # Type errors suggest data validation issues
            if error_counts["type"] > 0:
                recommendations.append(f"Fix type mismatches in {module} module - verify function signatures and parameters")

            # Async errors suggest coroutine handling issues
            if error_counts["async"] > 0:
                recommendations.append(f"Fix async/await usage in {module} module - ensure proper coroutine handling")

            # HTTP 500 errors suggest server-side issues
            if error_counts["http"] > 0:
                recommendations.append(f"Investigate server errors in {module} module - add error handling and logging")

        # Add dependency-based recommendations
        for module, deps in dependencies.items():
            if len(deps) >= 2:
                recommendations.append(f"High coupling detected in {module} - depends on {', '.join(deps)}. Consider reducing dependencies")
            elif deps:
                recommendations.append(f"Address {module} dependencies on: {', '.join(deps)}")

        # Sort recommendations by priority (longer recommendations typically contain more detail)
        return sorted(recommendations, key=lambda x: len(x), reverse=True)

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
                if error_type in ["import", "database"]:
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
            for module, failures in strategy["failures"].items():
                f.write(f"\n### {module.title()} Module\n")
                error_types = defaultdict(int)
                for failure in failures:
                    error_types[failure["error_type"]] += 1
                for error_type, count in error_types.items():
                    f.write(f"- {count} {error_type} errors\n")

            f.write("\n## Recommendations\n")
            for rec in strategy["recommendations"]:
                f.write(f"- {rec}\n")

            f.write("\n## Fix Priority Order\n")
            for i, module in enumerate(strategy["priority_order"], 1):
                f.write(f"{i}. {module}\n")

if __name__ == "__main__":
    analyzer = TestAnalyzer()
    result = analyzer.analyze_logs()
    print(json.dumps(result, indent=2))