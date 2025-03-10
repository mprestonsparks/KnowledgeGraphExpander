# Knowledge Graph Expander Test Suite

This directory contains the comprehensive test suite for the Knowledge Graph Expander system.

## Overview

The test suite covers both backend and frontend components, ensuring that all key features of the system work correctly, including:

- Graph management and operations
- Multi-agent reasoning system
- Temporal evolution tracking
- Feedback loop mechanism
- API endpoints
- Frontend components

## Test Categories

### Unit Tests

Individual component testing focusing on:
- Graph operations
- Node and edge management
- Clustering algorithms
- Utility functions

### Integration Tests

Testing component interactions:
- API endpoints with database operations
- Multi-agent system with graph manager
- Frontend components with API

### System Tests

End-to-end testing of complete workflows:
- Content analysis and graph extraction
- Graph expansion via multi-agent reasoning
- Evolution tracking and feedback loops

### Performance Tests

Evaluating system under load:
- Large graph handling
- Concurrent operations
- API response times

## Test Files

- **test_api.py**: Tests all RESTful API endpoints
- **test_database.py**: Tests database operations and schema
- **test_graph.py**: Tests graph operations and algorithms
- **test_semantic_api.py**: Tests content analysis and semantic processing
- **test_integration.py**: Tests component interactions
- **test_connection_state_tracking.py**: Tests WebSocket connections
- **test_event_loop.py**: Tests async event handling
- Frontend tests in `src/components/__tests__/`

## Test Runner

The test suite uses pytest for Python tests and Jest for JavaScript tests.

### Running Backend Tests

```bash
# Run all tests
pytest

# Run specific test category
pytest test_api.py

# Run with verbose output
pytest -v

# Run with coverage report
pytest --cov=server
```

### Running Frontend Tests

```bash
# Navigate to frontend directory
cd frontend

# Run all tests
npm test

# Run specific test file
npm test -- GraphViewer.test.tsx

# Run with coverage
npm test -- --coverage
```

## CI/CD Integration

The test suite is integrated with CI/CD workflows:

1. Tests run automatically on pull requests
2. Coverage reports are generated
3. Performance benchmarks are tracked
4. Test results are reported on the PR

## Test Data

The `tests/` directory includes:
- Fixture data for tests
- Mock API responses
- Sample knowledge graphs
- Performance benchmarking tools

## Test Strategy

Our testing follows a pyramid approach:
- Many unit tests for core components
- Fewer but comprehensive integration tests
- Selected end-to-end tests for critical paths
- Regular performance benchmarking

## Adding New Tests

When adding a new feature:
1. Add unit tests for the component
2. Update integration tests if needed
3. Add an end-to-end test for critical functionality
4. Run the full test suite to ensure no regressions

## Test Reporting

Test results are aggregated in:
- `tests/reports/` - Generated test reports
- `tests/strategy_logs/` - Test strategy analysis