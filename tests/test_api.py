import pytest
from fastapi.testclient import TestClient
import logging
from server.app import app
from server.database import init_db

# Configure logging for tests
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@pytest.fixture(scope="function")
async def test_client(test_app):
    """Create a test client with initialized database."""
    with TestClient(test_app) as client:
        yield client

def test_health_check(test_client):
    """Test the health check endpoint."""
    try:
        response = test_client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}
        logger.info("Health check test passed")
    except Exception as e:
        logger.error(f"Health check test failed: {str(e)}", exc_info=True)
        raise

def test_root_endpoint(test_client):
    """Test the root endpoint."""
    try:
        response = test_client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "version" in data
        assert "endpoints" in data
        logger.info("Root endpoint test passed")
    except Exception as e:
        logger.error(f"Root endpoint test failed: {str(e)}", exc_info=True)
        raise

@pytest.mark.asyncio
async def test_get_graph_data(test_client):
    """Test the graph data retrieval endpoint."""
    try:
        response = test_client.get("/api/graph")
        assert response.status_code == 200
        data = response.json()
        assert "nodes" in data
        assert "edges" in data
        assert "metrics" in data
        logger.info("Graph data retrieval test passed")
    except Exception as e:
        logger.error(f"Graph data retrieval test failed: {str(e)}", exc_info=True)
        raise

@pytest.mark.asyncio
async def test_expand_graph(test_client):
    """Test the graph expansion endpoint."""
    try:
        test_data = {
            "prompt": "Test expansion prompt",
            "maxIterations": 2
        }
        response = test_client.post("/api/graph/expand", json=test_data)
        assert response.status_code == 200
        data = response.json()
        assert "nodes" in data
        assert "edges" in data
        assert isinstance(data["nodes"], list)
        assert isinstance(data["edges"], list)
        logger.info("Graph expansion test passed")
    except Exception as e:
        logger.error(f"Graph expansion test failed: {str(e)}", exc_info=True)
        raise

@pytest.mark.asyncio
async def test_analyze_content(test_client):
    """Test the content analysis endpoint with comprehensive error handling."""
    try:
        # Test case 1: Valid text-only content
        test_content = {
            "text": "Test content for analysis",
            "images": []
        }
        response = test_client.post("/api/graph/analyze", json=test_content)
        assert response.status_code == 200, f"Failed with status {response.status_code}: {response.text}"
        data = response.json()
        assert "nodes" in data
        assert "edges" in data
        assert isinstance(data["nodes"], list)
        assert isinstance(data["edges"], list)
        logger.info("Basic content analysis test passed")

        # Test case 2: Empty content
        empty_content = {
            "text": "",
            "images": []
        }
        response = test_client.post("/api/graph/analyze", json=empty_content)
        assert response.status_code == 400
        assert "error" in response.json()
        logger.info("Empty content validation test passed")

        # Test case 3: Invalid content format
        invalid_content = {
            "invalid_field": "test"
        }
        response = test_client.post("/api/graph/analyze", json=invalid_content)
        assert response.status_code == 422  # FastAPI validation error
        logger.info("Invalid content format test passed")

        # Test case 4: Large text content
        large_content = {
            "text": "A" * 10000,  # Test with 10KB of text
            "images": []
        }
        response = test_client.post("/api/graph/analyze", json=large_content)
        assert response.status_code == 200
        assert "nodes" in response.json()
        logger.info("Large content test passed")

        logger.info("Content analysis endpoint test passed")
    except Exception as e:
        logger.error(f"Content analysis endpoint test failed: {str(e)}", exc_info=True)
        raise

@pytest.mark.asyncio
async def test_reapply_clustering(test_client):
    """Test the clustering reapplication endpoint."""
    try:
        response = test_client.post("/api/graph/cluster")
        assert response.status_code == 200
        data = response.json()
        assert "nodes" in data
        assert "edges" in data
        assert "clusters" in data
        assert isinstance(data["clusters"], list)
        logger.info("Clustering reapplication test passed")
    except Exception as e:
        logger.error(f"Clustering reapplication test failed: {str(e)}", exc_info=True)
        raise

def test_error_handling(test_client):
    """Test API error handling."""
    try:
        # Test invalid expansion request
        invalid_data = {"invalid": "data"}
        response = test_client.post("/api/graph/expand", json=invalid_data)
        assert response.status_code == 422  # FastAPI validation error

        # Test non-existent endpoint
        response = test_client.get("/api/nonexistent")
        assert response.status_code == 404

        # Test invalid HTTP method
        response = test_client.delete("/api/graph/analyze")
        assert response.status_code == 405  # Method not allowed

        logger.info("Error handling test passed")
    except Exception as e:
        logger.error(f"Error handling test failed: {str(e)}", exc_info=True)
        raise