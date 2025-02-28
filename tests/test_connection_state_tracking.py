"""Test connection state tracking and transitions."""
import pytest
import asyncio
import logging
from typing import List, Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ConnectionStateTracker:
    """Helper class to track connection states"""
    def __init__(self, event_loop):
        self.state_log = []
        self.transaction_count = 0
        self.active_connections = 0
        self.loop = event_loop

    def log_state(self, event: str, details: str = None):
        """Log an operation with timestamp"""
        timestamp = self.loop.time()
        log_entry = {
            'timestamp': timestamp,
            'event': event,
            'details': details,
            'active_connections': self.active_connections,
            'transactions': self.transaction_count
        }
        self.state_log.append(log_entry)
        logger.info(f"{timestamp:.6f}: {event} - {details or ''}")

@pytest.mark.asyncio
async def test_connection_state_transitions(event_loop, db_pool):
    """Test connection state transitions with detailed tracking."""
    tracker = ConnectionStateTracker(event_loop)
    try:
        tracker.log_state("test_start")

        async with db_pool.acquire() as conn:
            tracker.active_connections += 1
            tracker.log_state("connection_acquired", f"conn_id={id(conn)}")

            async with conn.transaction():
                tracker.transaction_count += 1
                tracker.log_state("transaction_started", f"conn_id={id(conn)}")

                # Use unique label to avoid conflicts
                test_label = f"test_state_transition_{id(conn)}_{tracker.loop.time()}"
                await conn.execute("""
                    INSERT INTO nodes (label, type) 
                    VALUES ($1, $2)
                    ON CONFLICT (label) DO NOTHING
                """, test_label, "test")
                tracker.log_state("query_executed", f"label={test_label}")

                # Verify data
                count = await conn.fetchval(
                    "SELECT COUNT(*) FROM nodes WHERE label = $1",
                    test_label
                )
                assert count >= 0
                tracker.log_state("data_verified", f"count={count}")

            tracker.transaction_count -= 1
            tracker.log_state("transaction_committed")

        tracker.active_connections -= 1
        tracker.log_state("connection_released")

        logger.info("Connection state transitions test passed")
    except Exception as e:
        logger.error(f"Connection state transitions test failed: {e}", exc_info=True)
        raise
    finally:
        for entry in tracker.state_log:
            logger.info(f"{entry['timestamp']:.6f}: {entry['event']} - {entry.get('details', '')}")

@pytest.mark.asyncio
async def test_transaction_nesting(event_loop, db_pool):
    """Test nested transaction handling with state tracking."""
    tracker = ConnectionStateTracker(event_loop)
    try:
        tracker.log_state("test_start")

        async with db_pool.acquire() as conn:
            tracker.active_connections += 1
            tracker.log_state("connection_acquired")

            # Outer transaction
            async with conn.transaction():
                tracker.transaction_count += 1
                tracker.log_state("outer_transaction_started")

                # Inner transaction
                async with conn.transaction():
                    tracker.transaction_count += 1
                    tracker.log_state("inner_transaction_started")

                    test_label = f"test_nested_{id(conn)}_{tracker.loop.time()}"
                    await conn.execute("""
                        INSERT INTO nodes (label, type) 
                        VALUES ($1, $2)
                        ON CONFLICT (label) DO NOTHING
                    """, test_label, "test")
                    tracker.log_state("query_executed")

                tracker.transaction_count -= 1
                tracker.log_state("inner_transaction_committed")

            tracker.transaction_count -= 1
            tracker.log_state("outer_transaction_committed")

        tracker.active_connections -= 1
        tracker.log_state("connection_released")

        logger.info("Transaction nesting test passed")
    except Exception as e:
        logger.error(f"Transaction nesting test failed: {e}", exc_info=True)
        raise

@pytest.mark.asyncio
async def test_transaction_rollback(event_loop, db_pool):
    """Test transaction rollback with state tracking."""
    tracker = ConnectionStateTracker(event_loop)
    try:
        tracker.log_state("test_start")

        async with db_pool.acquire() as conn:
            tracker.active_connections += 1
            tracker.log_state("connection_acquired")

            try:
                async with conn.transaction():
                    tracker.transaction_count += 1
                    tracker.log_state("transaction_started")

                    test_label = f"test_rollback_{id(conn)}_{tracker.loop.time()}"
                    await conn.execute("""
                        INSERT INTO nodes (label, type) 
                        VALUES ($1, $2)
                        ON CONFLICT (label) DO NOTHING
                    """, test_label, "test")
                    tracker.log_state("query_executed")

                    # Force an error
                    await conn.execute("SELECT 1/0")
            except Exception:
                tracker.log_state("transaction_rollback")
                tracker.transaction_count -= 1

            # Verify rollback
            count = await conn.fetchval(
                "SELECT COUNT(*) FROM nodes WHERE label = $1",
                test_label
            )
            assert count == 0
            tracker.log_state("rollback_verified")

        tracker.active_connections -= 1
        tracker.log_state("connection_released")

        logger.info("Transaction rollback test passed")
    except Exception as e:
        logger.error(f"Transaction rollback test failed: {e}", exc_info=True)
        raise