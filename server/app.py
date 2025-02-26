import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional
import networkx as nx
from scipy import stats
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

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
    """
    Health check endpoint to verify the service is running.
    """
    return {"status": "healthy"}

@app.get("/graph")
async def get_graph():
    """
    Get basic graph information and health status.
    This endpoint is used to verify the graph analysis service is functioning.
    """
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
    """
    Analyze a graph and return its metrics.
    Accepts a graph structure and returns various network analysis metrics.
    """
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
    logger.info(f"Creating NetworkX graph from input data: {len(graph_data.nodes)} nodes, {len(graph_data.edges)} edges")
    G = nx.Graph()

    # Add nodes with attributes
    for node in graph_data.nodes:
        G.add_node(node.id, **node.dict())

    # Add edges with attributes
    for edge in graph_data.edges:
        G.add_edge(edge.sourceId, edge.targetId, **edge.dict())

    logger.info(f"Created graph with {G.number_of_nodes()} nodes and {G.number_of_edges()} edges")
    return G

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
    eigenvector = nx.eigenvector_centrality_numpy(G)
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
    mean_degree = np.mean(list(degree.values()))
    hub_nodes = [
        HubNode(
            id=node,
            degree=degree[node],
            influence=float(eigenvector[node])  # Ensure float is finite
        )
        for node in sorted(degree, key=degree.get, reverse=True)[:5]
        if degree[node] > mean_degree
    ]
    logger.info(f"Identified {len(hub_nodes)} hub nodes")

    # Identify bridging nodes
    mean_betweenness = np.mean(list(betweenness.values()))
    bridging_nodes = [
        BridgingNode(
            id=node,
            communities=len(list(G.neighbors(node))),
            betweenness=float(betweenness[node])  # Ensure float is finite
        )
        for node in sorted(betweenness, key=betweenness.get, reverse=True)[:5]
        if betweenness[node] > mean_betweenness
    ]
    logger.info(f"Identified {len(bridging_nodes)} bridging nodes")

    # Ensure all values are finite for JSON serialization
    metrics = GraphMetrics(
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
    logger.info("Metrics calculation complete")
    return metrics