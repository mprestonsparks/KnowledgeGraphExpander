import os
import logging
import pathlib
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import Dict, List, Optional
from pydantic import BaseModel

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Knowledge Graph API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create directory structure
os.makedirs("server/routes", exist_ok=True)
os.makedirs("server/models", exist_ok=True)

# Import routes after directory creation to avoid import errors
from server.routes import graph, suggestions
from server.database import init_db
from server.models.schemas import Node, Edge, GraphData

# Initialize database
@app.on_event("startup")
async def startup():
    await init_db()

# Include routers
app.include_router(graph.router)
app.include_router(suggestions.router)

# WebSocket connections store
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("Client connected")

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

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        from server.graph_manager import graph_manager
        # Send initial graph data on connection
        graph_data = await graph_manager.get_graph_data()
        await websocket.send_json(graph_data)

        while True:
            data = await websocket.receive_text()
            logger.info(f"Received WebSocket message: {data}")
            await websocket.send_text(f"Message received: {data}")
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
    finally:
        manager.disconnect(websocket)

@app.get("/")
async def root():
    """Root endpoint that provides API information"""
    logger.info("Handling request to root endpoint")
    return {
        "message": "Knowledge Graph API Server",
        "version": "1.0",
        "endpoints": {
            "/": "This information",
            "/health": "Health check",
            "/api/graph": "Graph data and operations",
            "/api/graph/suggestions": "Graph relationship suggestions",
            "/ws": "WebSocket endpoint for real-time updates"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    logger.info("Handling health check request")
    return {"status": "healthy"}

# Ensure frontend/dist directory exists
frontend_path = pathlib.Path("frontend/dist")
if not frontend_path.exists():
    logger.warning(f"Directory {frontend_path} does not exist. Creating it...")
    frontend_path.mkdir(parents=True, exist_ok=True)
    # Create a temporary index.html if it doesn't exist
    index_path = frontend_path / "index.html"
    if not index_path.exists():
        index_path.write_text("""
        <!DOCTYPE html>
        <html>
            <head>
                <title>Knowledge Graph System</title>
            </head>
            <body>
                <h1>Knowledge Graph System</h1>
                <p>The frontend is being built...</p>
            </body>
        </html>
        """)

# Mount the React frontend static files
try:
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")
    logger.info(f"Successfully mounted static files from {frontend_path}")
except Exception as e:
    logger.error(f"Failed to mount static files: {str(e)}")
    raise