"""Test runner script for AI agent workflow integration."""
import subprocess
import json
import sys
from pathlib import Path
from typing import Dict, List, Optional
import time
import logging
#from watchdog.observers import Observer
#from watchdog.events import FileSystemEventHandler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AITestRunner:
    def __init__(self):
        self.reports_dir = Path("tests/reports")
        self.strategy_logs_dir = Path("tests/strategy_logs")

    def run_tests_after_change(self, changed_files: List[str]) -> Dict:
        """Run tests and analysis after files have been changed."""
        try:
            # Run the test suite
            subprocess.run(["bash", "tests/run_tests.sh"], check=True)

            # Get the latest strategy analysis
            latest_strategy = sorted(self.strategy_logs_dir.glob("strategy_*.json"))[-1]
            with open(latest_strategy) as f:
                strategy_data = json.load(f)

            # Get the test report summary
            with open(self.reports_dir / "test-report.md") as f:
                report_summary = f.read()

            return {
                "success": True,
                "strategy": strategy_data,
                "report": report_summary,
                "changed_files": changed_files
            }
        except subprocess.CalledProcessError as e:
            return {
                "success": False,
                "error": f"Test execution failed: {str(e)}",
                "changed_files": changed_files
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Error running tests: {str(e)}",
                "changed_files": changed_files
            }

    def parse_results(self, results: Dict) -> str:
        """Parse test results into a formatted summary."""
        if not results["success"]:
            return f"❌ Test run failed: {results['error']}\nChanged files: {', '.join(results['changed_files'])}"

        strategy = results["strategy"]
        summary = ["📊 Test Analysis Summary"]
        summary.append("=" * 50)

        # Add changed files
        summary.append("\n📝 Changed Files:")
        for file in results["changed_files"]:
            summary.append(f"  - {file}")

        # Add failure summary if any
        if strategy["failures"]:
            summary.append("\n❌ Test Failures:")
            for module, failures in strategy["failures"].items():
                summary.append(f"\n  {module}:")
                for failure in failures:
                    summary.append(f"    - {failure['test']}: {failure['error_type']}")
        else:
            summary.append("\n✅ All tests passed!")

        # Add recommendations
        if strategy["recommendations"]:
            summary.append("\n💡 Recommendations:")
            for rec in strategy["recommendations"]:
                summary.append(f"  - {rec}")

        return "\n".join(summary)

def run_tests_for_changes(changed_files: List[str] = None):
    """Run tests for the specified changed files or all tests if none specified."""
    if not changed_files:
        changed_files = []

    runner = AITestRunner()
    results = runner.run_tests_after_change(changed_files)
    print(runner.parse_results(results))
    return results

if __name__ == "__main__":
    # Accept changed files as command-line arguments
    changed_files = sys.argv[1:] if len(sys.argv) > 1 else []
    run_tests_for_changes(changed_files)