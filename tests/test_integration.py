import pytest
import asyncio
import logging
from fastapi.testclient import TestClient
from server.app import app
from server.database import init_db, cleanup_pool, get_pool
from server.graph_manager import graph_manager
import contextlib

# Configure logging for tests
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@pytest.fixture(scope="function", autouse=True)
async def setup_test_db():
    """Setup test database and cleanup after each test."""
    await init_db()  # Initialize database tables
    yield
    await cleanup_pool()  # Cleanup after test

@pytest.fixture(scope="function")
async def initialized_app():
    """Initialize the application."""
    await graph_manager.initialize()
    return app

@pytest.fixture(scope="function")
def test_client(initialized_app):
    """Create a test client that properly handles event loops."""
    with TestClient(initialized_app) as client:
        yield client

@pytest.mark.asyncio
async def test_app_startup_shutdown():
    """Test application startup and shutdown sequence."""
    try:
        # Test database connection
        pool = await get_pool()
        async with pool.acquire() as conn:
            result = await conn.fetchval("SELECT 1")
            assert result == 1
            logger.info("Database connection verified")

        logger.info("Application startup successful")
    except Exception as e:
        logger.error(f"Application lifecycle test failed: {e}")
        raise

@pytest.mark.asyncio
async def test_database_schema_integrity():
    """Test database schema setup and integrity."""
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            tables = await conn.fetch("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
            """)
            table_names = [t['table_name'] for t in tables]
            assert 'nodes' in table_names, "Nodes table not found"
            assert 'edges' in table_names, "Edges table not found"

            logger.info("Database schema integrity verified")
    except Exception as e:
        logger.error(f"Schema integrity test failed: {e}")
        raise

def test_full_graph_workflow(test_client):
    """Test basic graph operations."""
    try:
        # Create test data
        response = test_client.post("/api/graph/expand", json={
            "prompt": "Test graph creation",
            "maxIterations": 1
        })
        assert response.status_code == 200
        data = response.json()
        assert "nodes" in data
        assert "edges" in data

        # Verify created data
        get_response = test_client.get("/api/graph")
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert len(get_data["nodes"]) > 0

        logger.info("Graph workflow test passed")
    except Exception as e:
        logger.error(f"Graph workflow test failed: {e}")
        raise

def test_error_recovery(test_client):
    """Test error handling and recovery."""
    try:
        # Test error handling
        response = test_client.post("/api/graph/analyze", json={
            "invalid": "data"
        })
        assert response.status_code == 422

        # Verify system health
        health_response = test_client.get("/health")
        assert health_response.status_code == 200
        assert health_response.json()["status"] == "healthy"

        logger.info("Error recovery test passed")
    except Exception as e:
        logger.error(f"Error recovery test failed: {e}")
        raise

def test_websocket_connection(test_client):
    """Test WebSocket connectivity."""
    try:
        with test_client.websocket_connect("/ws") as websocket:
            data = websocket.receive_json()
            assert "nodes" in data
            assert "edges" in data
            logger.info("WebSocket connection test passed")
    except Exception as e:
        logger.error(f"WebSocket connection test failed: {e}")
        raise