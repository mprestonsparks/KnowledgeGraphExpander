import os
import json
import logging
import networkx as nx
import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, List, Any, Tuple, Optional
from collections import defaultdict

# Configure logging
logger = logging.getLogger(__name__)

class GraphEvolutionTracker:
    """
    Tracks the temporal evolution of the knowledge graph.
    Implements the temporal evolution tracking feature from the paper.
    """
    
    def __init__(self, history_path: str = "./graph_history"):
        """
        Initialize the graph evolution tracker.
        
        Args:
            history_path: Directory to store evolution history snapshots
        """
        self.history_path = history_path
        self.snapshots = []
        self.metrics_history = defaultdict(list)
        self.creation_timestamps = {}  # Tracks when nodes and edges were created
        self.feedback_history = []
        
        # Create history directory if it doesn't exist
        os.makedirs(history_path, exist_ok=True)
        
    def create_snapshot(self, graph: nx.Graph, metadata: Dict = None) -> str:
        """
        Create a snapshot of the current graph state.
        
        Args:
            graph: The current graph
            metadata: Additional information about this snapshot
            
        Returns:
            Snapshot ID
        """
        timestamp = datetime.now().isoformat()
        snapshot_id = f"snapshot_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # Create the snapshot data
        snapshot = {
            "id": snapshot_id,
            "timestamp": timestamp,
            "metadata": metadata or {},
            "nodes": len(graph.nodes()),
            "edges": len(graph.edges()),
            "graph_data": self._serialize_graph(graph)
        }
        
        # Save the snapshot
        snapshot_path = os.path.join(self.history_path, f"{snapshot_id}.json")
        with open(snapshot_path, "w") as f:
            json.dump(snapshot, f, indent=2)
            
        # Update the in-memory snapshot reference
        self.snapshots.append({
            "id": snapshot_id,
            "timestamp": timestamp,
            "nodes": len(graph.nodes()),
            "edges": len(graph.edges()),
            "metadata": metadata or {}
        })
        
        logger.info(f"Created graph snapshot: {snapshot_id}")
        return snapshot_id
    
    def _serialize_graph(self, graph: nx.Graph) -> Dict:
        """Serialize a NetworkX graph to a JSON-compatible dict"""
        return {
            "nodes": [
                {
                    "id": node_id,
                    "attributes": dict(graph.nodes[node_id])
                } for node_id in graph.nodes()
            ],
            "edges": [
                {
                    "source": u,
                    "target": v,
                    "attributes": dict(data)
                } for u, v, data in graph.edges(data=True)
            ]
        }
    
    def record_node_creation(self, node_id: str, metadata: Dict = None) -> None:
        """Record when a node was created"""
        timestamp = datetime.now().isoformat()
        self.creation_timestamps[f"node_{node_id}"] = {
            "timestamp": timestamp,
            "type": "node",
            "metadata": metadata or {}
        }
    
    def record_edge_creation(self, source: str, target: str, metadata: Dict = None) -> None:
        """Record when an edge was created"""
        timestamp = datetime.now().isoformat()
        edge_id = f"{source}_{target}"
        self.creation_timestamps[f"edge_{edge_id}"] = {
            "timestamp": timestamp,
            "type": "edge",
            "source": source,
            "target": target,
            "metadata": metadata or {}
        }
    
    def save_metrics(self, metrics: Dict[str, Any]) -> None:
        """
        Save current graph metrics.
        
        Args:
            metrics: Dictionary of metrics to save
        """
        timestamp = datetime.now().isoformat()
        
        # Add timestamp to metrics
        metrics_with_time = metrics.copy()
        metrics_with_time["timestamp"] = timestamp
        
        # Update history
        for key, value in metrics.items():
            if isinstance(value, (int, float)):
                self.metrics_history[key].append((timestamp, value))
        
        # Save to disk
        metrics_path = os.path.join(self.history_path, "metrics_history.jsonl")
        with open(metrics_path, "a") as f:
            f.write(json.dumps(metrics_with_time) + "\n")
            
        logger.info(f"Saved metrics snapshot with {len(metrics)} values")
    
    def get_metric_trends(self, metric_name: str, last_n: int = None) -> List[Tuple[str, float]]:
        """Get the historical values of a specific metric"""
        values = self.metrics_history.get(metric_name, [])
        if last_n is not None:
            values = values[-last_n:]
        return values
    
    def analyze_growth_rate(self) -> Dict[str, Any]:
        """
        Analyze the growth rate of the graph over time.
        
        Returns:
            Dict with growth metrics
        """
        # Extract node and edge counts from snapshots
        timestamps = []
        node_counts = []
        edge_counts = []
        
        for snapshot in self.snapshots:
            timestamps.append(datetime.fromisoformat(snapshot["timestamp"]))
            node_counts.append(snapshot["nodes"])
            edge_counts.append(snapshot["edges"])
            
        if len(timestamps) < 2:
            return {
                "node_growth_rate": None,
                "edge_growth_rate": None,
                "enough_data": False
            }
            
        # Convert to numpy arrays for analysis
        timestamps_seconds = np.array([(ts - timestamps[0]).total_seconds() for ts in timestamps])
        nodes = np.array(node_counts)
        edges = np.array(edge_counts)
        
        # Calculate growth rates (nodes and edges per hour)
        if len(timestamps) >= 2:
            hours_elapsed = (timestamps[-1] - timestamps[0]).total_seconds() / 3600
            if hours_elapsed > 0:
                node_growth_rate = (nodes[-1] - nodes[0]) / hours_elapsed
                edge_growth_rate = (edges[-1] - edges[0]) / hours_elapsed
                
                # Power law fit for scale-free analysis
                if len(timestamps) >= 3 and timestamps_seconds[-1] > 0:
                    # Normalize time for better fit
                    norm_time = timestamps_seconds / timestamps_seconds[-1]
                    # Avoid log(0)
                    norm_time = np.maximum(norm_time, 1e-10)
                    
                    try:
                        # For node growth: N(t) ∝ t^α
                        node_coef = np.polyfit(np.log(norm_time), np.log(nodes), 1)
                        node_power_law_exponent = node_coef[0]
                        
                        # For edge growth: E(t) ∝ t^β
                        edge_coef = np.polyfit(np.log(norm_time), np.log(edges), 1)
                        edge_power_law_exponent = edge_coef[0]
                    except:
                        # Fallback if fit fails
                        node_power_law_exponent = None
                        edge_power_law_exponent = None
                else:
                    node_power_law_exponent = None
                    edge_power_law_exponent = None
                    
                return {
                    "node_growth_rate": node_growth_rate,
                    "edge_growth_rate": edge_growth_rate,
                    "node_power_law_exponent": node_power_law_exponent,
                    "edge_power_law_exponent": edge_power_law_exponent,
                    "enough_data": True,
                    "hours_tracked": hours_elapsed,
                    "snapshots_count": len(timestamps)
                }
        
        return {
            "node_growth_rate": None,
            "edge_growth_rate": None,
            "enough_data": False
        }
        
    def analyze_hub_formation(self, graph: nx.Graph, top_n: int = 5) -> Dict[str, Any]:
        """
        Analyze how hubs have formed over time.
        
        Args:
            graph: Current graph
            top_n: Number of top hubs to analyze
            
        Returns:
            Dict with hub formation metrics
        """
        # Get node degrees
        degrees = dict(graph.degree())
        # Sort nodes by degree (highest first)
        hub_nodes = sorted(degrees.items(), key=lambda x: x[1], reverse=True)[:top_n]
        
        hub_analysis = []
        for node_id, degree in hub_nodes:
            # Get node creation timestamp
            node_created = self.creation_timestamps.get(f"node_{node_id}", {}).get("timestamp")
            
            # Get connected edges and their creation times
            edge_formation = []
            for neighbor in graph.neighbors(node_id):
                edge_id = f"{node_id}_{neighbor}"
                alt_edge_id = f"{neighbor}_{node_id}"
                
                # Check both possible edge directions
                edge_data = self.creation_timestamps.get(f"edge_{edge_id}")
                if not edge_data:
                    edge_data = self.creation_timestamps.get(f"edge_{alt_edge_id}")
                    
                if edge_data:
                    edge_formation.append({
                        "neighbor": neighbor,
                        "created_at": edge_data.get("timestamp")
                    })
            
            # Get node attributes
            node_attrs = graph.nodes[node_id]
            
            hub_analysis.append({
                "node_id": node_id,
                "degree": degree,
                "label": node_attrs.get("label", f"Node {node_id}"),
                "type": node_attrs.get("type", "concept"),
                "created_at": node_created,
                "connections_count": len(edge_formation),
                "connection_sample": edge_formation[:5]  # Sample of connections
            })
            
        return {
            "top_hubs": hub_analysis,
            "analysis_time": datetime.now().isoformat()
        }

    def record_feedback(self, source: str, feedback_type: str, data: Dict) -> None:
        """
        Record feedback about the graph evolution.
        Used in the feedback loop mechanism.
        
        Args:
            source: Source of the feedback (user, agent, system)
            feedback_type: Type of feedback (quality, relevance, suggestion)
            data: Feedback data
        """
        timestamp = datetime.now().isoformat()
        feedback = {
            "timestamp": timestamp,
            "source": source,
            "type": feedback_type,
            "data": data
        }
        
        # Save to memory
        self.feedback_history.append(feedback)
        
        # Save to disk
        feedback_path = os.path.join(self.history_path, "feedback_history.jsonl")
        with open(feedback_path, "a") as f:
            f.write(json.dumps(feedback) + "\n")
            
        logger.info(f"Recorded {feedback_type} feedback from {source}")
        
    def get_recent_feedback(self, limit: int = 10) -> List[Dict]:
        """Get the most recent feedback entries"""
        return self.feedback_history[-limit:] if self.feedback_history else []

