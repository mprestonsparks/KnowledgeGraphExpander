import Graph from "graphology";
import { centrality } from "graphology-metrics";
import { type Node, type Edge, type GraphData, type InsertEdge } from "@shared/schema";
import { storage } from "./storage";
import { expandGraph, suggestRelationships, type RelationshipSuggestion } from "./openai_client";

export class GraphManager {
  private graph: Graph;
  private isExpanding: boolean = false;
  private expandPromise: Promise<void> | null = null;

  constructor() {
    this.graph = new Graph({ type: "directed", multi: false });
  }

  async initialize() {
    const { nodes, edges } = await storage.getFullGraph();
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
    if (this.expandPromise) {
      console.log('Waiting for ongoing expansion to complete');
      await this.expandPromise;
      return this.calculateMetrics();
    }

    try {
      this.isExpanding = true;
      console.log('Starting expansion with prompt:', prompt);

      this.expandPromise = this.performExpansion(prompt);
      await this.expandPromise;

      return this.calculateMetrics();
    } finally {
      this.isExpanding = false;
      this.expandPromise = null;
      console.log('Released expansion lock');
    }
  }

  private async performExpansion(prompt: string): Promise<void> {
    console.log('Current graph state:', {
      nodes: this.graph.order,
      edges: this.graph.size
    });

    const newData = await expandGraph(prompt, this.graph);

    // Process nodes first
    for (const nodeData of newData.nodes) {
      try {
        const node = await storage.createNode(nodeData);
        console.log('Created node:', { id: node.id, label: node.label });

        if (!this.graph.hasNode(node.id.toString())) {
          this.graph.addNode(node.id.toString(), { ...node });
          console.log('Added node to graph:', node.id);
        }
      } catch (error) {
        console.error('Failed to create node:', error);
      }
    }

    // Process edges after nodes
    for (const edgeData of newData.edges) {
      try {
        if (!this.validateEdgeData(edgeData)) {
          continue;
        }

        const edge = await storage.createEdge(edgeData);
        if (!this.graph.hasEdge(edge.sourceId.toString(), edge.targetId.toString())) {
          this.graph.addEdge(
            edge.sourceId.toString(),
            edge.targetId.toString(),
            { ...edge }
          );
          console.log('Added edge:', `${edge.sourceId}-${edge.targetId}`);
        }
      } catch (error) {
        console.error('Failed to create edge:', error);
      }
    }

    console.log('Expansion complete:', {
      totalNodes: this.graph.order,
      totalEdges: this.graph.size
    });
  }

  async suggestRelationships(): Promise<RelationshipSuggestion[]> {
    return suggestRelationships(this.graph);
  }

  async applyRelationship(edgeData: InsertEdge): Promise<GraphData> {
    if (!this.validateEdgeData(edgeData)) {
      throw new Error('Invalid edge data');
    }

    const edge = await storage.createEdge(edgeData);
    if (!this.graph.hasEdge(edge.sourceId.toString(), edge.targetId.toString())) {
      this.graph.addEdge(
        edge.sourceId.toString(),
        edge.targetId.toString(),
        { ...edge }
      );
      console.log('Added suggested edge:', `${edge.sourceId}-${edge.targetId}`);
    }

    return this.calculateMetrics();
  }

  private validateEdgeData(edgeData: any): boolean {
    if (typeof edgeData.sourceId !== 'number' || typeof edgeData.targetId !== 'number') {
      console.warn('Invalid edge data, skipping:', edgeData);
      return false;
    }

    if (!this.graph.hasNode(edgeData.sourceId.toString()) || 
        !this.graph.hasNode(edgeData.targetId.toString())) {
      console.warn('Edge references non-existent nodes, skipping:', edgeData);
      return false;
    }

    return true;
  }

  private calculateMetrics(): GraphData {
    const betweenness = centrality.betweenness(this.graph);
    let eigenvector: Record<string, number> = {};

    try {
      eigenvector = centrality.eigenvector(this.graph);
    } catch (error) {
      this.graph.forEachNode((nodeId: string) => {
        eigenvector[nodeId] = 0;
      });
    }

    const degree: Record<number, number> = {};
    this.graph.forEachNode((nodeId: string) => {
      const id = parseInt(nodeId);
      degree[id] = this.graph.degree(nodeId);
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
      }
    };
  }
}

export const graphManager = new GraphManager();