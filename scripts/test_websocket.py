import asyncio
import websockets
import json
import logging
import ssl
import certifi
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_websocket_connection():
    """Test WebSocket connection and initial graph data reception."""
    # Use secure WebSocket URL with the repl's domain
    repl_domain = os.environ.get('REPL_SLUG', 'localhost')
    uri = f"wss://{repl_domain}.repl.co/ws"

    # Set up SSL context with system certificates
    ssl_context = ssl.create_default_context(cafile=certifi.where())

    try:
        async with websockets.connect(uri, ssl=ssl_context) as websocket:
            logger.info("Secure WebSocket connection established")

            # Receive initial graph data
            initial_data = await websocket.recv()
            data = json.loads(initial_data)

            if "nodes" in data and "edges" in data:
                logger.info(f"Received valid graph data with {len(data['nodes'])} nodes and {len(data['edges'])} edges")
                return True
            else:
                logger.error("Received invalid graph data format")
                return False
    except Exception as e:
        logger.error(f"WebSocket connection failed: {str(e)}")
        return False

if __name__ == "__main__":
    asyncio.run(test_websocket_connection())