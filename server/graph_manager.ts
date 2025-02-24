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
    console.log('[DEBUG] Loading initial graph data:', { nodeCount: nodes.length, edgeCount: edges.length });

    // Add nodes first
    for (const node of nodes) {
      if (!this.graph.hasNode(node.id.toString())) {
        this.graph.addNode(node.id.toString(), { ...node });
      }
    }

    // Then add edges
    for (const edge of edges) {
      const sourceId = edge.sourceId.toString();
      const targetId = edge.targetId.toString();

      if (this.graph.hasNode(sourceId) && 
          this.graph.hasNode(targetId) &&
          !this.graph.hasEdge(sourceId, targetId)) {
        this.graph.addEdge(sourceId, targetId, { ...edge });
      }
    }

    console.log('[DEBUG] Graph initialized:', {
      nodes: this.graph.order,
      edges: this.graph.size,
      nodeIds: Array.from(this.graph.nodes())
    });
  }

  async startIterativeExpansion(prompt: string): Promise<GraphData> {
    try {
      // Step 1: Get current state
      const currentNodeIds = Array.from(this.graph.nodes()).map(id => parseInt(id));
      const nextNodeId = Math.max(...currentNodeIds) + 1;

      console.log('[DEBUG] Starting expansion:', {
        prompt,
        currentNodes: currentNodeIds,
        nextNodeId
      });

      // Step 2: Get expansion from OpenAI
      const expansion = await expandGraph(prompt, this.graph);

      // Step 3: Create new node
      const nodeData = expansion.nodes[0];
      console.log('[DEBUG] Creating node:', nodeData);

      const newNode = await storage.createNode(nodeData);
      if (!newNode || !newNode.id) {
        throw new Error('Failed to create node: Invalid response from storage');
      }
      console.log('[DEBUG] Created node:', newNode);

      // Step 4: Add node to graph
      const newNodeId = newNode.id.toString();
      if (!this.graph.hasNode(newNodeId)) {
        this.graph.addNode(newNodeId, { ...newNode });
        console.log('[DEBUG] Added node to graph:', {
          id: newNodeId,
          exists: this.graph.hasNode(newNodeId)
        });
      }

      // Step 5: Verify node exists before creating edge
      const nodeCheck = await storage.getNode(newNode.id);
      if (!nodeCheck) {
        throw new Error(`Node verification failed: Node ${newNode.id} not found in storage`);
      }

      // Step 6: Create edge
      const edgeData: InsertEdge = {
        sourceId: expansion.edges[0].sourceId,
        targetId: newNode.id,
        label: expansion.edges[0].label,
        weight: expansion.edges[0].weight
      };

      console.log('[DEBUG] Creating edge:', edgeData);
      const newEdge = await storage.createEdge(edgeData);
      console.log('[DEBUG] Created edge:', newEdge);

      // Step 7: Add edge to graph
      const sourceId = newEdge.sourceId.toString();
      const targetId = newEdge.targetId.toString();

      if (!this.graph.hasEdge(sourceId, targetId)) {
        this.graph.addEdge(sourceId, targetId, { ...newEdge });
        console.log('[DEBUG] Added edge to graph:', {
          sourceId,
          targetId,
          exists: this.graph.hasEdge(sourceId, targetId)
        });
      }

      // Step 8: Verify final state
      const finalState = this.calculateMetrics();
      console.log('[DEBUG] Expansion complete:', {
        nodesCount: finalState.nodes.length,
        edgesCount: finalState.edges.length,
        newNodeId: newNode.id,
        graphContainsNode: this.graph.hasNode(newNodeId)
      });

      return finalState;

    } catch (error) {
      console.error('[DEBUG] Expansion error:', error);
      throw error;
    }
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

    return {
      nodes: Array.from(this.graph.nodes()).map(nodeId => ({
        ...this.graph.getNodeAttributes(nodeId),
        id: parseInt(nodeId)
      })) as Node[],
      edges: Array.from(this.graph.edges()).map(edgeId => ({
        ...this.graph.getEdgeAttributes(edgeId),
        id: parseInt(edgeId.split('-')[0])
      })) as Edge[],
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

  async recalculateClusters(): Promise<GraphDataWithClusters> {
    console.log('[DEBUG] Recalculating clusters');
    this.semanticClustering = new SemanticClusteringService(this.graph);
    return this.calculateMetrics();
  }
}

export const graphManager = new GraphManager();