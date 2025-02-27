import os
import logging
import pathlib
import networkx as nx
import numpy as np
from scipy import stats
from fastapi import FastAPI, Request, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import Dict, List, Optional, Set
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
from server.models.schemas import Node, Edge, GraphData, GraphMetrics, HubNode, BridgingNode, ScaleFreeness

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

            # Handle WebSocket messages if needed
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

# Function to create a NetworkX graph from GraphData
def create_networkx_graph(graph_data: GraphData) -> nx.Graph:
    logger.info(f"Creating NetworkX graph from input data: {len(graph_data.nodes)} nodes, {len(graph_data.edges)} edges")
    G = nx.Graph()

    # Add nodes with attributes
    for node in graph_data.nodes:
        G.add_node(str(node.id), **node.dict())

    # Add edges with attributes
    for edge in graph_data.edges:
        G.add_edge(str(edge.sourceId), str(edge.targetId), **edge.dict())

    logger.info(f"Created graph with {G.number_of_nodes()} nodes and {G.number_of_edges()} edges")
    return G

# Function to calculate graph metrics
def calculate_metrics(G: nx.Graph) -> GraphMetrics:
    logger.info("Starting metrics calculation")

    if len(G) == 0:
        logger.warning("Empty graph received, returning zero metrics")
        return GraphMetrics(
            betweenness={},
            eigenvector={},
            degree={},
            scaleFreeness=ScaleFreeness(
                powerLawExponent=0.0,
                fitQuality=0.0,
                hubNodes=[],
                bridgingNodes=[]
            )
        )

    # Calculate basic centrality metrics
    logger.info("Calculating centrality metrics")
    betweenness = nx.betweenness_centrality(G)
    try:
        eigenvector = nx.eigenvector_centrality_numpy(G)
    except:
        eigenvector = {node: 0.0 for node in G.nodes()}
    degree = dict(G.degree())

    # Calculate scale-freeness metrics
    logger.info("Calculating scale-freeness metrics")
    degrees = [d for n, d in G.degree()]

    power_law_exp = 0.0
    fit_quality = 0.0

    if len(degrees) > 2:  # Need at least 3 nodes for meaningful power law
        try:
            # Add 1 to handle zero degrees and take log
            degrees = np.array(degrees) + 1
            unique_degrees, degree_counts = np.unique(degrees, return_counts=True)

            # Only proceed if we have enough unique degrees
            if len(unique_degrees) > 1:
                log_degrees = np.log(unique_degrees)
                log_counts = np.log(degree_counts)

                # Linear regression on log-log plot
                slope, intercept, r_value, p_value, std_err = stats.linregress(
                    log_degrees,
                    log_counts
                )

                # Convert to finite values or defaults
                power_law_exp = float(-slope) if not np.isnan(slope) else 0.0
                fit_quality = float(r_value ** 2) if not np.isnan(r_value) else 0.0

                logger.info(f"Power law fit: exponent={power_law_exp:.2f}, quality={fit_quality:.2f}")
        except Exception as e:
            logger.warning(f"Failed to calculate power law fit: {str(e)}")
            power_law_exp = 0.0
            fit_quality = 0.0

    # Identify hub nodes
    mean_degree = np.mean(list(degree.values())) if degree else 0
    hub_nodes = [
        HubNode(
            id=int(node),
            degree=int(degree[node]),
            influence=float(eigenvector[node])
        )
        for node in sorted(degree, key=degree.get, reverse=True)[:5]
        if degree[node] > mean_degree
    ]
    logger.info(f"Identified {len(hub_nodes)} hub nodes")

    # Identify bridging nodes
    mean_betweenness = np.mean(list(betweenness.values())) if betweenness else 0
    bridging_nodes = [
        BridgingNode(
            id=int(node),
            communities=len(list(G.neighbors(node))),
            betweenness=float(betweenness[node])
        )
        for node in sorted(betweenness, key=betweenness.get, reverse=True)[:5]
        if betweenness[node] > mean_betweenness
    ]
    logger.info(f"Identified {len(bridging_nodes)} bridging nodes")

    # Ensure all values are finite for JSON serialization
    metrics = GraphMetrics(
        betweenness={int(k): float(v) for k, v in betweenness.items()},
        eigenvector={int(k): float(v) for k, v in eigenvector.items()},
        degree={int(k): int(v) for k, v in degree.items()},
        scaleFreeness=ScaleFreeness(
            powerLawExponent=power_law_exp,
            fitQuality=fit_quality,
            hubNodes=hub_nodes,
            bridgingNodes=bridging_nodes
        )
    )
    logger.info("Metrics calculation complete")
    return metrics

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