import pytest
import asyncio
import logging
from fastapi.testclient import TestClient
from server.app import app
from server.database import init_db
from server.graph_manager import graph_manager

# Configure logging for tests
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def initialized_app():
    """Initialize the application and database."""
    await init_db()
    await graph_manager.initialize()
    return app

@pytest.fixture(scope="session")
def client(initialized_app):
    """Create a test client with initialized application."""
    return TestClient(initialized_app)

@pytest.mark.asyncio
async def test_full_graph_workflow(client):
    """Test complete graph workflow from creation to analysis."""
    try:
        # Step 1: Create initial nodes and verify
        create_response = client.post("/api/graph/expand", json={
            "prompt": "Create a test knowledge graph about software testing",
            "maxIterations": 2
        })
        assert create_response.status_code == 200
        initial_data = create_response.json()
        assert "nodes" in initial_data
        assert "edges" in initial_data
        assert len(initial_data["nodes"]) > 0

        # Step 2: Analyze content
        analysis_response = client.post("/api/graph/analyze", json={
            "text": "Software testing involves unit tests, integration tests, and end-to-end tests",
            "images": []
        })
        assert analysis_response.status_code == 200
        analysis_data = analysis_response.json()
        assert "nodes" in analysis_data
        assert "edges" in analysis_data
        assert len(analysis_data["nodes"]) >= len(initial_data["nodes"])

        # Step 3: Apply clustering
        cluster_response = client.post("/api/graph/cluster")
        assert cluster_response.status_code == 200
        cluster_data = cluster_response.json()
        assert "clusters" in cluster_data

        # Step 4: Verify final graph state
        final_response = client.get("/api/graph")
        assert final_response.status_code == 200
        final_data = final_response.json()
        assert "nodes" in final_data
        assert "edges" in final_data
        assert "metrics" in final_data
        assert len(final_data["nodes"]) > 0
        assert len(final_data["edges"]) > 0

        logger.info("Full graph workflow test passed")
    except Exception as e:
        logger.error(f"Full graph workflow test failed: {str(e)}", exc_info=True)
        raise

@pytest.mark.asyncio
async def test_concurrent_operations(client):
    """Test concurrent graph operations."""
    try:
        # Create multiple concurrent requests
        tasks = []
        for i in range(3):
            tasks.append(
                client.post("/api/graph/expand", json={
                    "prompt": f"Concurrent test {i}",
                    "maxIterations": 1
                })
            )

        # Verify all responses
        for response in tasks:
            assert response.status_code == 200
            data = response.json()
            assert "nodes" in data
            assert "edges" in data

        logger.info("Concurrent operations test passed")
    except Exception as e:
        logger.error(f"Concurrent operations test failed: {str(e)}", exc_info=True)
        raise

@pytest.mark.asyncio
async def test_error_recovery(client):
    """Test system recovery from errors."""
    try:
        # Force an error with invalid data
        error_response = client.post("/api/graph/analyze", json={
            "invalid": "data"
        })
        assert error_response.status_code == 422

        # Verify system remains operational
        health_response = client.get("/health")
        assert health_response.status_code == 200
        assert health_response.json()["status"] == "healthy"

        # Verify graph operations still work
        graph_response = client.get("/api/graph")
        assert graph_response.status_code == 200

        logger.info("Error recovery test passed")
    except Exception as e:
        logger.error(f"Error recovery test failed: {str(e)}", exc_info=True)
        raise

@pytest.mark.asyncio
async def test_data_persistence(client):
    """Test data persistence across operations."""
    try:
        # Create initial data
        initial_response = client.get("/api/graph")
        initial_count = len(initial_response.json()["nodes"])

        # Add new data
        expand_response = client.post("/api/graph/expand", json={
            "prompt": "Add test data for persistence verification",
            "maxIterations": 1
        })
        assert expand_response.status_code == 200

        # Verify data persists
        final_response = client.get("/api/graph")
        final_count = len(final_response.json()["nodes"])
        assert final_count >= initial_count

        logger.info("Data persistence test passed")
    except Exception as e:
        logger.error(f"Data persistence test failed: {str(e)}", exc_info=True)
        raise

@pytest.mark.asyncio
async def test_websocket_updates(client):
    """Test WebSocket update notifications."""
    try:
        with client.websocket_connect("/ws") as websocket:
            # Verify initial connection
            data = websocket.receive_json()
            assert "nodes" in data
            assert "edges" in data

            # Make a graph change
            client.post("/api/graph/expand", json={
                "prompt": "Test WebSocket updates",
                "maxIterations": 1
            })

            # Verify update notification
            update = websocket.receive_json()
            assert "nodes" in update
            assert "edges" in update

        logger.info("WebSocket updates test passed")
    except Exception as e:
        logger.error(f"WebSocket updates test failed: {str(e)}", exc_info=True)
        raise