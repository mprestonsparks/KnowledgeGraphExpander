import { type Node } from "@shared/schema";
import { type Graph } from "graphology";

export interface ClusterMetadata {
  centroidNode: string;
  semanticTheme: string;
  coherenceScore: number;
}

export interface ClusterResult {
  clusterId: number;
  nodes: string[];
  metadata: ClusterMetadata;
}

export class SemanticClusteringService {
  private graph: Graph;

  constructor(graph: Graph) {
    this.graph = graph;
  }

  private calculateNodeSimilarity(node1: Node, node2: Node): number {
    // For now, use simple type-based similarity
    // Will be enhanced with embeddings later
    if (node1.type === node2.type) {
      return 0.8;
    }
    return 0.2;
  }

  private findClusterCentroid(nodes: string[]): string {
    // Use betweenness centrality to find the most central node
    let maxBetweenness = -1;
    let centroid = nodes[0];

    nodes.forEach(nodeId => {
      const betweenness = this.graph.betweennessCentrality(nodeId);
      if (betweenness > maxBetweenness) {
        maxBetweenness = betweenness;
        centroid = nodeId;
      }
    });

    return centroid;
  }

  private inferClusterTheme(nodes: string[]): string {
    // Get the most common node type in the cluster
    const typeCounts = new Map<string, number>();
    
    nodes.forEach(nodeId => {
      const nodeType = this.graph.getNodeAttribute(nodeId, "type");
      typeCounts.set(nodeType, (typeCounts.get(nodeType) || 0) + 1);
    });

    let maxCount = 0;
    let dominantType = "";
    typeCounts.forEach((count, type) => {
      if (count > maxCount) {
        maxCount = count;
        dominantType = type;
      }
    });

    return `${dominantType} cluster`;
  }

  private calculateClusterCoherence(nodes: string[]): number {
    let totalSimilarity = 0;
    let pairCount = 0;

    // Calculate average pairwise similarity
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = this.graph.getNodeAttributes(nodes[i]);
        const node2 = this.graph.getNodeAttributes(nodes[j]);
        totalSimilarity += this.calculateNodeSimilarity(node1, node2);
        pairCount++;
      }
    }

    return pairCount > 0 ? totalSimilarity / pairCount : 0;
  }

  public clusterNodes(): ClusterResult[] {
    const clusters: ClusterResult[] = [];
    const visited = new Set<string>();

    // Use connected components as initial clusters
    const components = this.graph.stronglyConnectedComponents();
    
    components.forEach((component, index) => {
      // Skip already visited nodes
      const unvisitedNodes = component.filter(node => !visited.has(node));
      if (unvisitedNodes.length === 0) return;

      // Mark nodes as visited
      unvisitedNodes.forEach(node => visited.add(node));

      // Calculate cluster metadata
      const centroidNode = this.findClusterCentroid(unvisitedNodes);
      const semanticTheme = this.inferClusterTheme(unvisitedNodes);
      const coherenceScore = this.calculateClusterCoherence(unvisitedNodes);

      clusters.push({
        clusterId: index,
        nodes: unvisitedNodes,
        metadata: {
          centroidNode,
          semanticTheme,
          coherenceScore
        }
      });
    });

    // Sort clusters by size and coherence
    return clusters.sort((a, b) => 
      (b.nodes.length * b.metadata.coherenceScore) - 
      (a.nodes.length * a.metadata.coherenceScore)
    );
  }
}
