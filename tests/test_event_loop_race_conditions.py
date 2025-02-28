"""Test runner script for event loop race conditions."""
import pytest
import asyncio
import logging
from typing import List
from asyncio import Task

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RaceConditionTester:
    """Helper class for testing race conditions in event loop management"""
    def __init__(self, event_loop):
        self.loop = event_loop
        self.active_connections = 0
        self.errors = []
        self.operations_log = []
        self.pool_closed = False

    def log_operation(self, operation: str):
        """Log an operation with timestamp"""
        timestamp = self.loop.time()
        self.operations_log.append((timestamp, operation))
        logger.info(f"{timestamp:.6f}: {operation}")

@pytest.mark.asyncio
async def test_interrupt_pool_operations(event_loop, db_pool):
    """Test interrupting pool operations mid-flight."""
    tester = RaceConditionTester(event_loop)
    try:
        logger.info("Starting interrupt pool operations test")

        # Create events for synchronization
        workers_ready = asyncio.Event()
        interrupt_started = asyncio.Event()

        async def interrupter():
            try:
                await workers_ready.wait()
                tester.log_operation("Interrupter starting")
                interrupt_started.set()  # Signal interruption starting

                # Give worker time to start a transaction
                await asyncio.sleep(0.1)

                # Close the pool
                tester.log_operation("Closing pool")
                from server.database import cleanup_pool
                await cleanup_pool()
                tester.pool_closed = True
                tester.log_operation("Pool cleanup completed")
                return True
            except asyncio.CancelledError:
                tester.log_operation("Interrupter cancelled")
                raise
            except Exception as e:
                tester.log_operation(f"Interrupter failed: {str(e)}")
                return False

        async def worker(i: int):
            try:
                tester.log_operation(f"Worker {i} starting")
                async with db_pool.acquire() as conn:
                    tester.log_operation(f"Worker {i} acquired connection")
                    workers_ready.set()  # Signal ready

                    # Wait for interrupt signal
                    await interrupt_started.wait()
                    tester.log_operation(f"Worker {i} starting transaction")

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
                    except Exception as e:
                        tester.log_operation(f"Worker {i} caught expected interruption: {str(e)}")
                        return True
            except Exception as e:
                tester.log_operation(f"Worker {i} failed: {str(e)}")
                tester.errors.append((i, str(e)))
                return False

        # Run with timeout
        async with asyncio.timeout(3):
            worker_task = asyncio.create_task(worker(0))
            interrupter_task = asyncio.create_task(interrupter())

            try:
                results = await asyncio.gather(worker_task, interrupter_task)
                worker_result, interrupter_result = results

                assert interrupter_result, "Pool cleanup failed"
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

@pytest.mark.asyncio
async def test_concurrent_pool_operations(event_loop, db_pool):
    """Test concurrent pool operations with state tracking"""
    try:
        logger.info("Starting concurrent pool operations test")
        async def worker(i: int):
            try:
                async with db_pool.acquire() as conn:
                    result = await conn.fetchval("SELECT 1")
                    assert result == 1
                    logger.info(f"Worker {i} succeeded")
                    return True
            except Exception as e:
                logger.error(f"Worker {i} failed: {e}")
                return False

        # Run concurrent workers
        tasks = [worker(i) for i in range(3)]
        results = await asyncio.gather(*tasks)

        # All operations should succeed
        assert all(results), "Some concurrent operations failed"
        logger.info("Concurrent pool operations test passed")
    except Exception as e:
        logger.error(f"Concurrent pool operations test failed: {e}")
        raise

@pytest.mark.asyncio
async def test_connection_lifecycle_tracking(event_loop, db_pool):
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
async def test_error_recovery(event_loop, db_pool):
    """Test error recovery with proper cleanup"""
    try:
        logger.info("Starting error recovery test")
        error_states = []

        async with db_pool.acquire() as conn:
            try:
                await conn.execute("SELECT invalid_function()")
            except Exception as e:
                error_states.append(("sql_error", str(e)))
                logger.info("Captured expected SQL error: %s", e)

            # Verify connection recovery
            result = await conn.fetchval("SELECT 1")
            assert result == 1
            error_states.append(("recovered", id(conn)))

        logger.info("Error states: %s", error_states)
        logger.info("Error recovery test passed")
    except Exception as e:
        logger.error(f"Error recovery test failed: {e}")
        raise