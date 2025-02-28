"""Test runner script for event loop diagnostics."""
import pytest
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class EventLoopDiagnostics:
    """Helper class for event loop diagnostics and state tracking"""
    @staticmethod
    async def capture_loop_state():
        """Capture current event loop state"""
        loop = asyncio.get_running_loop()
        logger.info(f"Current loop: {id(loop)}, is_closed={loop.is_closed()}, is_running={loop.is_running()}")
        return loop

    @staticmethod
    async def test_connection_acquisition(pool):
        """Test connection acquisition with state tracking"""
        loop = await EventLoopDiagnostics.capture_loop_state()
        logger.info("Acquiring connection on loop %s", id(loop))
        async with pool.acquire() as conn:
            result = await conn.fetchval("SELECT 1")
            logger.info("Connection acquired and verified on loop %s", id(loop))
            return result

@pytest.mark.asyncio
async def test_rapid_pool_cycling(db_pool):
    """Test rapid creation and cleanup of connection pools"""
    try:
        logger.info("Starting rapid pool cycling test")
        for i in range(3):
            logger.info(f"Cycle {i+1} starting")
            result = await EventLoopDiagnostics.test_connection_acquisition(db_pool)
            assert result == 1
            logger.info(f"Cycle {i+1} completed")
        logger.info("Rapid pool cycling test passed")
    except Exception as e:
        logger.error(f"Rapid pool cycling test failed: {e}")
        raise

@pytest.mark.asyncio
async def test_concurrent_pool_operations(db_pool):
    """Test concurrent pool operations with diagnostics"""
    try:
        logger.info("Starting concurrent pool operations test")
        async def worker(i: int):
            worker_loop = await EventLoopDiagnostics.capture_loop_state()
            logger.info(f"Worker {i} running on loop {id(worker_loop)}")
            return await EventLoopDiagnostics.test_connection_acquisition(db_pool)

        tasks = [worker(i) for i in range(5)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Worker {i} failed: {result}")
                raise result
            assert result == 1
            logger.info(f"Worker {i} completed successfully")

        logger.info("Concurrent pool operations test passed")
    except Exception as e:
        logger.error(f"Concurrent pool operations test failed: {e}")
        raise

@pytest.mark.asyncio
async def test_connection_lifecycle_tracking(db_pool):
    """Test detailed connection lifecycle with state tracking"""
    try:
        logger.info("Starting connection lifecycle tracking test")
        connection_states = []

        async with db_pool.acquire() as conn:
            connection_states.append(("acquired", id(conn)))

            async with conn.transaction():
                # Use a unique label for each test run
                test_label = f"test_lifecycle_{id(conn)}"
                await conn.execute("""
                    INSERT INTO nodes (label, type)
                    VALUES ($1, $2)
                    ON CONFLICT (label) DO NOTHING
                """, test_label, "test")
                connection_states.append(("transaction_active", id(conn)))

                count = await conn.fetchval(
                    "SELECT COUNT(*) FROM nodes WHERE label = $1",
                    test_label
                )
                assert count >= 1
                connection_states.append(("transaction_complete", id(conn)))

        logger.info("Connection states: %s", connection_states)
        logger.info("Connection lifecycle tracking test passed")
    except Exception as e:
        logger.error(f"Connection lifecycle tracking test failed: {e}")
        raise

@pytest.mark.asyncio
async def test_connection_error_tracking(db_pool):
    """Test connection error handling with state tracking"""
    try:
        logger.info("Starting connection error tracking test")
        error_states = []
        async with db_pool.acquire() as conn:
            try:
                await conn.execute("INVALID SQL")
            except Exception as e:
                error_states.append(("sql_error", str(e)))
                logger.info("Captured SQL error: %s", e)

            # Verify connection recovery
            result = await conn.fetchval("SELECT 1")
            assert result == 1
            error_states.append(("recovered", id(conn)))

        logger.info("Error states: %s", error_states)
        logger.info("Connection error tracking test passed")
    except Exception as e:
        logger.error(f"Connection error tracking test failed: {e}")
        raise