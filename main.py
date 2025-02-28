import uvicorn
import os
import logging
from server.app import app
from server.database import init_db
from server.graph_manager import graph_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def startup():
    """Initialize application dependencies"""
    try:
        await init_db()
        await graph_manager.initialize()
        logger.info("Application initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize application: {str(e)}", exc_info=True)
        raise

if __name__ == "__main__":
    try:
        port = int(os.environ.get("PORT", 5000))
        logger.info(f"Starting server on port {port}")

        uvicorn.run(
            "server.app:app",
            host="0.0.0.0",
            port=port,
            log_level="info",
            access_log=True,
            reload=True,  # Enable auto-reload for development
            reload_dirs=["server"],  # Only watch the server directory
            lifespan="on",  # Enable lifespan events for startup/shutdown
        )
    except Exception as e:
        logger.error(f"Failed to start server: {str(e)}", exc_info=True)
        raise