import pytest
import asyncio
import logging
from server.database import init_db, get_pool, get_node, create_node, get_edge, create_edge

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
async def db_pool():
    """Initialize and return the database pool."""
    pool = await init_db()
    yield pool
    await pool.close()

@pytest.mark.asyncio
async def test_database_connection():
    """Test database connection and basic health check."""
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            result = await conn.fetchval("SELECT 1")
        assert result == 1
        logger.info("Database connection test passed")
    except Exception as e:
        logger.error(f"Database connection test failed: {str(e)}")
        raise

@pytest.mark.asyncio
async def test_node_operations(db_pool):
    """Test basic node CRUD operations."""
    # Test node creation
    test_node = {
        "label": "Test Node",
        "type": "concept",
        "metadata": {"test": True}
    }
    
    try:
        created_node = await create_node(test_node)
        assert created_node["label"] == "Test Node"
        assert created_node["type"] == "concept"
        assert created_node["metadata"]["test"] is True
        
        # Test node retrieval
        retrieved_node = await get_node(created_node["id"])
        assert retrieved_node is not None
        assert retrieved_node["label"] == created_node["label"]
        
        logger.info("Node operations test passed")
    except Exception as e:
        logger.error(f"Node operations test failed: {str(e)}")
        raise

@pytest.mark.asyncio
async def test_edge_operations(db_pool):
    """Test basic edge CRUD operations."""
    # Create two nodes for edge testing
    node1 = await create_node({"label": "Source Node", "type": "concept"})
    node2 = await create_node({"label": "Target Node", "type": "concept"})
    
    test_edge = {
        "sourceId": node1["id"],
        "targetId": node2["id"],
        "label": "test_relation",
        "weight": 1.0,
        "metadata": {"test": True}
    }
    
    try:
        created_edge = await create_edge(test_edge)
        assert created_edge is not None
        assert created_edge["sourceId"] == node1["id"]
        assert created_edge["targetId"] == node2["id"]
        
        # Test edge retrieval
        retrieved_edge = await get_edge(created_edge["id"])
        assert retrieved_edge is not None
        assert retrieved_edge["label"] == "test_relation"
        
        logger.info("Edge operations test passed")
    except Exception as e:
        logger.error(f"Edge operations test failed: {str(e)}")
        raise

@pytest.mark.asyncio
async def test_invalid_operations(db_pool):
    """Test handling of invalid operations."""
    try:
        # Test invalid node retrieval
        invalid_node = await get_node(-1)
        assert invalid_node is None
        
        # Test invalid edge creation (non-existent nodes)
        invalid_edge = {
            "sourceId": -1,
            "targetId": -2,
            "label": "invalid",
            "weight": 1.0
        }
        invalid_result = await create_edge(invalid_edge)
        assert invalid_result is None
        
        logger.info("Invalid operations handling test passed")
    except Exception as e:
        logger.error(f"Invalid operations test failed: {str(e)}")
        raise
