import os
import logging
import pathlib
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import JSONResponse
from typing import List
from pydantic import BaseModel
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create directory structure
os.makedirs("server/routes", exist_ok=True)
os.makedirs("server/models", exist_ok=True)

# Import database and graph manager after directory creation
from server.database import init_db, cleanup_pool
from server.graph_manager import graph_manager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    try:
        logger.info("Initializing database...")
        await init_db()
        logger.info("Database initialization complete")

        logger.info("Initializing graph manager...")
        await graph_manager.initialize()
        logger.info("Graph manager initialization complete")

        yield
    except Exception as e:
        logger.error(f"Startup error: {str(e)}", exc_info=True)
        raise
    finally:
        logger.info("Cleaning up resources...")
        await cleanup_pool()
        logger.info("Cleanup complete")

app = FastAPI(
    title="Knowledge Graph API",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import routes after database initialization
from server.routes import graph, suggestions, websocket

# Include routers
app.include_router(graph.router)
app.include_router(suggestions.router)
app.include_router(websocket.router)

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

# Error handling middleware
@app.middleware("http")
async def error_handling_middleware(request: Request, call_next):
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        logger.error(f"Unhandled error: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": str(e)}
        )

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

# Mount static files last to ensure API routes take precedence
app.mount("/static", StaticFiles(directory=str(frontend_path), html=True), name="frontend")

logger.info("FastAPI application setup complete")