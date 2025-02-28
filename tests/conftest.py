"""Test configuration and fixtures."""
import pytest
import asyncio
from typing import AsyncGenerator, Optional
import logging
from contextlib import asynccontextmanager
import sys
from fastapi.testclient import TestClient

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_or_create_eventloop():
    """Helper function to get or create an event loop."""
    try:
        return asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop

@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the test session."""
    loop = get_or_create_eventloop()
    yield loop
    # Clean up the loop
    try:
        if not loop.is_closed():
            pending = asyncio.all_tasks(loop)
            for task in pending:
                if not task.done():
                    task.cancel()
            if pending:
                loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
            loop.run_until_complete(loop.shutdown_asyncgens())
            loop.close()
    except Exception as e:
        logger.error(f"Error cleaning up event loop: {e}")

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
                # Ensure cleanup happens in the same loop
                current_loop = asyncio.get_event_loop()
                if current_loop.is_running():
                    future = asyncio.run_coroutine_threadsafe(cleanup_pool(), event_loop)
                    future.result()
                else:
                    await cleanup_pool()
            except Exception as e:
                logger.error(f"Error during pool cleanup: {e}")

@pytest.fixture(scope="function")
async def test_app(event_loop, db_pool):
    """Create a test application instance."""
    from server.app import app
    from server.database import init_db

    # Ensure we're using the session event loop
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
    try:
        # Set the event loop for the thread
        asyncio.set_event_loop(event_loop)
        with TestClient(test_app) as client:
            yield client
    except Exception as e:
        logger.error(f"Error in test client: {e}")
        raise
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

    # Post-test verification and cleanup
    try:
        current_loop = asyncio.get_event_loop()
        if not current_loop.is_closed():
            # Cancel all non-current tasks
            tasks = [t for t in asyncio.all_tasks(current_loop) 
                    if t is not asyncio.current_task() and not t.done()]
            if tasks:
                for task in tasks:
                    task.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)
    except Exception as e:
        logger.error(f"Post-test loop verification failed: {e}")