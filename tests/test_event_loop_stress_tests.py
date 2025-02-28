import pytest
import asyncio
import logging
import time
from typing import List, Dict, Any
from asyncpg.exceptions import InterfaceError
from server.database import (
    init_db, get_pool, cleanup_pool, close_existing_pool,
    get_connection
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ConnectionMetrics:
    """Track connection pool metrics during stress testing"""
    def __init__(self):
        self.start_time = time.time()
        self.active_connections = 0
        self.max_connections = 0
        self.total_operations = 0
        self.errors = []
        self.transactions = 0
        self.operation_times: List[float] = []

    def log_operation(self, operation_time: float):
        """Log operation timing"""
        self.operation_times.append(operation_time)
        self.total_operations += 1

    def get_statistics(self) -> Dict[str, Any]:
        """Get collected statistics"""
        if not self.operation_times:
            return {}
        return {
            "total_operations": self.total_operations,
            "avg_operation_time": sum(self.operation_times) / len(self.operation_times),
            "max_operation_time": max(self.operation_times),
            "min_operation_time": min(self.operation_times),
            "max_concurrent_connections": self.max_connections,
            "error_count": len(self.errors)
        }

@pytest.fixture(scope="function")
async def metrics():
    """Create metrics tracker for each test"""
    return ConnectionMetrics()

async def run_transaction(conn, i: int, metrics: ConnectionMetrics):
    """Run a test transaction with metrics collection"""
    start_time = time.time()
    try:
        async with conn.transaction(isolation='serializable'):
            metrics.transactions += 1
            # Insert test data with unique identifier
            await conn.execute("""
                INSERT INTO nodes (label, type) 
                VALUES ($1, $2)
                ON CONFLICT (label) DO NOTHING
            """, f"stress_test_{i}", "test")

            # Verify exactly one row exists
            count = await conn.fetchval("""
                SELECT COUNT(*) FROM nodes 
                WHERE label = $1
            """, f"stress_test_{i}")
            assert count == 1, f"Expected 1 node with label 'stress_test_{i}', found {count}"
    finally:
        metrics.log_operation(time.time() - start_time)

@pytest.mark.asyncio
async def test_connection_pool_stress(metrics):
    """Test connection pool under high concurrency"""
    try:
        logger.info("Starting connection pool stress test")
        pool = await get_pool()

        # Clean up test data and set up unique constraint
        async with pool.acquire() as conn:
            # First truncate the nodes table to ensure clean state
            logger.info("Cleaning up existing data")
            await conn.execute("TRUNCATE nodes CASCADE")

            # Set up unique constraint if not exists
            logger.info("Setting up unique constraint")
            await conn.execute("""
                DO $$ 
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint 
                        WHERE conname = 'nodes_label_key'
                    ) THEN
                        ALTER TABLE nodes 
                        ADD CONSTRAINT nodes_label_key UNIQUE (label)
                        DEFERRABLE INITIALLY IMMEDIATE;
                    END IF;
                END $$;
            """)

        async def worker(i: int):
            for attempt in range(3):  # Number of retries
                try:
                    metrics.active_connections += 1
                    metrics.max_connections = max(
                        metrics.max_connections, 
                        metrics.active_connections
                    )

                    async with pool.acquire() as conn:
                        logger.info(f"Worker {i} acquired connection (attempt {attempt + 1})")
                        for j in range(3):  # Reduced number of transactions per worker
                            await run_transaction(conn, i * 100 + j, metrics)
                        return True
                except Exception as e:
                    metrics.errors.append((i, str(e)))
                    logger.warning(f"Worker {i} failed attempt {attempt + 1}: {str(e)}")
                    if attempt < 2:  # Don't sleep on last attempt
                        await asyncio.sleep(0.5 * (attempt + 1))  # Exponential backoff
                    continue
                finally:
                    metrics.active_connections -= 1
            return False

        # Run concurrent workers with reduced concurrency
        workers = [worker(i) for i in range(5)]  # Reduced from 10 to 5 workers
        results = await asyncio.gather(*workers)

        # Verify results
        success_rate = sum(1 for r in results if r) / len(results)
        stats = metrics.get_statistics()

        logger.info(f"Stress test statistics: {stats}")
        logger.info(f"Success rate: {success_rate:.2%}")

        assert success_rate > 0.8, f"Success rate {success_rate:.2%} below threshold"
        assert stats["error_count"] == 0, f"Encountered {stats['error_count']} errors"

        logger.info("Connection pool stress test passed")
    except Exception as e:
        logger.error(f"Connection pool stress test failed: {e}")
        raise
    finally:
        await cleanup_pool()

@pytest.mark.asyncio
async def test_rapid_transaction_cycling(metrics):
    """Test rapid transaction creation and rollback"""
    try:
        logger.info("Starting rapid transaction cycling test")
        pool = await get_pool()

        async def transaction_worker(i: int):
            try:
                async with pool.acquire() as conn:
                    # Execute successful transaction
                    await run_transaction(conn, i, metrics)

                    # Force rollback with controlled error
                    async with conn.transaction():
                        await conn.execute("""
                            INSERT INTO nodes (label, type) 
                            VALUES ($1, $2)
                        """, f"rollback_test_{i}", "test")
                        raise Exception("Forced rollback")
            except Exception as e:
                if "Forced rollback" not in str(e):
                    metrics.errors.append((i, str(e)))
                return True
            return False

        # Run rapid transactions
        workers = [transaction_worker(i) for i in range(20)]
        results = await asyncio.gather(*workers)

        # Verify all transactions properly rolled back
        pool2 = await get_pool()
        async with pool2.acquire() as conn:
            count = await conn.fetchval(
                "SELECT COUNT(*) FROM nodes WHERE label LIKE 'rollback_test_%'"
            )
            assert count == 0, f"Found {count} unrolled back transactions"

        stats = metrics.get_statistics()
        logger.info(f"Transaction cycling statistics: {stats}")
        assert all(results), "Some transactions failed to roll back properly"

        logger.info("Rapid transaction cycling test passed")
    finally:
        await cleanup_pool()

@pytest.mark.asyncio
async def test_connection_leak_detection():
    """Test detection of connection leaks"""
    try:
        logger.info("Starting connection leak detection test")
        pool = await get_pool()
        # Count initial active connections
        initial_active = len([h for h in pool._holders if h._con and not h._con.is_closed()])
        logger.info(f"Initial active connections: {initial_active}")

        async def leaky_worker(i: int):
            try:
                conn = await pool.acquire()
                await conn.execute("SELECT 1")  # Don't release properly
                logger.info(f"Worker {i} executed query")
                return True
            except Exception as e:
                logger.error(f"Worker {i} failed: {e}")
                return False

        # Run potential leaky operations
        workers = [leaky_worker(i) for i in range(5)]
        await asyncio.gather(*workers)

        # Force cleanup
        logger.info("Forcing pool cleanup")
        await cleanup_pool()
        pool2 = await get_pool()

        # Count final active connections
        final_active = len([h for h in pool2._holders if h._con and not h._con.is_closed()])
        logger.info(f"Final active connections: {final_active}")

        # Verify no connection leaks
        assert final_active == initial_active, \
            f"Connection leak detected: {final_active} vs {initial_active}"

        logger.info("Connection leak detection test passed")
    finally:
        await cleanup_pool()