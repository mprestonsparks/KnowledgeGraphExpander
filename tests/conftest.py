"""Pytest configuration and fixtures."""
import pytest
import asyncio
import logging
from typing import AsyncGenerator
from contextlib import asynccontextmanager
from fastapi.testclient import TestClient

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def get_or_create_eventloop():
    """Get running event loop or create a new one."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            raise RuntimeError("Loop is closed")
        return loop
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop

@pytest.fixture(scope="function")
def event_loop():
    """Create an event loop for each test."""
    logger.info("Creating new event loop")
    loop = get_or_create_eventloop()
    yield loop

    try:
        if not loop.is_closed():
            logger.info("Cleaning up event loop")
            pending = [t for t in asyncio.all_tasks(loop) 
                      if t is not asyncio.current_task() and not t.done()]
            if pending:
                logger.info(f"Cancelling {len(pending)} pending tasks")
                for task in pending:
                    task.cancel()
                loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
            loop.run_until_complete(loop.shutdown_asyncgens())
            loop.close()
            logger.info("Event loop cleaned up")
    except Exception as e:
        logger.error(f"Error cleaning up event loop: {e}")

@pytest.fixture(scope="function")
async def db_pool(event_loop):
    """Create a database pool for tests."""
    from server.database import get_pool, cleanup_pool

    logger.info("Initializing database pool")
    pool = await get_pool()
    yield pool

    try:
        logger.info("Cleaning up database pool")
        await cleanup_pool()
        logger.info("Database pool cleaned up")
    except Exception as e:
        logger.error(f"Error cleaning up database pool: {e}")

@pytest.fixture(scope="function")
async def test_app(event_loop, db_pool):
    """Create a test application instance."""
    from server.app import app
    from server.database import init_db

    try:
        logger.info("Initializing test app")
        await init_db()
        app.dependency_overrides = {}
        yield app
    finally:
        if hasattr(app, 'cleanup'):
            try:
                logger.info("Cleaning up test app")
                await app.cleanup()
                logger.info("Test app cleaned up")
            except Exception as e:
                logger.error(f"App cleanup failed: {e}")

@pytest.fixture(scope="function")
def test_client(event_loop, test_app):
    """Create a test client."""
    logger.info("Creating test client")
    asyncio.set_event_loop(event_loop)

    with TestClient(test_app) as client:
        try:
            yield client
        finally:
            try:
                logger.info("Cleaning up test client")
                tasks = [t for t in asyncio.all_tasks(event_loop) 
                        if t is not asyncio.current_task() and not t.done()]
                if tasks:
                    logger.info(f"Found {len(tasks)} pending tasks to clean up")
                    for task in tasks:
                        task.cancel()
                    event_loop.run_until_complete(asyncio.gather(*tasks, return_exceptions=True))
                logger.info("Test client cleaned up")
            except Exception as e:
                logger.error(f"Error cleaning up test client: {e}")

@pytest.fixture(autouse=True)
async def verify_loop_state(event_loop):
    """Verify event loop state before and after each test."""
    try:
        current_loop = asyncio.get_event_loop()
        assert current_loop == event_loop, "Test started with wrong event loop"
        assert not current_loop.is_closed(), "Test started with closed event loop"
    except Exception as e:
        logger.error(f"Pre-test loop verification failed: {e}")
        raise

    yield

    try:
        if not event_loop.is_closed():
            tasks = [t for t in asyncio.all_tasks(event_loop) 
                    if t is not asyncio.current_task() and not t.done()]
            if tasks:
                for task in tasks:
                    task.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)
    except Exception as e:
        logger.error(f"Post-test loop verification failed: {e}")