class FeedbackLoopManager:
    """
    Implements the feedback loop mechanism using Buehler's (2025) formula R_{i+1}=f_{eval}(R_i,F_i).
    
    This mechanism refines the graph expansion process based on quality metrics and feedback.
    """
    
    def __init__(self, evolution_tracker: GraphEvolutionTracker):
        """
        Initialize the feedback loop manager.
        
        Args:
            evolution_tracker: The graph evolution tracker
        """
        self.evolution_tracker = evolution_tracker
        self.loop_iterations = 0
        self.last_reasoning_state = {}
        
    def evaluate_expansion(self, 
                          graph: nx.Graph, 
                          previous_nodes_count: int,
                          new_nodes: List[Dict],
                          new_edges: List[Dict],
                          reasoning_process: Dict) -> Dict[str, Any]:
        """
        Evaluate the quality of a graph expansion.
        
        Args:
            graph: Current graph after expansion
            previous_nodes_count: Number of nodes before expansion
            new_nodes: Newly added nodes
            new_edges: Newly added edges
            reasoning_process: The reasoning process that led to this expansion
            
        Returns:
            Dict with evaluation metrics
        """
        # Track metrics
        nodes_added = len(new_nodes)
        edges_added = len(new_edges)
        current_nodes = len(graph.nodes())
        current_edges = len(graph.edges())
        
        # Calculate connectivity metrics
        if nodes_added > 0:
            edges_per_new_node = edges_added / nodes_added
        else:
            edges_per_new_node = 0
            
        # Calculate graph density before and after
        if current_nodes > 1:
            current_density = 2 * current_edges / (current_nodes * (current_nodes - 1))
        else:
            current_density = 0
            
        if previous_nodes_count > 1:
            previous_density = 2 * (current_edges - edges_added) / (previous_nodes_count * (previous_nodes_count - 1))
        else:
            previous_density = 0
            
        density_change = current_density - previous_density
        
        # Basic semantic quality heuristics (more sophisticated metrics would be added in a real implementation)
        node_type_diversity = len(set(node.get("type", "") for node in new_nodes))
        edge_label_diversity = len(set(edge.get("label", "") for edge in new_edges))
        
        # Store the evaluation
        evaluation = {
            "timestamp": datetime.now().isoformat(),
            "nodes_added": nodes_added,
            "edges_added": edges_added,
            "edges_per_new_node": edges_per_new_node,
            "density_change": density_change,
            "node_type_diversity": node_type_diversity,
            "edge_label_diversity": edge_label_diversity,
            "iteration": self.loop_iterations
        }
        
        # Record the evaluation as feedback
        self.evolution_tracker.record_feedback(
            source="system", 
            feedback_type="expansion_evaluation", 
            data=evaluation
        )
        
        # Store the reasoning state for the next iteration
        self.last_reasoning_state = {
            "reasoning_process": reasoning_process,
            "evaluation": evaluation
        }
        
        self.loop_iterations += 1
        return evaluation
    
    def generate_improvement_prompts(self, evaluation: Dict[str, Any]) -> List[str]:
        """
        Generate improvement prompts based on the evaluation.
        
        Args:
            evaluation: The evaluation metrics
            
        Returns:
            List of improvement prompts
        """
        prompts = []
        
        # Low connectivity
        if evaluation.get("edges_per_new_node", 0) < 1.5:
            prompts.append(
                "The recent expansion added nodes with relatively few connections. " +
                "In the next iteration, focus on increasing connectivity between concepts."
            )
            
        # Low diversity
        if evaluation.get("node_type_diversity", 0) < 2:
            prompts.append(
                "The recent expansion lacks diversity in node types. " +
                "Try to add different types of nodes (concepts, entities, processes, attributes)."
            )
            
        if evaluation.get("edge_label_diversity", 0) < 2:
            prompts.append(
                "The recent expansion uses limited relationship types. " +
                "Try to identify more nuanced relationships between concepts."
            )
            
        # Density feedback
        if evaluation.get("density_change", 0) < 0:
            prompts.append(
                "The graph density has decreased. " +
                "Consider adding more connections between existing nodes."
            )
            
        # Default prompt if no specific issues
        if not prompts:
            prompts.append(
                "The recent expansion was balanced. " +
                "Continue to develop the knowledge graph with a focus on quality and relevance."
            )
            
        return prompts
    
    def refine_expansion_strategy(self, 
                                 base_prompt: str, 
                                 current_graph: nx.Graph) -> str:
        """
        Refine the expansion strategy based on feedback and evaluation.
        Implements Buehler's (2025) iterative refinement formula R_{i+1}=f_{eval}(R_i,F_i).
        
        Args:
            base_prompt: The original expansion prompt
            current_graph: The current graph
            
        Returns:
            Refined prompt for the next expansion iteration
        """
        # Get recent feedback
        recent_feedback = self.evolution_tracker.get_recent_feedback(5)
        
        # Generate improvement prompts
        improvement_prompts = []
        
        for feedback in recent_feedback:
            if feedback["type"] == "expansion_evaluation":
                eval_data = feedback["data"]
                improvement_prompts.extend(self.generate_improvement_prompts(eval_data))
                
        # Get up to 2 most recent improvement suggestions
        improvement_suggestions = improvement_prompts[-2:] if improvement_prompts else []
        
        # Construct the refined prompt
        if improvement_suggestions:
            refined_prompt = f"{base_prompt}\n\nAdditional guidance based on feedback:\n"
            for idx, suggestion in enumerate(improvement_suggestions, 1):
                refined_prompt += f"{idx}. {suggestion}\n"
        else:
            refined_prompt = base_prompt
            
        return refined_prompt