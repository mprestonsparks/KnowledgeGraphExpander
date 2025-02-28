import uvicorn
import os
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    try:
        port = int(os.environ.get("PORT", 3000))
        logger.info(f"Starting server on port {port}")

        uvicorn.run(
            "server.app:app",  # Use import string instead of app instance
            host="0.0.0.0",
            port=port,
            log_level="info",
            access_log=True,
            reload=True,  # Enable auto-reload for development
            reload_dirs=["server"]  # Only watch the server directory
        )
    except Exception as e:
        logger.error(f"Failed to start server: {str(e)}", exc_info=True)
        raise