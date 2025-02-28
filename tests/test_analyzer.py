import pytest
from analyze_test_strategy import TestAnalyzer

def test_parse_simple_failure():
    analyzer = TestAnalyzer()
    sample_output = """
Running test module: graph
tests/test_graph.py::test_graph_operations FAILED
=== short test summary info ===
FAILED tests/test_graph.py::test_graph_operations - AttributeError: 'GraphManager' object has no attribute 'expand'
    """
    
    failures = analyzer._parse_failures(sample_output)
    assert 'graph' in failures
    assert len(failures['graph']) == 1
    assert failures['graph'][0]['test'] == 'test_graph_operations'
    assert failures['graph'][0]['error_type'] == 'attribute'

def test_parse_timeout():
    analyzer = TestAnalyzer()
    sample_output = """
Running test module: integration
tests/test_integration.py::test_workflow FAILED
⚠️ Tests timed out
    """
    
    failures = analyzer._parse_failures(sample_output)
    assert 'integration' in failures
    assert failures['integration'][0]['error_type'] == 'timeout'

def test_error_type_determination():
    analyzer = TestAnalyzer()
    error_messages = {
        "ImportError: cannot import name": "import",
        "AttributeError: object has no attribute": "attribute",
        "TypeError: object list can't be used": "type",
        "Test execution timed out": "timeout",
        "status code 500": "http"
    }
    
    for msg, expected_type in error_messages.items():
        assert analyzer._determine_error_type(msg) == expected_type

def test_parse_multiple_modules():
    analyzer = TestAnalyzer()
    sample_output = """
Running test module: graph
tests/test_graph.py::test_operations FAILED
Running test module: api
tests/test_api.py::test_endpoint FAILED
=== short test summary info ===
FAILED tests/test_graph.py::test_operations - TypeError: invalid type
FAILED tests/test_api.py::test_endpoint - status code 500
    """
    
    failures = analyzer._parse_failures(sample_output)
    assert set(failures.keys()) == {'graph', 'api'}
    assert failures['graph'][0]['error_type'] == 'type'
    assert failures['api'][0]['error_type'] == 'http'
