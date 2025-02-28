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

class ConnectionStateTracker:
    """Helper class to track connection states"""
    def __init__(self):
        self.state_log = []
        self.transaction_count = 0
        self.active_connections = 0

    def log_state(self, event: str, details: str = None):
        timestamp = asyncio.get_running_loop().time()
        self.state_log.append({
            'timestamp': timestamp,
            'event': event,
            'details': details,
            'active_connections': self.active_connections,
            'transactions': self.transaction_count
        })

@pytest.fixture(scope="function")
async def state_tracker():
    tracker = ConnectionStateTracker()
    yield tracker
    # Log final state
    for entry in tracker.state_log:
        logger.info(f"{entry['timestamp']:.6f}: {entry['event']} - {entry['details']}")

@pytest.mark.asyncio
async def test_connection_state_transitions(state_tracker):
    """Test connection state transitions with detailed tracking."""
    try:
        # Initialize connection
        state_tracker.log_state("test_start")
        pool = await get_pool()
        
        async with pool.acquire() as conn:
            state_tracker.active_connections += 1
            state_tracker.log_state("connection_acquired")

            # Test transaction
            async with conn.transaction():
                state_tracker.transaction_count += 1
                state_tracker.log_state("transaction_started")
                
                await conn.execute("""
                    INSERT INTO nodes (label, type) 
                    VALUES ($1, $2)
                """, "test_node", "test")
                state_tracker.log_state("query_executed")

            state_tracker.transaction_count -= 1
            state_tracker.log_state("transaction_committed")

            # Verify data
            count = await conn.fetchval(
                "SELECT COUNT(*) FROM nodes WHERE label = $1",
                "test_node"
            )
            assert count == 1
            state_tracker.log_state("data_verified")

        state_tracker.active_connections -= 1
        state_tracker.log_state("connection_released")
        
        logger.info("Connection state transitions test passed")
    except Exception as e:
        logger.error(f"Connection state transitions test failed: {e}")
        raise
    finally:
        await cleanup_pool()

@pytest.mark.asyncio
async def test_transaction_nesting(state_tracker):
    """Test nested transaction handling with state tracking."""
    try:
        pool = await get_pool()
        state_tracker.log_state("test_start")

        async with pool.acquire() as conn:
            state_tracker.active_connections += 1
            state_tracker.log_state("connection_acquired")

            # Outer transaction
            async with conn.transaction():
                state_tracker.transaction_count += 1
                state_tracker.log_state("outer_transaction_started")

                # Inner transaction
                async with conn.transaction():
                    state_tracker.transaction_count += 1
                    state_tracker.log_state("inner_transaction_started")
                    
                    await conn.execute("""
                        INSERT INTO nodes (label, type) 
                        VALUES ($1, $2)
                    """, "nested_test", "test")
                    
                    state_tracker.log_state("query_executed")

                state_tracker.transaction_count -= 1
                state_tracker.log_state("inner_transaction_committed")

            state_tracker.transaction_count -= 1
            state_tracker.log_state("outer_transaction_committed")

        state_tracker.active_connections -= 1
        state_tracker.log_state("connection_released")
        
        logger.info("Transaction nesting test passed")
    except Exception as e:
        logger.error(f"Transaction nesting test failed: {e}")
        raise
    finally:
        await cleanup_pool()

@pytest.mark.asyncio
async def test_transaction_rollback(state_tracker):
    """Test transaction rollback with state tracking."""
    try:
        pool = await get_pool()
        state_tracker.log_state("test_start")

        async with pool.acquire() as conn:
            state_tracker.active_connections += 1
            state_tracker.log_state("connection_acquired")

            try:
                async with conn.transaction():
                    state_tracker.transaction_count += 1
                    state_tracker.log_state("transaction_started")
                    
                    await conn.execute("""
                        INSERT INTO nodes (label, type) 
                        VALUES ($1, $2)
                    """, "rollback_test", "test")
                    state_tracker.log_state("query_executed")
                    
                    # Force an error
                    await conn.execute("SELECT 1/0")
            except Exception:
                state_tracker.log_state("transaction_rollback")
                state_tracker.transaction_count -= 1

            # Verify rollback
            count = await conn.fetchval(
                "SELECT COUNT(*) FROM nodes WHERE label = $1",
                "rollback_test"
            )
            assert count == 0
            state_tracker.log_state("rollback_verified")

        state_tracker.active_connections -= 1
        state_tracker.log_state("connection_released")
        
        logger.info("Transaction rollback test passed")
    except Exception as e:
        logger.error(f"Transaction rollback test failed: {e}")
        raise
    finally:
        await cleanup_pool()
