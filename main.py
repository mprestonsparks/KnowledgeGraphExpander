import os
from fastapi import FastAPI, WebSocket, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Dict, List, Optional
import logging
import networkx as nx
import numpy as np
from scipy import stats

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

# Mount the React frontend static files
app.mount("/", StaticFiles(directory="frontend/build", html=True), name="react_frontend")

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

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"Message received: {data}")
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
            "/graph": "Graph analysis service information",
            "/graph/analyze": "Analyze graph metrics",
            "/ws": "WebSocket endpoint for real-time updates"
        }
    }

# Pydantic models for request/response validation
class Node(BaseModel):
    id: int
    label: str
    type: str
    metadata: Optional[Dict] = {}

class Edge(BaseModel):
    sourceId: int
    targetId: int
    label: str
    weight: int = 1
    metadata: Optional[Dict] = {}

class GraphData(BaseModel):
    nodes: List[Node]
    edges: List[Edge]

class HubNode(BaseModel):
    id: int
    degree: int
    influence: float

class BridgingNode(BaseModel):
    id: int
    communities: int
    betweenness: float

class ScaleFreeness(BaseModel):
    powerLawExponent: float
    fitQuality: float
    hubNodes: List[HubNode]
    bridgingNodes: List[BridgingNode]

class GraphMetrics(BaseModel):
    betweenness: Dict[int, float]
    eigenvector: Dict[int, float]
    degree: Dict[int, float]
    scaleFreeness: ScaleFreeness

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    logger.info("Handling health check request")
    return {"status": "healthy"}

@app.get("/graph")
async def get_graph():
    """Get graph analysis service information"""
    logger.info("Handling graph info request")
    return {
        "status": "healthy",
        "version": "1.0",
        "supported_metrics": [
            "betweenness",
            "eigenvector",
            "degree",
            "scale_freeness"
        ]
    }

@app.post("/graph/analyze")
async def analyze_graph(graph_data: GraphData) -> GraphMetrics:
    """Analyze a graph and return its metrics."""
    try:
        logger.info(f"Received graph analysis request: {len(graph_data.nodes)} nodes, {len(graph_data.edges)} edges")
        G = create_networkx_graph(graph_data)
        metrics = calculate_metrics(G)
        logger.info("Graph analysis completed successfully")
        return metrics
    except Exception as e:
        logger.error(f"Error during graph analysis: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

def create_networkx_graph(graph_data: GraphData) -> nx.Graph:
    """Create a NetworkX graph from input data"""
    logger.info(f"Creating NetworkX graph from input data: {len(graph_data.nodes)} nodes, {len(graph_data.edges)} edges")
    G = nx.Graph()

    for node in graph_data.nodes:
        G.add_node(node.id, **node.dict())

    for edge in graph_data.edges:
        G.add_edge(edge.sourceId, edge.targetId, **edge.dict())

    logger.info(f"Created graph with {G.number_of_nodes()} nodes and {G.number_of_edges()} edges")
    return G

def calculate_metrics(G: nx.Graph) -> GraphMetrics:
    """Calculate various graph metrics"""
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

    betweenness = nx.betweenness_centrality(G)
    eigenvector = nx.eigenvector_centrality_numpy(G)
    degree = dict(G.degree())

    degrees = [d for n, d in G.degree()]
    power_law_exp = 0.0
    fit_quality = 0.0

    if len(degrees) > 2:
        try:
            degrees = np.array(degrees) + 1
            unique_degrees, degree_counts = np.unique(degrees, return_counts=True)

            if len(unique_degrees) > 1:
                log_degrees = np.log(unique_degrees)
                log_counts = np.log(degree_counts)
                slope, _, r_value, _, _ = stats.linregress(log_degrees, log_counts)
                power_law_exp = float(-slope) if not np.isnan(slope) else 0.0
                fit_quality = float(r_value ** 2) if not np.isnan(r_value) else 0.0
        except Exception as e:
            logger.warning(f"Failed to calculate power law fit: {str(e)}")

    mean_degree = np.mean(list(degree.values()))
    hub_nodes = [
        HubNode(id=node, degree=degree[node], influence=float(eigenvector[node]))
        for node in sorted(degree, key=degree.get, reverse=True)[:5]
        if degree[node] > mean_degree
    ]

    mean_betweenness = np.mean(list(betweenness.values()))
    bridging_nodes = [
        BridgingNode(
            id=node,
            communities=len(list(G.neighbors(node))),
            betweenness=float(betweenness[node])
        )
        for node in sorted(betweenness, key=betweenness.get, reverse=True)[:5]
        if betweenness[node] > mean_betweenness
    ]

    return GraphMetrics(
        betweenness={k: float(v) for k, v in betweenness.items()},
        eigenvector={k: float(v) for k, v in eigenvector.items()},
        degree={k: int(v) for k, v in degree.items()},
        scaleFreeness=ScaleFreeness(
            powerLawExponent=power_law_exp,
            fitQuality=fit_quality,
            hubNodes=hub_nodes,
            bridgingNodes=bridging_nodes
        )
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 5000))
    logger.info(f"Starting FastAPI server on port {port}")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info",
        access_log=True
    )