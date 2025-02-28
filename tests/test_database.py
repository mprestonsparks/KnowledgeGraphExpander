import pytest
import asyncio
import logging
import asyncpg
from server.database import init_db, get_pool, get_node, create_node, get_edge, create_edge, cleanup_pool

# Configure logging for tests
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@pytest.fixture(scope="function")
async def db_pool():
    """Create and return a database pool for testing."""
    try:
        await init_db()
        pool = await get_pool()
        yield pool
    finally:
        await cleanup_pool()

@pytest.mark.asyncio
async def test_database_connection_lifecycle(db_pool):
    """Test database connection."""
    try:
        async with db_pool.acquire() as conn:
            result = await conn.fetchval("SELECT 1")
            assert result == 1
            logger.info("Connection verified")

        logger.info("Database lifecycle test passed")
    except Exception as e:
        logger.error(f"Database lifecycle test failed: {e}")
        raise

@pytest.mark.asyncio
async def test_connection_error_handling(db_pool):
    """Test error handling in connection management."""
    try:
        # Test invalid query
        async with db_pool.acquire() as conn:
            async with conn.transaction():
                with pytest.raises(asyncpg.PostgresError):
                    await conn.execute("INVALID SQL")
                logger.info("Invalid query handling verified")

        # Test transaction rollback
        async with db_pool.acquire() as conn:
            test_label = f"test_rollback_{id(conn)}"
            try:
                async with conn.transaction():
                    await conn.execute("""
                        INSERT INTO nodes (label, type) 
                        VALUES ($1, $2)
                        """, 
                        test_label, "test_type"
                    )
                    await conn.execute("INVALID SQL")
            except asyncpg.PostgresError:
                pass

            # Verify rollback
            count = await conn.fetchval(
                "SELECT COUNT(*) FROM nodes WHERE label = $1",
                test_label
            )
            assert count == 0, "Transaction rollback failed"
            logger.info("Transaction rollback verified")

        logger.info("Error handling test passed")
    except Exception as e:
        logger.error(f"Error handling test failed: {e}")
        raise

@pytest.mark.asyncio
async def test_concurrent_operations(db_pool):
    """Test concurrent database operations."""
    try:
        async def create_test_node(i: int):
            async with db_pool.acquire() as conn:
                test_label = f"test_node_{i}_{id(conn)}"
                return await conn.fetchval("""
                    INSERT INTO nodes (label, type)
                    VALUES ($1, $2)
                    RETURNING id
                """, test_label, "test")

        # Run concurrent operations
        tasks = [create_test_node(i) for i in range(3)]
        results = await asyncio.gather(*tasks)

        # Verify results
        assert len(results) == 3
        assert len(set(results)) == 3  # Unique IDs

        logger.info("Concurrent operations test passed")
    except Exception as e:
        logger.error(f"Concurrent operations test failed: {e}")
        raise

@pytest.mark.asyncio
async def test_node_operations(db_pool):
    """Test node operations."""
    try:
        # Use timestamp and connection id to ensure uniqueness
        test_id = f"{id(db_pool)}_{asyncio.get_event_loop().time()}"
        test_node = {
            "label": f"Test Node {test_id}",
            "type": "concept",
            "metadata": {"test": True}
        }

        # Create node
        created = await create_node(test_node)
        assert created is not None, "Node creation failed"
        assert created["label"] == test_node["label"]
        assert created["type"] == test_node["type"]
        assert created["metadata"]["test"] is True

        # Retrieve node
        retrieved = await get_node(created["id"])
        assert retrieved is not None, "Node retrieval failed"
        assert retrieved["label"] == created["label"]

        logger.info("Node operations test passed")
    except Exception as e:
        logger.error(f"Node operations test failed: {e}")
        raise

@pytest.mark.asyncio
async def test_edge_operations(db_pool):
    """Test edge operations."""
    try:
        # Create test nodes with unique labels
        test_id = f"{id(db_pool)}_{asyncio.get_event_loop().time()}"
        node1 = await create_node({
            "label": f"Source_{test_id}", 
            "type": "test"
        })
        node2 = await create_node({
            "label": f"Target_{test_id}", 
            "type": "test"
        })

        assert node1 is not None, "Source node creation failed"
        assert node2 is not None, "Target node creation failed"

        test_edge = {
            "sourceId": node1["id"],
            "targetId": node2["id"],
            "label": f"test_relation_{test_id}",
            "weight": 1.0,
            "metadata": {"test": True}
        }

        # Create edge
        created = await create_edge(test_edge)
        assert created is not None, "Edge creation failed"
        assert created["sourceId"] == node1["id"]
        assert created["targetId"] == node2["id"]

        # Retrieve edge
        retrieved = await get_edge(created["id"])
        assert retrieved is not None, "Edge retrieval failed"
        assert retrieved["label"] == test_edge["label"]

        # Test duplicate prevention
        duplicate = await create_edge(test_edge)
        assert duplicate is None, "Duplicate edge should not be created"

        logger.info("Edge operations test passed")
    except Exception as e:
        logger.error(f"Edge operations test failed: {e}")
        raise

@pytest.mark.asyncio
async def test_invalid_operations(db_pool):
    """Test invalid operations handling."""
    try:
        # Test invalid node retrieval
        invalid_node = await get_node(-1)
        assert invalid_node is None, "Invalid node should return None"

        # Test invalid edge creation
        invalid_edge = {
            "sourceId": -1,
            "targetId": -2,
            "label": "invalid"
        }
        invalid_result = await create_edge(invalid_edge)
        assert invalid_result is None, "Invalid edge creation should return None"

        logger.info("Invalid operations test passed")
    except Exception as e:
        logger.error(f"Invalid operations test failed: {e}")
        raise