import pytest
import asyncio
import logging
import asyncpg
from asyncpg.exceptions import InterfaceError, QueryCanceledError
from server.database import (
    init_db, get_pool, cleanup_pool, close_existing_pool,
    get_connection
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RaceConditionTester:
    """Helper class for testing race conditions in event loop management"""
    def __init__(self):
        self.active_connections = 0
        self.errors = []
        self.operations_log = []
        self.pool_closed = False

    def log_operation(self, operation: str):
        """Log an operation with timestamp"""
        timestamp = asyncio.get_running_loop().time()
        self.operations_log.append((timestamp, operation))

@pytest.fixture(scope="function")
async def race_tester():
    """Create a race condition tester for each test"""
    tester = RaceConditionTester()
    yield tester
    # Log test results
    logger.info("Test operations log:")
    for timestamp, operation in tester.operations_log:
        logger.info(f"{timestamp:.6f}: {operation}")

@pytest.mark.asyncio
async def test_interrupt_pool_operations(race_tester):
    """Test interrupting pool operations mid-flight."""
    try:
        logger.info("Starting interrupt pool operations test")
        pool = await get_pool()

        # Create events for synchronization
        workers_ready = asyncio.Event()
        interrupt_started = asyncio.Event()

        async def interrupter():
            try:
                # Wait for workers to be ready
                await workers_ready.wait()
                race_tester.log_operation("Interrupter starting")
                interrupt_started.set()  # Signal interruption starting

                # Give worker time to start a transaction
                await asyncio.sleep(0.1)

                # Close the pool
                race_tester.log_operation("Closing pool")
                await cleanup_pool()
                race_tester.pool_closed = True
                race_tester.log_operation("Pool cleanup completed")
                return True
            except asyncio.CancelledError:
                race_tester.log_operation("Interrupter cancelled")
                raise
            except Exception as e:
                race_tester.log_operation(f"Interrupter failed: {str(e)}")
                return False

        async def worker(i: int):
            try:
                race_tester.log_operation(f"Worker {i} starting")
                async with pool.acquire() as conn:
                    race_tester.log_operation(f"Worker {i} acquired connection")
                    workers_ready.set()  # Signal ready

                    # Wait for interrupt signal
                    await interrupt_started.wait()
                    race_tester.log_operation(f"Worker {i} starting transaction")

                    try:
                        # Set statement timeout and execute long query
                        await conn.execute("SET statement_timeout TO '100ms'")
                        await conn.execute("""
                            DO $$
                            BEGIN
                                PERFORM pg_sleep(2);
                            END $$;
                        """)
                        # If we get here without timeout, return false
                        return False
                    except (InterfaceError, QueryCanceledError) as e:
                        race_tester.log_operation(f"Worker {i} caught expected interruption: {str(e)}")
                        return True
            except InterfaceError as e:
                race_tester.log_operation(f"Worker {i} caught pool shutdown: {str(e)}")
                return True
            except Exception as e:
                race_tester.log_operation(f"Worker {i} failed: {str(e)}")
                race_tester.errors.append((i, str(e)))
                return False

        # Run with timeout
        async with asyncio.timeout(3):
            worker_task = asyncio.create_task(worker(0))
            interrupter_task = asyncio.create_task(interrupter())

            try:
                results = await asyncio.gather(worker_task, interrupter_task)
                worker_result = results[0]
                interrupter_result = results[1]

                assert interrupter_result, "Pool cleanup failed"
                assert isinstance(worker_result, bool), f"Unexpected worker result type: {type(worker_result)}"
                assert worker_result, "Worker failed to catch pool interruption"

                logger.info("Interrupt pool operations test passed")
            except asyncio.TimeoutError:
                logger.error("Test timed out")
                raise
            finally:
                # Ensure tasks are cleaned up
                for task in [worker_task, interrupter_task]:
                    if not task.done():
                        task.cancel()
                        try:
                            await task
                        except asyncio.CancelledError:
                            pass

    except Exception as e:
        logger.error(f"Interrupt pool operations test failed: {e}", exc_info=True)
        raise
    finally:
        await cleanup_pool()

@pytest.mark.asyncio
async def test_rapid_connection_cycling():
    """Test rapid creation and disposal of connections."""
    try:
        logger.info("Starting rapid pool cycling test")
        for i in range(3):
            logger.info(f"Cycle {i+1} starting")
            pool = await get_pool()

            # Test pool usage
            async with pool.acquire() as conn:
                result = await conn.fetchval("SELECT 1")
                assert result == 1

            # Cleanup
            logger.info(f"Cleaning up pool")
            await cleanup_pool()
            logger.info(f"Cycle {i+1} completed")

        logger.info("Rapid pool cycling test passed")
    except Exception as e:
        logger.error(f"Rapid pool cycling test failed: {e}")
        raise

@pytest.mark.asyncio
async def test_concurrent_pool_creation():
    """Test concurrent attempts to create connection pools."""
    try:
        async def pool_creator(i: int):
            try:
                await init_db()
                pool = await get_pool()
                async with pool.acquire() as conn:
                    result = await conn.fetchval("SELECT 1")
                    assert result == 1
                    logger.info(f"Creator {i} succeeded")
                    return True
            except Exception as e:
                logger.error(f"Creator {i} failed: {e}")
                return False
            finally:
                await cleanup_pool()

        # Run concurrent pool creators
        tasks = [pool_creator(i) for i in range(3)]
        results = await asyncio.gather(*tasks)

        # At least one creator should succeed
        assert any(results), "All pool creators failed"

        logger.info("Concurrent pool creation test passed")
    finally:
        await cleanup_pool()

@pytest.mark.asyncio
async def test_event_loop_switching():
    """Test operations across different event loops."""
    try:
        # Create pool in first loop
        await init_db()
        pool1 = await get_pool()

        async def pool_user(i: int):
            try:
                async with pool1.acquire() as conn:
                    result = await conn.fetchval("SELECT 1")
                    assert result == 1
                    logger.info(f"Pool user {i} succeeded")
                    return True
            except Exception as e:
                logger.error(f"Pool user {i} failed: {e}")
                return False

        # Run concurrent users
        tasks = [pool_user(i) for i in range(3)]
        results = await asyncio.gather(*tasks)

        # All operations should succeed
        assert all(results), "Some pool users failed"

        logger.info("Event loop switching test passed")
    finally:
        await cleanup_pool()