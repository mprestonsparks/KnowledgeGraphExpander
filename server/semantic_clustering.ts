import { type Node } from "@shared/schema";
import Graph from "graphology";
import connectedComponents from "graphology-components";

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
    // Enhanced similarity calculation based on node type and attributes
    if (node1.type === node2.type) {
      return 0.8;
    }
    return 0.2;
  }

  private findClusterCentroid(nodes: string[]): string {
    let maxDegree = -1;
    let centroid = nodes[0];

    nodes.forEach(nodeId => {
      const degree = this.graph.degree(nodeId);
      if (degree > maxDegree) {
        maxDegree = degree;
        centroid = nodeId;
      }
    });

    return centroid;
  }

  private inferClusterTheme(nodes: string[]): string {
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

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = this.graph.getNodeAttributes(nodes[i]) as Node;
        const node2 = this.graph.getNodeAttributes(nodes[j]) as Node;
        totalSimilarity += this.calculateNodeSimilarity(node1, node2);
        pairCount++;
      }
    }

    return pairCount > 0 ? totalSimilarity / pairCount : 0;
  }

  public clusterNodes(): ClusterResult[] {
    console.log('Starting clustering process...');
    const clusters: ClusterResult[] = [];
    const visited = new Set<string>();

    // Get connected components
    const components = connectedComponents(this.graph);

    console.log('Found connected components:', {
      componentCount: components.length,
      componentSizes: components.map(c => c.length)
    });

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

      const cluster = {
        clusterId: index,
        nodes: unvisitedNodes,
        metadata: {
          centroidNode,
          semanticTheme,
          coherenceScore
        }
      };

      console.log('Created cluster:', {
        clusterId: index,
        nodeCount: unvisitedNodes.length,
        theme: semanticTheme,
        centroid: centroidNode,
        coherence: coherenceScore,
        nodeIds: unvisitedNodes
      });

      clusters.push(cluster);
    });

    // Sort clusters by size and coherence
    const sortedClusters = clusters.sort((a, b) => 
      (b.nodes.length * b.metadata.coherenceScore) - 
      (a.nodes.length * a.metadata.coherenceScore)
    );

    console.log('Final clustering results:', {
      totalClusters: sortedClusters.length,
      clusterSizes: sortedClusters.map(c => ({ 
        id: c.clusterId, 
        nodes: c.nodes.length,
        theme: c.metadata.semanticTheme,
        coherence: c.metadata.coherenceScore
      }))
    });

    return sortedClusters;
  }
}