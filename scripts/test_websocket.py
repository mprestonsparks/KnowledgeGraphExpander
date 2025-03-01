import asyncio
import websockets
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_websocket_connection():
    """Test WebSocket connection and initial graph data reception."""
    uri = "ws://0.0.0.0:8080/ws"
    try:
        async with websockets.connect(uri) as websocket:
            logger.info("WebSocket connection established")
            
            # Receive initial graph data
            initial_data = await websocket.recv()
            data = json.loads(initial_data)
            
            if "nodes" in data and "edges" in data:
                logger.info("Received valid graph data with %d nodes and %d edges", 
                          len(data["nodes"]), len(data["edges"]))
                return True
            else:
                logger.error("Received invalid graph data format")
                return False
    except Exception as e:
        logger.error(f"WebSocket connection failed: {str(e)}")
        return False

if __name__ == "__main__":
    asyncio.run(test_websocket_connection())
