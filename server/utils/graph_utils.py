import logging
import networkx as nx
import numpy as np
from scipy import stats
from typing import Dict, List
from server.models.schemas import Node, Edge, GraphData, GraphMetrics, HubNode, BridgingNode, ScaleFreeness

logger = logging.getLogger(__name__)

def create_networkx_graph(graph_data: GraphData) -> nx.Graph:
    """Create a NetworkX graph from GraphData"""
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

def calculate_metrics(G: nx.Graph) -> GraphMetrics:
    """Calculate graph metrics"""
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
    return GraphMetrics(
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
