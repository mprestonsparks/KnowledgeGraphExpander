import pytest
import asyncio
import logging
from asyncpg.exceptions import InterfaceError
from server.database import (
    init_db, get_pool, cleanup_pool, close_existing_pool,
    get_connection
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@pytest.fixture(scope="function")
async def event_loop():
    """Create a new event loop for each test."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    # Clean up
    await cleanup_pool()
    if not loop.is_closed():
        loop.close()
    asyncio.set_event_loop(None)

@pytest.mark.asyncio
async def test_event_loop_isolation():
    """Test database operations with isolated event loops."""
    try:
        logger.info("Starting event loop isolation test")

        # First loop operations
        await init_db()
        pool1 = await get_pool()
        assert pool1 is not None
        assert not asyncio.get_event_loop().is_closed()

        async with pool1.acquire() as conn:
            result = await conn.fetchval("SELECT 1")
            assert result == 1
            logger.info("First loop connection verified")

        await cleanup_pool()

        # Second loop operations
        await init_db()
        pool2 = await get_pool()
        assert pool2 is not None
        assert not asyncio.get_event_loop().is_closed()

        async with pool2.acquire() as conn:
            result = await conn.fetchval("SELECT 1")
            assert result == 1
            logger.info("Second loop connection verified")

        await cleanup_pool()
        logger.info("Event loop isolation test passed")
    except Exception as e:
        logger.error(f"Event loop isolation test failed: {e}", exc_info=True)
        raise

@pytest.mark.asyncio
async def test_event_loop_cleanup():
    """Test proper cleanup of event loops and connections."""
    try:
        logger.info("Starting event loop cleanup test")
        await init_db()
        pool = await get_pool()

        # Create multiple connections
        conns = []
        for i in range(3):
            conn = await pool.acquire()
            conns.append(conn)
            result = await conn.fetchval("SELECT 1")
            assert result == 1
            logger.info(f"Connection {i} verified")

        # Release connections properly
        for conn in conns:
            await pool.release(conn)

        await cleanup_pool()
        logger.info("Event loop cleanup test passed")
    except Exception as e:
        logger.error(f"Event loop cleanup test failed: {e}", exc_info=True)
        raise

@pytest.mark.asyncio
async def test_concurrent_event_loops():
    """Test handling concurrent event loops."""
    try:
        logger.info("Starting concurrent event loops test")
        await init_db()
        pool = await get_pool()

        async def worker(i: int):
            try:
                async with pool.acquire() as conn:
                    result = await conn.fetchval("SELECT $1::int", i)
                    assert result == i
                    logger.info(f"Worker {i} executed successfully")
                    return True
            except Exception as e:
                logger.error(f"Worker {i} failed: {e}")
                return False

        # Run concurrent operations
        tasks = [worker(i) for i in range(3)]
        results = await asyncio.gather(*tasks)

        # Cleanup after all workers are done
        await cleanup_pool()

        assert all(results), "Some workers failed"
        logger.info("Concurrent event loops test passed")
    except Exception as e:
        logger.error(f"Concurrent event loops test failed: {e}", exc_info=True)
        raise
    finally:
        await cleanup_pool()

@pytest.mark.asyncio
async def test_transaction_across_loops():
    """Test transaction handling across different event loops."""
    try:
        logger.info("Starting transaction across loops test")
        # Initialize database
        await init_db()
        pool = await get_pool()

        # Clean up any existing test data
        async with pool.acquire() as conn:
            await conn.execute("""
                DELETE FROM nodes 
                WHERE label = 'test_node'
            """)

        async with pool.acquire() as conn:
            async with conn.transaction():
                # Insert test data
                await conn.execute("""
                    INSERT INTO nodes (label, type) 
                    VALUES ($1, $2)
                """, "test_node", "test")

                # Verify in same transaction
                count = await conn.fetchval("""
                    SELECT COUNT(*) FROM nodes 
                    WHERE label = $1
                """, "test_node")
                assert count == 1

            # Verify in new connection
            async with pool.acquire() as conn2:
                count = await conn2.fetchval("""
                    SELECT COUNT(*) FROM nodes 
                    WHERE label = $1
                """, "test_node")
                assert count == 1

        await cleanup_pool()
        logger.info("Transaction across loops test passed")
    except Exception as e:
        logger.error(f"Transaction across loops test failed: {e}", exc_info=True)
        raise