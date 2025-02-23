import Graph from "graphology";
import { centrality } from "graphology-metrics";
import { type Node, type Edge, type GraphData } from "@shared/schema";
import { storage } from "./storage";
import { expandGraph } from "./openai_client";

export class GraphManager {
  private graph: Graph;
  private isExpanding: boolean = false;

  constructor() {
    this.graph = new Graph({ type: "directed", multi: false });
  }

  async initialize() {
    const { nodes, edges } = await storage.getFullGraph();

    // Add nodes and edges to the graph
    nodes.forEach(node => {
      this.graph.addNode(node.id.toString(), { ...node });
    });

    edges.forEach(edge => {
      this.graph.addEdge(
        edge.sourceId.toString(),
        edge.targetId.toString(),
        { ...edge }
      );
    });

    console.log('Graph initialized with:', { nodes: nodes.length, edges: edges.length });
  }

  async expand(prompt: string): Promise<GraphData> {
    console.log('Starting expansion with prompt:', prompt);
    console.log('Current graph state:', {
      nodes: this.graph.order,
      edges: this.graph.size,
      isExpanding: this.isExpanding
    });

    if (this.isExpanding) {
      console.log('Expansion already in progress, returning empty update');
      const metrics = this.calculateMetrics();
      return {
        nodes: [],
        edges: [],
        metrics: metrics.metrics
      };
    }

    try {
      this.isExpanding = true;
      console.log('Acquired expansion lock');

      const newData = await expandGraph(prompt, this.graph);
      console.log('Received expansion data:', {
        newNodes: newData.nodes.length,
        newEdges: newData.edges.length
      });

      const createdNodes: Node[] = [];
      const createdEdges: Edge[] = [];

      // Create nodes first to get their IDs
      for (const nodeData of newData.nodes) {
        try {
          // Skip if node already exists (for concurrent operations)
          const node = await storage.createNode(nodeData);
          console.log('Created node:', { id: node.id, label: node.label });

          if (!this.graph.hasNode(node.id.toString())) {
            createdNodes.push(node);
            this.graph.addNode(node.id.toString(), { ...node });
            console.log('Added new node to graph:', node.id);
          } else {
            console.log('Node already exists in graph:', node.id);
          }
        } catch (error) {
          console.error('Failed to create node:', error);
        }
      }

      // Create edges using the new node IDs
      for (const edgeData of newData.edges) {
        try {
          // Validate edge data before creation
          if (typeof edgeData.sourceId !== 'number' || typeof edgeData.targetId !== 'number') {
            console.warn('Invalid edge data, skipping:', edgeData);
            continue;
          }

          // Skip if nodes don't exist
          if (!this.graph.hasNode(edgeData.sourceId.toString()) || 
              !this.graph.hasNode(edgeData.targetId.toString())) {
            console.warn('Edge references non-existent nodes, skipping:', edgeData);
            continue;
          }

          // Check if edge already exists
          const edgeExists = this.graph.hasEdge(
            edgeData.sourceId.toString(),
            edgeData.targetId.toString()
          );

          if (!edgeExists) {
            const edge = await storage.createEdge(edgeData);
            console.log('Created edge:', {
              id: edge.id,
              source: edge.sourceId,
              target: edge.targetId
            });

            createdEdges.push(edge);
            this.graph.addEdge(
              edge.sourceId.toString(),
              edge.targetId.toString(),
              { ...edge }
            );
            console.log('Added new edge to graph');
          } else {
            console.log('Edge already exists in graph:', {
              source: edgeData.sourceId,
              target: edgeData.targetId
            });
          }
        } catch (error) {
          console.error('Failed to create edge:', error);
        }
      }

      const metrics = this.calculateMetrics();
      console.log('Expansion complete. Current graph state:', {
        totalNodes: this.graph.order,
        totalEdges: this.graph.size,
        newNodes: createdNodes.length,
        newEdges: createdEdges.length
      });

      // Return only the newly created items
      return {
        nodes: createdNodes,
        edges: createdEdges,
        metrics: metrics.metrics
      };

    } finally {
      this.isExpanding = false;
      console.log('Released expansion lock');
    }
  }

  private calculateMetrics(): GraphData {
    const betweenness = centrality.betweenness(this.graph);
    let eigenvector: Record<string, number> = {};

    try {
      eigenvector = centrality.eigenvector(this.graph);
    } catch (error) {
      // If eigenvector centrality fails to converge, initialize with zeros
      this.graph.forEachNode((nodeId: string) => {
        eigenvector[nodeId] = 0;
      });
    }

    const degree: Record<number, number> = {};

    this.graph.forEachNode((nodeId: string) => {
      const id = parseInt(nodeId);
      degree[id] = this.graph.degree(nodeId);
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
      }
    };
  }
}

export const graphManager = new GraphManager();