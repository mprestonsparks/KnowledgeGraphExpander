"""Pytest configuration and fixtures."""
import pytest
import asyncio
import logging
from typing import AsyncGenerator
from contextlib import asynccontextmanager
from fastapi.testclient import TestClient

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop

    try:
        if not loop.is_closed():
            loop.run_until_complete(loop.shutdown_asyncgens())
            loop.close()
    except Exception as e:
        logger.error(f"Error closing event loop: {e}")

@pytest.fixture(scope="function")
async def db_pool(event_loop):
    """Create a database pool for tests."""
    from server.database import get_pool, cleanup_pool

    # Ensure we're using the session event loop
    asyncio.set_event_loop(event_loop)
    pool = None

    try:
        pool = await get_pool()
        yield pool
    finally:
        if pool is not None:
            try:
                current_loop = asyncio.get_event_loop()
                if current_loop.is_running():
                    # If we're in a running loop, use run_coroutine_threadsafe
                    future = asyncio.run_coroutine_threadsafe(cleanup_pool(), event_loop)
                    future.result(timeout=5)  # Add timeout to prevent hanging
                else:
                    # If loop is not running, we can await directly
                    await cleanup_pool()
            except Exception as e:
                logger.error(f"Error during pool cleanup: {e}")

@pytest.fixture(scope="function")
async def test_app(event_loop, db_pool):
    """Create a test application instance."""
    from server.app import app
    from server.database import init_db

    asyncio.set_event_loop(event_loop)

    try:
        await init_db()
        app.dependency_overrides = {}  # Reset any overrides
        yield app
    finally:
        if hasattr(app, 'cleanup'):
            try:
                await app.cleanup()
            except Exception as e:
                logger.error(f"App cleanup failed: {e}")

@pytest.fixture(scope="function")
def test_client(event_loop, test_app):
    """Create a test client."""
    # Set the event loop for the thread
    asyncio.set_event_loop(event_loop)

    with TestClient(test_app) as client:
        try:
            yield client
        finally:
            # Clean up any pending tasks
            try:
                tasks = [t for t in asyncio.all_tasks(event_loop) 
                        if t is not asyncio.current_task() and not t.done()]
                if tasks:
                    for task in tasks:
                        task.cancel()
                    event_loop.run_until_complete(asyncio.gather(*tasks, return_exceptions=True))
            except Exception as e:
                logger.error(f"Error cleaning up test client tasks: {e}")

@pytest.fixture(autouse=True)
async def verify_loop_state(event_loop):
    """Verify event loop state before and after each test."""
    # Pre-test verification
    try:
        current_loop = asyncio.get_event_loop()
        assert current_loop == event_loop, "Test started with wrong event loop"
        assert not current_loop.is_closed(), "Test started with closed event loop"
    except Exception as e:
        logger.error(f"Pre-test loop verification failed: {e}")
        raise

    yield

    # Post-test cleanup
    try:
        if not event_loop.is_closed():
            # Clean up any remaining tasks
            tasks = [t for t in asyncio.all_tasks(event_loop) 
                    if t is not asyncio.current_task() and not t.done()]
            if tasks:
                for task in tasks:
                    task.cancel()
                # Use run_until_complete to ensure tasks are cleaned up
                event_loop.run_until_complete(asyncio.gather(*tasks, return_exceptions=True))
    except Exception as e:
        logger.error(f"Post-test cleanup failed: {e}")

async def cleanup_pending_tasks(loop):
    """Helper function to clean up pending tasks."""
    try:
        tasks = [t for t in asyncio.all_tasks(loop) 
                if t is not asyncio.current_task() and not t.done()]
        if tasks:
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
    except Exception as e:
        logger.error(f"Error cleaning up pending tasks: {e}")