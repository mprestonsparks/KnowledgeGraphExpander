"""FastAPI application setup with GraphQL and REST endpoints."""
import os
import logging
import sys
import pathlib
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from starlette.responses import JSONResponse
from typing import List, Dict, Any
from pydantic import BaseModel
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure logging with more detailed format
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

# Log API key availability (without showing the actual keys)
if os.environ.get('ANTHROPIC_API_KEY'):
    logger.info("ANTHROPIC_API_KEY is available")
else:
    logger.warning("ANTHROPIC_API_KEY is not set - some features may not work")

if os.environ.get('OPENAI_API_KEY'):
    logger.info("OPENAI_API_KEY is available")
else:
    logger.warning("OPENAI_API_KEY is not set - some features may not work")

# Import routes and dependencies
from server.routes import graph, suggestions, websocket
from server.database import init_db, cleanup_pool
from server.graph_manager import graph_manager

class ContentAnalysisRequest(BaseModel):
    """Request model for content analysis."""
    text: str
    images: List[Dict[str, str]] = []

class ErrorResponse(BaseModel):
    """Standard error response model."""
    detail: str

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    try:
        logger.info("Starting FastAPI application...")
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

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors."""
    errors = []
    for error in exc.errors():
        if error["type"] == "missing":
            if "text" in str(error["loc"]):
                errors.append({
                    "loc": error["loc"],
                    "msg": "text field is required",
                    "type": "value_error.missing"
                })
            else:
                errors.append(error)
        else:
            errors.append(error)

    logger.error(f"Validation error: {errors}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": errors}
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions."""
    logger.error(f"HTTP error: {exc.status_code} - {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions."""
    logger.error(f"Unhandled error: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

# Include API routers first
app.include_router(graph.router, prefix="/api")
app.include_router(suggestions.router, prefix="/api")
app.include_router(websocket.router, prefix="/api")

# Define API endpoints
@app.get("/api")
async def root():
    """Root endpoint that provides API information"""
    logger.info("Handling request to API root endpoint")
    return {
        "message": "Knowledge Graph API Server",
        "version": "1.0",
        "endpoints": {
            "/api": "This information",
            "/api/health": "Health check",
            "/api/graph": "Graph data and operations",
            "/api/graph/analyze": "Content analysis endpoint",
            "/api/graph/suggestions": "Graph relationship suggestions",
            "/api/ws": "WebSocket endpoint for real-time updates"
        }
    }

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    logger.info("Handling health check request")
    return {
        "status": "healthy",
        "anthropic_api": bool(os.environ.get('ANTHROPIC_API_KEY')),
        "openai_api": bool(os.environ.get('OPENAI_API_KEY'))
    }

@app.post("/api/graph/analyze")
async def analyze_content_endpoint(request: ContentAnalysisRequest):
    """Content analysis endpoint."""
    try:
        from server.semantic_analysis import analyze_content
        # Check either Anthropic or OpenAI key is available
        if not os.getenv("ANTHROPIC_API_KEY") and not os.getenv("OPENAI_API_KEY"):
            raise HTTPException(
                status_code=400,
                detail="No API keys configured. Set either ANTHROPIC_API_KEY or OPENAI_API_KEY"
            )
        result = await analyze_content(request.dict())
        return result
    except HTTPException as http_ex:
        logger.error(f"HTTP error in analyze_content: {http_ex.detail}")
        raise
    except Exception as e:
        logger.error(f"Error in analyze_content: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

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

@app.websocket("/api/ws")
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

# Mount static files last to avoid conflicts with API routes
# Check if frontend/dist exists before mounting
dist_path = pathlib.Path(__file__).parent.parent / "frontend" / "dist"
if dist_path.exists():
    app.mount("/", StaticFiles(directory=str(dist_path), html=True), name="frontend")
    logger.info(f"Mounted frontend static files from {dist_path}")
else:
    logger.warning("Frontend build directory not found. Static files will not be served.")