"""Test API endpoints."""
import pytest
import logging
from fastapi.testclient import TestClient

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@pytest.mark.asyncio
async def test_health_check(test_client):
    """Test the health check endpoint."""
    try:
        response = test_client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}
        logger.info("Health check test passed")
    except Exception as e:
        logger.error(f"Health check test failed: {str(e)}", exc_info=True)
        raise

@pytest.mark.asyncio
async def test_root_endpoint(test_client):
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
    """Test the content analysis endpoint."""
    try:
        test_content = {
            "text": "Test content for analysis",
            "images": []
        }
        response = test_client.post("/api/graph/analyze", json=test_content)
        assert response.status_code == 200
        data = response.json()
        assert "nodes" in data
        assert "edges" in data
        logger.info("Content analysis test passed")
    except Exception as e:
        logger.error(f"Content analysis test failed: {str(e)}", exc_info=True)
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
        logger.info("Clustering reapplication test passed")
    except Exception as e:
        logger.error(f"Clustering reapplication test failed: {str(e)}", exc_info=True)
        raise

@pytest.mark.asyncio
async def test_error_handling(test_client):
    """Test API error handling."""
    try:
        # Test invalid expansion request
        invalid_data = {"invalid": "data"}
        response = test_client.post("/api/graph/expand", json=invalid_data)
        assert response.status_code == 422

        # Test non-existent endpoint
        response = test_client.get("/api/nonexistent")
        assert response.status_code == 404

        # Test invalid HTTP method
        response = test_client.delete("/api/graph/analyze")
        assert response.status_code == 405

        logger.info("Error handling test passed")
    except Exception as e:
        logger.error(f"Error handling test failed: {str(e)}", exc_info=True)
        raise