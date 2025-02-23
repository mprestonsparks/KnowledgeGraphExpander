import Graph from "graphology";
import { centrality } from "graphology-metrics";
import { type Node, type Edge, type GraphData } from "@shared/schema";
import { storage } from "./storage";
import { expandGraph } from "./openai_client";

export class GraphManager {
  private graph: Graph;

  constructor() {
    this.graph = new Graph({ type: "directed" });
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
  }

  async expand(prompt: string): Promise<GraphData> {
    const newData = await expandGraph(prompt, this.graph);

    // Add new nodes and edges to storage
    for (const node of newData.nodes) {
      await storage.createNode(node);
    }

    for (const edge of newData.edges) {
      await storage.createEdge(edge);
    }

    // Update graph
    newData.nodes.forEach(node => {
      if (!this.graph.hasNode(node.id.toString())) {
        this.graph.addNode(node.id.toString(), { ...node });
      }
    });

    newData.edges.forEach(edge => {
      if (!this.graph.hasEdge(edge.sourceId.toString(), edge.targetId.toString())) {
        this.graph.addEdge(
          edge.sourceId.toString(),
          edge.targetId.toString(),
          { ...edge }
        );
      }
    });

    return this.calculateMetrics();
  }

  private calculateMetrics(): GraphData {
    const betweenness = centrality.betweenness(this.graph);
    const eigenvector = centrality.eigenvector(this.graph);
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