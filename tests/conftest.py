"""Pytest configuration and fixtures."""
import pytest
import asyncio
import logging
from fastapi.testclient import TestClient

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Store session-level resources
_pool = None
_app = None

@pytest.fixture(scope="session")
def event_loop():
    """Create and provide an event loop for the entire test session."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    logger.info("Created new event loop for test session")
    yield loop

    # Cleanup at end of test session
    try:
        if not loop.is_closed():
            loop.run_until_complete(loop.shutdown_asyncgens())
            loop.close()
            logger.info("Test session event loop closed")
    except Exception as e:
        logger.error(f"Error closing event loop: {e}")

@pytest.fixture(scope="session")
async def db_pool(event_loop):
    """Create a database pool for the test session."""
    global _pool
    from server.database import get_pool, cleanup_pool

    # Ensure we're using the session event loop
    asyncio.set_event_loop(event_loop)
    logger.info("Creating database pool")

    try:
        _pool = await get_pool()
        yield _pool
    finally:
        try:
            # Only cleanup at the end of the session
            logger.info("Cleaning up database pool")
            await cleanup_pool()
            logger.info("Database pool cleaned up")
        except Exception as e:
            logger.error(f"Error cleaning up database pool: {e}")

@pytest.fixture(scope="session")
async def test_app(event_loop, db_pool):
    """Create a test application instance."""
    global _app
    from server.app import app
    from server.database import init_db

    # Ensure we're using the session event loop
    asyncio.set_event_loop(event_loop)
    logger.info("Initializing test app")

    try:
        await init_db()
        app.dependency_overrides = {}
        _app = app
        yield app
    finally:
        try:
            if hasattr(app, 'cleanup'):
                await app.cleanup()
                logger.info("Test app cleaned up")
        except Exception as e:
            logger.error(f"App cleanup failed: {e}")

@pytest.fixture(scope="function")
def test_client(event_loop, test_app):
    """Create a test client."""
    # Ensure we're using the session event loop
    asyncio.set_event_loop(event_loop)
    logger.info("Creating test client")

    # Create test client in the same event loop context
    client = TestClient(test_app)
    return client

@pytest.fixture(autouse=True)
async def cleanup_fixture(event_loop):
    """Cleanup fixture that runs after each test."""
    yield

    try:
        # Clean up any pending tasks but keep connections alive
        if not event_loop.is_closed():
            tasks = [t for t in asyncio.all_tasks(event_loop)
                    if t is not asyncio.current_task() and not t.done()]
            if tasks:
                logger.info(f"Cleaning up {len(tasks)} pending tasks")
                for task in tasks:
                    task.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)
                logger.info("Pending tasks cleaned up")
    except Exception as e:
        logger.error(f"Error in cleanup: {e}")