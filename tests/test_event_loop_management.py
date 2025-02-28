import pytest
import asyncio
import logging
from asyncpg.exceptions import InterfaceError
from contextlib import asynccontextmanager
from server.database import (
    init_db, get_pool, cleanup_pool, close_existing_pool,
    get_connection
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AsyncioTestHelper:
    """Helper class to manage event loops during testing"""
    @staticmethod
    async def create_and_run_pool():
        await close_existing_pool()
        await init_db()
        return await get_pool()

    @staticmethod
    async def cleanup():
        await cleanup_pool()

@pytest.fixture(scope="function")
async def test_pool():
    """Create a fresh pool for each test"""
    pool = await AsyncioTestHelper.create_and_run_pool()
    yield pool
    await AsyncioTestHelper.cleanup()

@pytest.mark.asyncio
async def test_event_loop_isolation():
    """Test database operations with isolated event loops."""
    try:
        # Test initial pool creation
        pool = await get_pool()
        assert pool is not None
        logger.info("Pool created successfully")

        # Test connection acquisition
        async with pool.acquire() as conn:
            result = await conn.fetchval("SELECT 1")
            assert result == 1
            logger.info("Connection acquired and verified")

        logger.info("Event loop isolation test passed")
    finally:
        await cleanup_pool()

@pytest.mark.asyncio
async def test_connection_pool_lifecycle(test_pool):
    """Test complete connection pool lifecycle."""
    try:
        # Test connection management
        async with test_pool.acquire() as conn:
            result = await conn.fetchval("SELECT 1")
            assert result == 1
            logger.info("Connection test successful")

        # Test pool reuse
        async with test_pool.acquire() as conn:
            result = await conn.fetchval("SELECT 1")
            assert result == 1
            logger.info("Pool reuse successful")

        logger.info("Connection pool lifecycle test passed")
    except Exception as e:
        logger.error(f"Connection pool lifecycle test failed: {e}")
        raise

@pytest.mark.asyncio
async def test_concurrent_connection_handling(test_pool):
    """Test handling multiple concurrent connections."""
    try:
        async def worker(i: int):
            async with test_pool.acquire() as conn:
                async with conn.transaction():
                    return await conn.fetchval("SELECT $1::int", i)

        # Run concurrent operations
        tasks = [worker(i) for i in range(3)]
        results = await asyncio.gather(*tasks)

        # Verify results
        assert len(results) == 3
        assert set(results) == {0, 1, 2}
        logger.info("Concurrent connection handling test passed")
    except Exception as e:
        logger.error(f"Concurrent connection handling test failed: {e}")
        raise

@pytest.mark.asyncio
async def test_connection_error_recovery(test_pool):
    """Test recovery from connection errors."""
    try:
        # Test invalid query handling
        async with test_pool.acquire() as conn:
            async with conn.transaction():
                try:
                    await conn.execute("INVALID SQL")
                except Exception:
                    pass  # Expected error

            # Verify connection is still usable
            result = await conn.fetchval("SELECT 1")
            assert result == 1

        logger.info("Connection error recovery test passed")
    except Exception as e:
        logger.error(f"Connection error recovery test failed: {e}")
        raise

@pytest.mark.asyncio
async def test_transaction_isolation(test_pool):
    """Test transaction isolation and rollback."""
    try:
        # Start two transactions
        async with test_pool.acquire() as conn1, test_pool.acquire() as conn2:
            async with conn1.transaction():
                # Insert test data in first transaction
                await conn1.execute("""
                    INSERT INTO nodes (label, type) 
                    VALUES ($1, $2)
                """, "test_isolation", "test")

                # Verify data not visible in second transaction
                count = await conn2.fetchval("""
                    SELECT COUNT(*) FROM nodes 
                    WHERE label = $1
                """, "test_isolation")
                assert count == 0, "Transaction isolation failed"

        logger.info("Transaction isolation test passed")
    except Exception as e:
        logger.error(f"Transaction isolation test failed: {e}")
        raise

@pytest.mark.asyncio
async def test_event_loop_cleanup():
    """Test proper cleanup of event loops and connections."""
    try:
        # Create and configure pool
        pool = await AsyncioTestHelper.create_and_run_pool()

        # Test with multiple connections
        async def test_connection(i: int):
            async with pool.acquire() as conn:
                return await conn.fetchval("SELECT $1::int", i)

        results = await asyncio.gather(*[test_connection(i) for i in range(3)])
        assert len(results) == 3

        # Clean up
        await AsyncioTestHelper.cleanup()
        logger.info("Event loop cleanup test passed")
    except Exception as e:
        logger.error(f"Event loop cleanup test failed: {e}")
        raise