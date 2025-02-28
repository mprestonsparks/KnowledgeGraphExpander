import pytest
from fastapi.testclient import TestClient
import logging
from server.app import app

# Configure logging for tests
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@pytest.fixture(scope="session")
def client():
    """Create a test client."""
    with TestClient(app) as client:
        yield client

def test_health_check(client):
    """Test the health check endpoint."""
    try:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}
        logger.info("Health check test passed")
    except Exception as e:
        logger.error(f"Health check test failed: {str(e)}", exc_info=True)
        raise

def test_root_endpoint(client):
    """Test the root endpoint."""
    try:
        response = client.get("/")
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
async def test_get_graph_data(client):
    """Test the graph data retrieval endpoint."""
    try:
        response = client.get("/api/graph")
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
async def test_expand_graph(client):
    """Test the graph expansion endpoint."""
    try:
        test_data = {
            "prompt": "Test expansion prompt",
            "maxIterations": 2
        }
        response = client.post("/api/graph/expand", json=test_data)
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
async def test_analyze_content(client):
    """Test the content analysis endpoint."""
    try:
        test_content = {
            "text": "Test content for analysis",
            "images": []
        }
        response = client.post("/api/graph/analyze", json=test_content)
        assert response.status_code == 200
        data = response.json()
        assert "nodes" in data
        assert "edges" in data
        assert isinstance(data["nodes"], list)
        assert isinstance(data["edges"], list)
        logger.info("Content analysis endpoint test passed")
    except Exception as e:
        logger.error(f"Content analysis endpoint test failed: {str(e)}", exc_info=True)
        raise

@pytest.mark.asyncio
async def test_reapply_clustering(client):
    """Test the clustering reapplication endpoint."""
    try:
        response = client.post("/api/graph/cluster")
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

def test_error_handling(client):
    """Test API error handling."""
    try:
        # Test invalid expansion request
        invalid_data = {"invalid": "data"}
        response = client.post("/api/graph/expand", json=invalid_data)
        assert response.status_code == 422

        # Test non-existent endpoint
        response = client.get("/api/nonexistent")
        assert response.status_code == 404

        logger.info("Error handling test passed")
    except Exception as e:
        logger.error(f"Error handling test failed: {str(e)}", exc_info=True)
        raise