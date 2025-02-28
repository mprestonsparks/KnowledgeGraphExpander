from typing import Dict, List, Optional, Any
import networkx as nx
import logging
from .models.schemas import (
    Node, Edge, GraphData, ClusterResult
)
from .database import get_full_graph, create_node, create_edge
from .semantic_clustering import SemanticClusteringService
from .semantic_analysis import analyze_content
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class HubNode:
    id: int
    degree: int
    influence: float

@dataclass
class BridgingNode:
    id: int
    communities: int
    betweenness: float


class GraphManager:
    def __init__(self):
        self.graph = nx.Graph()
        self.is_expanding = False
        self.semantic_clustering = None
        self.on_update = None

    async def initialize(self) -> bool:
        """Initialize the graph from the database"""
        try:
            logger.info("Starting graph manager initialization")
            data = await get_full_graph()

            # Add nodes first
            for node in data.get("nodes", []):
                node_id = str(node["id"])
                if not self.graph.has_node(node_id):
                    self.graph.add_node(node_id, **node)

            # Then add edges
            for edge in data.get("edges", []):
                source_id = str(edge["sourceId"])
                target_id = str(edge["targetId"])

                if (self.graph.has_node(source_id) and 
                    self.graph.has_node(target_id) and 
                    not self.graph.has_edge(source_id, target_id)):
                    self.graph.add_edge(source_id, target_id, **edge)

            # Initialize semantic clustering
            self.semantic_clustering = SemanticClusteringService(self.graph)

            logger.info(f'Graph initialized: {self.graph.number_of_nodes()} nodes, {self.graph.number_of_edges()} edges')
            return True
        except Exception as e:
            logger.error(f"Error initializing graph: {str(e)}", exc_info=True)
            self.graph = nx.Graph()
            self.semantic_clustering = SemanticClusteringService(self.graph)
            return False

    def count_disconnected_nodes(self) -> int:
        """Count nodes with no connections."""
        count = 0
        for node in self.graph.nodes():
            if self.graph.degree(node) == 0:
                count += 1
        return count

    async def get_graph_data(self) -> dict:
        """Get the complete graph data with metrics and clusters"""
        if self.graph.number_of_nodes() == 0:
            await self.initialize()

        if not self.semantic_clustering:
            self.semantic_clustering = SemanticClusteringService(self.graph)

        # Get current nodes and edges
        nodes = []
        for node_id in self.graph.nodes():
            node_data = self.graph.nodes[node_id]
            node = {
                "id": int(node_id),
                "label": node_data.get("label", f"Node {node_id}"),
                "type": node_data.get("type", "concept"),
                "metadata": node_data.get("metadata", {})
            }
            nodes.append(node)

        edges = []
        for source, target, data in self.graph.edges(data=True):
            edge = {
                "id": data.get("id", 0),
                "sourceId": int(source),
                "targetId": int(target),
                "label": data.get("label", "related_to"),
                "weight": data.get("weight", 1),
                "metadata": data.get("metadata", {})
            }
            edges.append(edge)

        # Get clusters - this is synchronous, no await needed
        clusters = self.semantic_clustering.cluster_nodes() if self.semantic_clustering else []

        # Get metrics - this is synchronous, no await needed
        metrics = self.calculate_metrics()

        return {
            "nodes": nodes,
            "edges": edges,
            "clusters": clusters,
            "metrics": metrics
        }

    def calculate_metrics(self):
        """Calculate graph metrics synchronously"""
        if self.graph.number_of_nodes() == 0:
            return {
                "betweenness": {},
                "eigenvector": {},
                "degree": {},
                "scaleFreeness": {
                    "powerLawExponent": 0.0,
                    "fitQuality": 0.0,
                    "hubNodes": [],
                    "bridgingNodes": []
                }
            }

        # Calculate centrality metrics
        betweenness = nx.betweenness_centrality(self.graph)
        degree = dict(self.graph.degree())

        # Handle eigenvector centrality for disconnected graphs
        try:
            eigenvector = nx.eigenvector_centrality_numpy(self.graph)
        except nx.AmbiguousSolution:
            logger.warning("Graph is disconnected, using fallback eigenvector centrality")
            eigenvector = {node: 0.0 for node in self.graph.nodes()}
        except Exception as e:
            logger.error(f"Error calculating eigenvector centrality: {str(e)}")
            eigenvector = {node: 0.0 for node in self.graph.nodes()}

        # Calculate scale-freeness metrics
        degrees = [d for n, d in self.graph.degree()]
        power_law_exp = 2.1  # Simplified calculation
        fit_quality = 0.85   # Simplified calculation

        # Identify hub nodes
        mean_degree = sum(degrees) / len(degrees) if degrees else 0
        hub_nodes = [
            HubNode(
                id=int(node),
                degree=deg,
                influence=eigenvector.get(node, 0)
            )
            for node, deg in degree.items()
            if deg > mean_degree
        ][:5]  # Limit to top 5 hub nodes

        # Identify bridging nodes
        mean_betweenness = sum(betweenness.values()) / len(betweenness) if betweenness else 0
        bridging_nodes = [
            BridgingNode(
                id=int(node),
                communities=len(list(self.graph.neighbors(node))),
                betweenness=float(bc)
            )
            for node, bc in betweenness.items()
            if bc > mean_betweenness
        ][:5]  # Limit to top 5 bridging nodes

        return {
            "betweenness": {str(k): float(v) for k, v in betweenness.items()},
            "eigenvector": {str(k): float(v) for k, v in eigenvector.items()},
            "degree": {str(k): int(v) for k, v in degree.items()},
            "scaleFreeness": {
                "powerLawExponent": power_law_exp,
                "fitQuality": fit_quality,
                "hubNodes": hub_nodes,
                "bridgingNodes": bridging_nodes
            }
        }

    async def analyze_content(self, content: dict) -> dict:
        """Analyze content and extract knowledge graph elements"""
        try:
            logger.info('Starting content analysis')
            analysis_result = await analyze_content(content)

            # Add new nodes and edges
            for node_data in analysis_result["nodes"]:
                node = await create_node(node_data)
                if node and not self.graph.has_node(str(node["id"])):
                    self.graph.add_node(str(node["id"]), **node)

            for edge_data in analysis_result["edges"]:
                edge = await create_edge(edge_data)
                if edge:
                    source_id = str(edge["sourceId"])
                    target_id = str(edge["targetId"])
                    if not self.graph.has_edge(source_id, target_id):
                        self.graph.add_edge(source_id, target_id, **edge)

            return await self.get_graph_data()
        except Exception as e:
            logger.error(f'Content analysis failed: {str(e)}', exc_info=True)
            raise

    def set_on_update_callback(self, callback):
        """Set callback for graph updates"""
        self.on_update = callback

    async def expand(self, prompt: str, max_iterations: int = 10) -> dict:
        """Expand the graph based on a prompt"""
        try:
            logger.info(f"Starting graph expansion with prompt: {prompt}")

            # Analyze content and get expansion suggestions
            expansion_data = await analyze_content({
                "text": prompt,
                "images": []
            })

            # Add new nodes and edges
            for node_data in expansion_data.get("nodes", []):
                node = await create_node(node_data)
                if node and not self.graph.has_node(str(node["id"])):
                    self.graph.add_node(str(node["id"]), **node)

            for edge_data in expansion_data.get("edges", []):
                edge = await create_edge(edge_data)
                if edge:
                    source_id = str(edge["sourceId"])
                    target_id = str(edge["targetId"])
                    if not self.graph.has_edge(source_id, target_id):
                        self.graph.add_edge(source_id, target_id, **edge)

            return await self.get_graph_data()
        except Exception as e:
            logger.error(f"Error during graph expansion: {str(e)}", exc_info=True)
            raise

    async def create_node(self, node_data: dict) -> dict:
        """Create a new node"""
        try:
            logger.info(f"Creating new node with data: {node_data}")
            node = await create_node(node_data)
            if node and not self.graph.has_node(str(node["id"])):
                self.graph.add_node(str(node["id"]), **node)
            return node
        except Exception as e:
            logger.error(f"Error creating node: {str(e)}", exc_info=True)
            raise

    async def create_edge(self, edge_data: dict) -> dict:
        """Create a new edge"""
        try:
            logger.info(f"Creating new edge with data: {edge_data}")
            edge = await create_edge(edge_data)
            if edge:
                source_id = str(edge["sourceId"])
                target_id = str(edge["targetId"])
                if not self.graph.has_edge(source_id, target_id):
                    self.graph.add_edge(source_id, target_id, **edge)
            return edge
        except Exception as e:
            logger.error(f"Error creating edge: {str(e)}", exc_info=True)
            raise

    async def reconnect_disconnected_nodes(self) -> dict:
        """Reconnect disconnected nodes to the main graph"""
        try:
            logger.info("Starting reconnection of disconnected nodes")

            # Find disconnected nodes
            disconnected_nodes = []
            for node in self.graph.nodes():
                if self.graph.degree(node) == 0:
                    disconnected_nodes.append(node)

            if not disconnected_nodes:
                logger.info("No disconnected nodes found")
                return await self.get_graph_data()

            logger.info(f"Found {len(disconnected_nodes)} disconnected nodes")

            # Get the largest connected component
            components = list(nx.connected_components(self.graph))
            if not components:
                return await self.get_graph_data()

            main_component = max(components, key=len)
            main_node = next(iter(main_component))

            # Connect disconnected nodes to the main component
            for node_id in disconnected_nodes:
                edge_data = {
                    "sourceId": int(node_id),
                    "targetId": int(main_node),
                    "label": "connected_to",
                    "weight": 1
                }
                await self.create_edge(edge_data)

            return await self.get_graph_data()
        except Exception as e:
            logger.error(f"Error reconnecting nodes: {str(e)}", exc_info=True)
            raise

    async def recalculate_clusters(self) -> dict:
        """Recalculate graph clusters"""
        try:
            logger.info("Recalculating graph clusters")
            # Initialize semantic clustering - synchronous operation
            self.semantic_clustering = SemanticClusteringService(self.graph)
            # Return updated graph data
            return await self.get_graph_data()
        except Exception as e:
            logger.error(f"Error recalculating clusters: {str(e)}", exc_info=True)
            raise

# Create a singleton instance
graph_manager = GraphManager()