import uvicorn
import os
import logging
import sys
from server.app import app
from server.database import init_db
from server.graph_manager import graph_manager
import subprocess
import pathlib

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def startup():
    """Initialize application dependencies"""
    try:
        # Build frontend first
        logger.info("Building frontend...")
        frontend_dir = pathlib.Path(__file__).parent / "frontend"
        if not (frontend_dir / "dist").exists():
            result = subprocess.run(["npm", "install"], cwd=frontend_dir, check=True)
            result = subprocess.run(["npm", "run", "build"], cwd=frontend_dir, check=True)
            logger.info("Frontend build completed")

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

        # Configure uvicorn with all necessary settings
        uvicorn.run(
            "server.app:app",
            host="0.0.0.0",
            port=port,
            log_level="info",
            reload=True,  # Enable auto-reload for development
            reload_dirs=["server"],  # Only watch the server directory
            lifespan="on",  # Enable lifespan events for startup/shutdown
        )
    except Exception as e:
        logger.error(f"Failed to start server: {str(e)}", exc_info=True)
        raise