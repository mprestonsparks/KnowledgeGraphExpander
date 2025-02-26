from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional
import networkx as nx
import numpy as np
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
                powerLawExponent=0,
                fitQuality=0,
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

    power_law_exp = 0
    fit_quality = 0

    if len(degrees) > 1:
        degrees = np.array(degrees) + 1  # Avoid log(0)
        log_degrees = np.log(degrees)
        log_counts = np.log(np.bincount(degrees)[1:])
        mask = (log_degrees > 0) & (log_counts > 0)
        if any(mask):
            slope, intercept, r_value, p_value, std_err = stats.linregress(
                log_degrees[mask],
                log_counts[mask]
            )
            power_law_exp = -slope
            fit_quality = r_value ** 2
            logger.info(f"Power law fit: exponent={power_law_exp:.2f}, quality={fit_quality:.2f}")

    # Identify hub nodes
    mean_degree = np.mean(list(degree.values()))
    hub_nodes = [
        HubNode(
            id=node,
            degree=degree[node],
            influence=eigenvector[node]
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
            betweenness=betweenness[node]
        )
        for node in sorted(betweenness, key=betweenness.get, reverse=True)[:5]
        if betweenness[node] > mean_betweenness
    ]
    logger.info(f"Identified {len(bridging_nodes)} bridging nodes")

    metrics = GraphMetrics(
        betweenness=betweenness,
        eigenvector=eigenvector,
        degree=degree,
        scaleFreeness=ScaleFreeness(
            powerLawExponent=float(power_law_exp),
            fitQuality=float(fit_quality),
            hubNodes=hub_nodes,
            bridgingNodes=bridging_nodes
        )
    )
    logger.info("Metrics calculation complete")
    return metrics

@app.post("/api/graph/analyze")
async def analyze_graph(graph_data: GraphData) -> GraphMetrics:
    try:
        logger.info(f"Received graph analysis request: {len(graph_data.nodes)} nodes, {len(graph_data.edges)} edges")
        G = create_networkx_graph(graph_data)
        metrics = calculate_metrics(G)
        logger.info("Graph analysis completed successfully")
        return metrics
    except Exception as e:
        logger.error(f"Error during graph analysis: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# Health check endpoint
@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}