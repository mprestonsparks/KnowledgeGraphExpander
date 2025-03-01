from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging
import json
from typing import List
from ..graph_manager import graph_manager
import ssl
import os

router = APIRouter()
logger = logging.getLogger(__name__)

# WebSocket connections store
class ConnectionManager:

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        try:
            await websocket.accept()
            self.active_connections.append(websocket)
            logger.info("Client connected via secure WebSocket")
        except Exception as e:
            logger.error(f"WebSocket connection error: {str(e)}")
            raise

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info("Client disconnected")

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

    async def broadcast_json(self, data):
        for connection in self.active_connections:
            await connection.send_json(data)


manager = ConnectionManager()

# Set up callback for graph updates
async def on_graph_update(graph_data):
    await manager.broadcast_json(graph_data)

# Register the callback
graph_manager.set_on_update_callback(on_graph_update)

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send initial graph data on connection
        graph_data = await graph_manager.get_graph_data()
        await websocket.send_json(graph_data)

        while True:
            data = await websocket.receive_text()
            logger.info(f"Received WebSocket message: {data}")

            # Handle WebSocket messages if needed
            await websocket.send_text(f"Message received: {data}")
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
    finally:
        manager.disconnect(websocket)