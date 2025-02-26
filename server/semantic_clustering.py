import logging
import networkx as nx
from typing import Dict, List, Any, Optional, Set
from sklearn.cluster import AgglomerativeClustering
import numpy as np

logger = logging.getLogger(__name__)


class SemanticClusteringService:

    def __init__(self, graph):
        self.graph = graph

    def calculate_node_similarity(self, node1, node2):
        """Calculate similarity between two nodes"""
        similarity = 0

        # Get node attributes
        node1_attrs = self.graph.nodes[node1]
        node2_attrs = self.graph.nodes[node2]

        # Type similarity has the highest weight (0.9)
        if node1_attrs.get("type") == node2_attrs.get("type"):
            similarity += 0.9

        # Label similarity check
        label1 = node1_attrs.get("label", "").lower()
        label2 = node2_attrs.get("label", "").lower()

        if label1 == label2:
            similarity += 0.4  # Exact match bonus
        elif label1 in label2 or label2 in label1:
            similarity += 0.3  # Partial match
        elif label1.split(' ')[0] == label2.split(' ')[0]:
            similarity += 0.2  # Same prefix

        # Connected nodes get a higher bonus
        if self.graph.has_edge(node1, node2) or self.graph.has_edge(
                node2, node1):
            similarity += 0.4

        # Normalize to [0,1]
        return min(1, similarity)

    def find_cluster_centroid(self, nodes):
        """Find the centroid node of a cluster"""
        max_degree = -1
        centroid = nodes[0] if nodes else None

        for node_id in nodes:
            degree = self.graph.degree(node_id)
            if degree > max_degree:
                max_degree = degree
                centroid = node_id

        return centroid

    def infer_cluster_theme(self, nodes):
        """Infer the theme of a cluster"""
        type_counts = {}

        for node_id in nodes:
            node_type = self.graph.nodes[node_id].get("type", "concept")
            if node_type not in type_counts:
                type_counts[node_type] = 0
            type_counts[node_type] += 1

        max_count = 0
        dominant_type = "concept"  # Default

        for node_type, count in type_counts.items():
            if count > max_count:
                max_count = count
                dominant_type = node_type

        return f"{dominant_type} cluster"

    def calculate_cluster_coherence(self, nodes):
        """Calculate the coherence of a cluster"""
        total_similarity = 0
        pair_count = 0

        for i in range(len(nodes)):
            for j in range(i + 1, len(nodes)):
                similarity = self.calculate_node_similarity(nodes[i], nodes[j])
                total_similarity += similarity
                pair_count += 1

        return total_similarity / pair_count if pair_count > 0 else 0

    def cluster_nodes(self):
        """Cluster nodes in the graph"""
        logger.info('Starting clustering process...')
        clusters = []
        visited = set()

        # In NetworkX, we can use connected_components for undirected graphs
        components = list(nx.connected_components(self.graph))

        logger.info(f'Found {len(components)} connected components')

        for i, component in enumerate(components):
            # Skip already visited nodes
            unvisited_nodes = [
                node for node in component if node not in visited
            ]
            if not unvisited_nodes:
                continue

            # Mark nodes as visited
            for node in unvisited_nodes:
                visited.add(node)

            centroid_node = self.find_cluster_centroid(unvisited_nodes)
            semantic_theme = self.infer_cluster_theme(unvisited_nodes)
            coherence_score = self.calculate_cluster_coherence(unvisited_nodes)

            cluster = {
                "clusterId": i,
                "nodes": unvisited_nodes,
                "metadata": {
                    "centroidNode": centroid_node,
                    "semanticTheme": semantic_theme,
                    "coherenceScore": coherence_score
                }
            }

            logger.info(
                f'Created cluster: {i}, nodes: {len(unvisited_nodes)}, theme: {semantic_theme}'
            )

            clusters.append(cluster)

        # Sort clusters by size and coherence
        sorted_clusters = sorted(
            clusters,
            key=lambda c: len(c["nodes"]) * c["metadata"]["coherenceScore"],
            reverse=True)

        logger.info(
            f'Final clustering results: {len(sorted_clusters)} clusters')

        # Convert to proper format for return
        formatted_clusters = []
        for cluster in sorted_clusters:
            formatted_clusters.append({
                "clusterId":
                cluster["clusterId"],
                "nodes": [str(n) for n in cluster["nodes"]],
                "metadata":
                cluster["metadata"]
            })

        return formatted_clusters
