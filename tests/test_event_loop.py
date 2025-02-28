import pytest
import asyncio
import logging
import asyncpg
from server.database import init_db, get_pool, cleanup_pool
from contextlib import contextmanager
from typing import Optional, Generator

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class EventLoopTestManager:
    """Helper class to manage event loops during testing"""
    def __init__(self):
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self.original_loop: Optional[asyncio.AbstractEventLoop] = None

    @contextmanager
    def create_new_loop(self) -> Generator[asyncio.AbstractEventLoop, None, None]:
        """Create a new event loop and make it the current one"""
        try:
            # Store the current loop if it exists
            self.original_loop = asyncio.get_event_loop_policy().get_event_loop()
            
            # Create and activate new loop
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)
            yield self.loop
        finally:
            if self.loop and not self.loop.is_closed():
                self.loop.run_until_complete(cleanup_pool())
                self.loop.close()
            if self.original_loop:
                asyncio.set_event_loop(self.original_loop)

@pytest.fixture
def event_loop_manager():
    """Provide an event loop manager for tests"""
    return EventLoopTestManager()

@pytest.mark.asyncio
async def test_event_loop_isolation(event_loop_manager):
    """Test database operations with isolated event loops"""
    try:
        with event_loop_manager.create_new_loop() as loop1:
            # Initialize database in first loop
            await init_db()
            pool1 = await get_pool()
            assert pool1 is not None
            assert not loop1.is_closed()

            async with pool1.acquire() as conn:
                result = await conn.fetchval("SELECT 1")
                assert result == 1
                logger.info("First loop connection verified")

        # Create a second loop to verify isolation
        with event_loop_manager.create_new_loop() as loop2:
            await init_db()
            pool2 = await get_pool()
            assert pool2 is not None
            assert not loop2.is_closed()

            async with pool2.acquire() as conn:
                result = await conn.fetchval("SELECT 1")
                assert result == 1
                logger.info("Second loop connection verified")

        logger.info("Event loop isolation test passed")
    except Exception as e:
        logger.error(f"Event loop isolation test failed: {e}")
        raise

@pytest.mark.asyncio
async def test_event_loop_cleanup(event_loop_manager):
    """Test proper cleanup of event loops and connections"""
    try:
        with event_loop_manager.create_new_loop() as loop:
            await init_db()
            pool = await get_pool()

            # Create multiple connections
            conns = []
            for i in range(3):
                conn = await pool.acquire()
                conns.append(conn)
                result = await conn.fetchval("SELECT 1")
                assert result == 1

            # Release connections properly
            for conn in conns:
                await pool.release(conn)

            await cleanup_pool()
            assert loop.is_running()
            logger.info("Event loop cleanup test passed")
    except Exception as e:
        logger.error(f"Event loop cleanup test failed: {e}")
        raise

@pytest.mark.asyncio
async def test_concurrent_event_loops():
    """Test handling concurrent event loops"""
    try:
        async def run_in_loop(loop_id: int):
            await init_db()
            pool = await get_pool()
            async with pool.acquire() as conn:
                result = await conn.fetchval("SELECT $1::int", loop_id)
                assert result == loop_id
                logger.info(f"Loop {loop_id} executed successfully")
            await cleanup_pool()

        # Run concurrent operations
        tasks = [run_in_loop(i) for i in range(3)]
        await asyncio.gather(*tasks)
        logger.info("Concurrent event loops test passed")
    except Exception as e:
        logger.error(f"Concurrent event loops test failed: {e}")
        raise

@pytest.mark.asyncio
async def test_event_loop_error_recovery():
    """Test recovery from event loop errors"""
    try:
        await init_db()
        pool = await get_pool()

        async with pool.acquire() as conn:
            # Simulate a connection error
            with pytest.raises(asyncpg.PostgresError):
                await conn.execute("INVALID SQL")

            # Verify connection is still usable
            result = await conn.fetchval("SELECT 1")
            assert result == 1

        # Test connection after error
        async with pool.acquire() as conn:
            result = await conn.fetchval("SELECT 1")
            assert result == 1

        logger.info("Event loop error recovery test passed")
    except Exception as e:
        logger.error(f"Event loop error recovery test failed: {e}")
        raise

@pytest.mark.asyncio
async def test_transaction_across_loops(event_loop_manager):
    """Test transaction handling across different event loops"""
    try:
        with event_loop_manager.create_new_loop() as loop:
            await init_db()
            pool = await get_pool()

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
            async with pool.acquire() as conn:
                count = await conn.fetchval("""
                    SELECT COUNT(*) FROM nodes 
                    WHERE label = $1
                """, "test_node")
                assert count == 1

            logger.info("Transaction across loops test passed")
    except Exception as e:
        logger.error(f"Transaction across loops test failed: {e}")
        raise
