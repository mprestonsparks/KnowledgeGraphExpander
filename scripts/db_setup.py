import asyncio
from server.database import init_db, cleanup_pool
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def setup_db():
    try:
        logger.info("Initializing database...")
        await init_db()
        logger.info("Database initialization completed successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {str(e)}")
        raise
    finally:
        await cleanup_pool()

if __name__ == "__main__":
    asyncio.run(setup_db())