"""Test configuration and fixtures."""
import pytest
import asyncio
from typing import AsyncGenerator, Optional
import logging
from contextlib import asynccontextmanager
import sys

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@pytest.fixture(scope="session")
def event_loop():
    """Create a new event loop for the entire test session."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    yield loop

    # Cleanup
    try:
        # Cancel all tasks
        pending = asyncio.all_tasks(loop)
        for task in pending:
            task.cancel()

        # Wait for tasks to finish
        if pending:
            loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))

        # Close the loop
        loop.run_until_complete(loop.shutdown_asyncgens())
        loop.close()
    except Exception as e:
        logger.error(f"Error during event loop cleanup: {e}")
        # Don't raise here to allow other cleanup to proceed

@pytest.fixture(scope="function")
async def db_pool(event_loop) -> AsyncGenerator:
    """Create a database pool for tests with proper cleanup."""
    from server.database import get_pool, cleanup_pool

    # Ensure we're using the session event loop
    asyncio.set_event_loop(event_loop)

    try:
        pool = await get_pool()

        # Clear test data before each test
        async with pool.acquire() as conn:
            try:
                async with conn.transaction():
                    await conn.execute("""
                        DELETE FROM edges WHERE TRUE;
                        DELETE FROM nodes WHERE TRUE;
                    """)
            except Exception as e:
                logger.error(f"Error cleaning database: {e}")
                raise

        yield pool

    finally:
        # Always cleanup the pool
        try:
            await cleanup_pool()
        except Exception as e:
            logger.error(f"Error during pool cleanup: {e}")
            raise

@pytest.fixture(scope="function")
async def test_app(event_loop, db_pool):
    """Create a test application instance with database connection."""
    from server.app import create_app
    from server.database import init_db

    # Ensure we're using the session event loop
    asyncio.set_event_loop(event_loop)

    try:
        # Initialize database schema
        await init_db()

        # Create and configure test app
        app = create_app()  # Removed await since create_app might not be async
        await app.startup()  # Add explicit startup if needed
        yield app

    finally:
        # Cleanup
        try:
            if 'app' in locals():
                await app.cleanup()
        except Exception as e:
            logger.error(f"App cleanup failed: {e}")
            raise

@pytest.fixture(autouse=True)
async def verify_loop_state(event_loop):
    """Automatically verify event loop state before and after each test."""
    # Before test
    try:
        current_loop = asyncio.get_event_loop()
        assert current_loop == event_loop, "Test started with wrong event loop"
        assert not current_loop.is_closed(), "Test started with closed event loop"
    except Exception as e:
        logger.error(f"Pre-test loop verification failed: {e}")
        raise

    yield

    # After test
    try:
        current_loop = asyncio.get_event_loop()
        assert current_loop == event_loop, "Test ended with wrong event loop"
        assert not current_loop.is_closed(), "Test ended with closed event loop"
    except Exception as e:
        logger.error(f"Post-test loop verification failed: {e}")
        raise