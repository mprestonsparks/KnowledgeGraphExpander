import Graph from "graphology";
import { centrality } from "graphology-metrics";
import { type Node, type Edge, type GraphData, type InsertNode, type InsertEdge } from "@shared/schema";
import { storage } from "./storage";
import { expandGraph } from "./openai_client";
import { SemanticClusteringService, type ClusterResult } from "./semantic_clustering";

interface GraphDataWithClusters extends GraphData {
  clusters: ClusterResult[];
}

export class GraphManager {
  private graph: Graph;
  private semanticClustering: SemanticClusteringService;

  constructor() {
    this.graph = new Graph({ type: "directed", multi: false });
    this.semanticClustering = new SemanticClusteringService(this.graph);
  }

  async initialize() {
    const { nodes, edges } = await storage.getFullGraph();

    nodes.forEach(node => {
      if (!this.graph.hasNode(node.id.toString())) {
        this.graph.addNode(node.id.toString(), { ...node });
      }
    });

    edges.forEach(edge => {
      const sourceId = edge.sourceId.toString();
      const targetId = edge.targetId.toString();

      if (this.graph.hasNode(sourceId) &&
          this.graph.hasNode(targetId) &&
          !this.graph.hasEdge(sourceId, targetId)) {
        this.graph.addEdge(sourceId, targetId, { ...edge });
      }
    });

    console.log('[DEBUG] Graph initialized:', {
      nodes: this.graph.order,
      edges: this.graph.size
    });
  }

  async startIterativeExpansion(prompt: string): Promise<GraphData> {
    console.log('[DEBUG] Starting expansion with prompt:', prompt);

    try {
      // Get expansion suggestion from OpenAI
      const expansion = await expandGraph(prompt, this.graph);
      console.log('[DEBUG] Received expansion:', expansion);

      // Add the new node
      const createdNode = await storage.createNode(expansion.nodes[0]);
      console.log('[DEBUG] Created node:', createdNode);

      this.graph.addNode(createdNode.id.toString(), { ...createdNode });

      // Add the new edge
      const edge = await storage.createEdge(expansion.edges[0]);
      console.log('[DEBUG] Created edge:', edge);

      this.graph.addEdge(
        edge.sourceId.toString(),
        edge.targetId.toString(),
        { ...edge }
      );

      return this.calculateMetrics();
    } catch (error) {
      console.error('[DEBUG] Expansion error:', error);
      throw error;
    }
  }

  async recalculateClusters(): Promise<GraphDataWithClusters> {
    console.log('[DEBUG] Recalculating clusters');
    this.semanticClustering = new SemanticClusteringService(this.graph);
    return this.calculateMetrics();
  }

  private calculateMetrics(): GraphDataWithClusters {
    const betweenness = centrality.betweenness(this.graph);
    let eigenvector: Record<string, number> = {};

    try {
      eigenvector = centrality.eigenvector(this.graph);
    } catch (error) {
      console.warn('[DEBUG] Failed to calculate eigenvector centrality:', error);
      this.graph.forEachNode((nodeId: string) => {
        eigenvector[nodeId] = 0;
      });
    }

    const degree: Record<number, number> = {};
    this.graph.forEachNode((nodeId: string) => {
      const id = parseInt(nodeId);
      degree[id] = this.graph.degree(nodeId);
    });

    const clusters = this.semanticClustering.clusterNodes();
    console.log('[DEBUG] Calculated clusters:', {
      count: clusters.length,
      sizes: clusters.map(c => c.nodes.length)
    });

    const currentNodes = Array.from(this.graph.nodes()).map(nodeId => ({
      ...this.graph.getNodeAttributes(nodeId),
      id: parseInt(nodeId)
    })) as Node[];

    const currentEdges = Array.from(this.graph.edges()).map(edgeId => ({
      ...this.graph.getEdgeAttributes(edgeId),
      id: parseInt(edgeId.split('-')[0])
    })) as Edge[];

    return {
      nodes: currentNodes,
      edges: currentEdges,
      metrics: {
        betweenness: Object.fromEntries(
          Object.entries(betweenness).map(([k, v]) => [parseInt(k), v])
        ),
        eigenvector: Object.fromEntries(
          Object.entries(eigenvector).map(([k, v]) => [parseInt(k), v])
        ),
        degree
      },
      clusters
    };
  }
}

export const graphManager = new GraphManager();