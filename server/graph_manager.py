import networkx as nx
import logging
import asyncio
import random
import json
import numpy as np
from scipy import stats
from typing import Dict, List, Optional, Any, Callable, Set
from .models.schemas import (
    Node, Edge, InsertNode, InsertEdge, GraphData, ClusterResult, 
    GraphMetrics, HubNode, BridgingNode, ScaleFreeness
)
from .database import get_full_graph, create_node, create_edge, get_node, get_all_nodes, get_all_edges
from .openai_client import expand_graph, suggest_relationships
from .semantic_clustering import SemanticClusteringService
from .semantic_analysis import analyze_content, validate_relationships

logger = logging.getLogger(__name__)

class GraphManager:
    def __init__(self):
        self.graph = nx.Graph()
        self.is_expanding = False
        self.expand_task = None
        self.current_iteration = 0
        self.max_processing_time = 8  # 8 seconds max processing time
        self.debug_logging = True
        self.semantic_clustering = None
        self.on_update = None

    async def initialize(self):
        """Initialize the graph from the database"""
        try:
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
            logger.error(f"Error initializing graph: {str(e)}")
            return False

    async def get_graph_data(self):
        """Get the complete graph data with metrics and clusters"""
        # If graph is empty, initialize it
        if self.graph.number_of_nodes() == 0:
            await self.initialize()

        # If semantic clustering is not initialized, initialize it
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

        # Get clusters
        clusters = self.semantic_clustering.cluster_nodes()

        # Calculate metrics
        metrics = self.calculate_metrics()

        return {
            "nodes": nodes,
            "edges": edges,
            "clusters": clusters,
            "metrics": metrics
        }

    def calculate_metrics(self):
        """Calculate graph metrics"""
        # Import from app.py to use the existing implementation
        from server.app import calculate_metrics

        # If graph is empty, return empty metrics
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

        # Use the same metrics calculation function from app.py
        return calculate_metrics(self.graph)

    async def expand(self, prompt: str, max_iterations: int = 10):
        """Expand the graph based on a prompt"""
        if self.is_expanding:
            logger.info('Waiting for ongoing expansion to complete')
            if self.expand_task:
                await self.expand_task
            return await self.get_graph_data()

        try:
            self.is_expanding = True
            logger.info(f'Starting expansion with prompt: {prompt}')
            self.current_iteration = 0

            # Start expansion task
            self.expand_task = asyncio.create_task(
                self.perform_iterative_expansion(prompt, max_iterations)
            )

            # Wait for expansion with timeout
            try:
                await asyncio.wait_for(self.expand_task, timeout=self.max_processing_time)
            except asyncio.TimeoutError:
                logger.info('Expansion timed out, returning current state')

            return await self.get_graph_data()
        finally:
            self.is_expanding = False
            self.expand_task = None

    def validate_expansion_data(self, nodes: List[InsertNode], edges: List[InsertEdge]):
        """Validate expansion data"""
        node_labels = {}
        connected_nodes = set()
        valid_nodes = []
        valid_edges = []

        # First pass: collect all proposed nodes and generate IDs if needed
        last_node_id = max([0] + [int(node_id) for node_id in self.graph.nodes])
        for i, node in enumerate(nodes):
            if not node:
                logger.warning('Null node data received')
                continue

            # Generate ID for new nodes if not provided
            node_id = node.get("id") or (last_node_id + i + 1)
            node_label = node.get("label") or f"Node {node_id}"

            node_labels[node_id] = node_label
            valid_nodes.append({
                "id": node_id,
                "label": node_label,
                "type": node.get("type", "concept"),
                "metadata": node.get("metadata", {})
            })

        # Second pass: validate edges and track connected nodes
        for edge in edges:
            if not edge:
                logger.warning('Null edge data received')
                continue

            source_id = str(edge.get("sourceId"))
            target_id = str(edge.get("targetId"))

            if not source_id or not target_id:
                logger.warning(f'Edge missing source or target: {edge}')
                continue

            source_exists = (
                self.graph.has_node(source_id) or 
                any(n["id"] == int(source_id) for n in valid_nodes)
            )
            target_exists = (
                self.graph.has_node(target_id) or 
                any(n["id"] == int(target_id) for n in valid_nodes)
            )

            if source_exists and target_exists:
                valid_edges.append({
                    "sourceId": int(source_id),
                    "targetId": int(target_id),
                    "label": edge.get("label", "related_to"),
                    "weight": edge.get("weight", 1)
                })

                connected_nodes.add(source_id)
                connected_nodes.add(target_id)

        is_valid = bool(valid_nodes) or bool(valid_edges)

        return {
            "isValid": is_valid,
            "connectedNodes": connected_nodes,
            "validNodes": valid_nodes,
            "validEdges": valid_edges
        }

    async def perform_iterative_expansion(self, initial_prompt: str, max_iterations: int):
        """Perform iterative expansion of the graph"""
        current_prompt = initial_prompt
        self.current_iteration = 0
        start_time = asyncio.get_event_loop().time()

        while self.current_iteration < max_iterations:
            if asyncio.get_event_loop().time() - start_time > self.max_processing_time:
                logger.info('Reached processing time limit, stopping expansion')
                break

            try:
                # Expand graph with current prompt
                expansion = await expand_graph(current_prompt, self.graph)

                if not expansion.get("nodes") and not expansion.get("edges"):
                    break

                # Validate expansion data
                validation = self.validate_expansion_data(
                    expansion.get("nodes", []),
                    expansion.get("edges", [])
                )

                if not validation["isValid"]:
                    break

                # Process validated nodes and edges
                has_changes = False

                for node_data in validation["validNodes"]:
                    try:
                        node = await create_node(node_data)
                        if node and not self.graph.has_node(str(node["id"])):
                            self.graph.add_node(str(node["id"]), **node)
                            has_changes = True
                    except Exception as e:
                        logger.error(f'Failed to create node: {e}')

                for edge_data in validation["validEdges"]:
                    try:
                        edge = await create_edge(edge_data)
                        if edge:
                            source_id = str(edge["sourceId"])
                            target_id = str(edge["targetId"])

                            if not self.graph.has_edge(source_id, target_id):
                                self.graph.add_edge(source_id, target_id, **edge)
                                has_changes = True
                    except Exception as e:
                        logger.error(f'Failed to create edge: {e}')

                # If we made changes, emit update
                if has_changes and self.on_update:
                    graph_data = await self.get_graph_data()
                    await self.on_update(graph_data)

                # Get next question
                if expansion.get("nextQuestion"):
                    current_prompt = expansion["nextQuestion"]
                else:
                    break

                self.current_iteration += 1
                await asyncio.sleep(0.1)  # Small delay between iterations
            except Exception as e:
                logger.error(f'Error during iteration: {e}')
                break

    async def recalculate_clusters(self):
        """Force new cluster calculation"""
        self.semantic_clustering = SemanticClusteringService(self.graph)
        return await self.get_graph_data()

    def set_on_update_callback(self, callback):
        """Set callback for graph updates"""
        self.on_update = callback

    def count_disconnected_nodes(self):
        """Count disconnected nodes"""
        count = 0
        for node_id in self.graph.nodes():
            if self.graph.degree(node_id) == 0:
                count += 1
        return count

    async def reconnect_disconnected_nodes(self):
        """Reconnect disconnected nodes"""
        logger.info('Starting reconnection of disconnected nodes')
        disconnected_node_ids = set()

        # Store initial state for verification
        initial_state = {
            "edges": self.graph.number_of_edges(),
            "edge_list": list(self.graph.edges())
        }

        # Identify disconnected nodes
        for node_id in self.graph.nodes():
            if self.graph.degree(node_id) == 0:
                disconnected_node_ids.add(node_id)
                logger.info(f'Found disconnected node: {node_id}')

        if not disconnected_node_ids:
            logger.info('No disconnected nodes found')
            return await self.get_graph_data()

        logger.info(f'Found {len(disconnected_node_ids)} disconnected nodes')

        # Group nodes by type for more meaningful connections
        nodes_by_type = {}
        for node_id in disconnected_node_ids:
            node_type = self.graph.nodes[node_id].get("type", "concept")
            if node_type not in nodes_by_type:
                nodes_by_type[node_type] = []
            nodes_by_type[node_type].append(node_id)

        reconnection_attempts = 0
        reconnected_count = 0

        # Connect nodes of similar types
        for node_type, nodes in nodes_by_type.items():
            logger.info(f'Processing nodes of type: {node_type}')

            for node_id in nodes:
                try:
                    # Find a suitable connected node to link to
                    target_node_id = None
                    for potential_target in self.graph.nodes():
                        if (
                            potential_target not in disconnected_node_ids and
                            self.graph.nodes[potential_target].get("type") == node_type and
                            not target_node_id and
                            potential_target != node_id
                        ):
                            target_node_id = potential_target

                    if target_node_id:
                        reconnection_attempts += 1
                        source_node = self.graph.nodes[node_id]
                        target_node = self.graph.nodes[target_node_id]

                        # Create edge in database first
                        edge = await create_edge({
                            "sourceId": int(node_id),
                            "targetId": int(target_node_id),
                            "label": "related_to",
                            "weight": 1
                        })

                        # Then add edge to graph if it doesn't exist
                        if edge and not self.graph.has_edge(node_id, target_node_id):
                            self.graph.add_edge(node_id, target_node_id, **edge)
                            reconnected_count += 1

                            logger.info(f'Connected nodes: {node_id} to {target_node_id}')
                except Exception as e:
                    logger.error(f'Failed to connect node: {node_id}, {e}')

        # Verify edge preservation
        final_state = {
            "edges": self.graph.number_of_edges(),
            "edge_list": list(self.graph.edges())
        }

        logger.info(f'Reconnection complete: {reconnected_count} nodes reconnected')

        # Calculate final metrics and return
        return await self.get_graph_data()

    async def analyze_content(self, content):
        """Analyze content and extract knowledge graph elements"""
        if self.is_expanding:
            logger.info('Waiting for ongoing expansion to complete')
            if self.expand_task:
                await self.expand_task
            return await self.get_graph_data()

        try:
            self.is_expanding = True
            logger.info(f'Starting semantic expansion with content: {content.get("text")[:50]}...')

            # Get current nodes
            current_nodes = []
            for node_id in self.graph.nodes():
                node_data = self.graph.nodes[node_id]
                node = {
                    "id": int(node_id),
                    "label": node_data.get("label", f"Node {node_id}"),
                    "type": node_data.get("type", "concept"),
                    "metadata": node_data.get("metadata", {})
                }
                current_nodes.append(node)

            # Perform semantic analysis
            analysis_result = await analyze_content(content, current_nodes)

            logger.info(f'Semantic analysis complete: {len(analysis_result["nodes"])} nodes, {len(analysis_result["edges"])} edges')

            # Add new nodes and edges
            for node_data in analysis_result["nodes"]:
                try:
                    node = await create_node(node_data)
                    if node and not self.graph.has_node(str(node["id"])):
                        self.graph.add_node(str(node["id"]), **node)
                except Exception as e:
                    logger.error(f'Failed to create node: {e}')

            for edge_data in analysis_result["edges"]:
                try:
                    edge = await create_edge(edge_data)
                    if edge:
                        source_id = str(edge["sourceId"])
                        target_id = str(edge["targetId"])

                        if not self.graph.has_edge(source_id, target_id):
                            self.graph.add_edge(source_id, target_id, **edge)
                except Exception as e:
                    logger.error(f'Failed to create edge: {e}')

            return await self.get_graph_data()
        finally:
            self.is_expanding = False

    async def get_suggestions(self):
        """Get relationship suggestions"""
        # Get NetworkX graph structure for suggestions
        return await suggest_relationships(self.graph)

    async def apply_suggestion(self, suggestion):
        """Apply a relationship suggestion"""
        edge = await create_edge({
            "sourceId": suggestion.sourceId,
            "targetId": suggestion.targetId,
            "label": suggestion.label,
            "weight": suggestion.weight
        })

        if edge:
            source_id = str(edge["sourceId"])
            target_id = str(edge["targetId"])

            if not self.graph.has_edge(source_id, target_id):
                self.graph.add_edge(source_id, target_id, **edge)

            # Notify about graph update
            if self.on_update:
                graph_data = await self.get_graph_data()
                await self.on_update(graph_data)

        return edge

# Create a singleton instance
graph_manager = GraphManager()