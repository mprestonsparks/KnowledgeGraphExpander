import Graph from "graphology";
import { centrality } from "graphology-metrics";
import { type Node, type Edge, type GraphData, type InsertEdge } from "@shared/schema";
import { storage } from "./storage";
import { expandGraph } from "./openai_client";

export class GraphManager {
  private graph: Graph;
  private isExpanding: boolean = false;
  private expandPromise: Promise<void> | null = null;
  private currentIteration: number = 0;
  private maxIterations: number = process.env.NODE_ENV === 'test' ? 1 : 1000;

  constructor() {
    this.graph = new Graph({ type: "directed", multi: false });
  }

  async initialize() {
    const { nodes, edges } = await storage.getFullGraph();

    // Add nodes first
    nodes.forEach(node => {
      if (!this.graph.hasNode(node.id.toString())) {
        this.graph.addNode(node.id.toString(), { ...node });
      }
    });

    // Then add edges, checking for duplicates
    edges.forEach(edge => {
      const sourceId = edge.sourceId.toString();
      const targetId = edge.targetId.toString();

      // Only add edge if both nodes exist and edge doesn't already exist
      if (this.graph.hasNode(sourceId) && 
          this.graph.hasNode(targetId) &&
          !this.graph.hasEdge(sourceId, targetId)) {
        this.graph.addEdge(sourceId, targetId, { ...edge });
      }
    });

    console.log('Graph initialized:', {
      nodes: this.graph.order,
      edges: this.graph.size
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

      this.expandPromise = this.performIterativeExpansion(prompt);
      await this.expandPromise;

      return this.calculateMetrics();
    } finally {
      this.isExpanding = false;
      this.expandPromise = null;
    }
  }

  private async performIterativeExpansion(initialPrompt: string): Promise<void> {
    let currentPrompt = initialPrompt;
    this.currentIteration = 0;

    while (this.currentIteration < this.maxIterations) {
      console.log(`Starting iteration ${this.currentIteration + 1}/${this.maxIterations}`);
      console.log('Current prompt:', currentPrompt);

      try {
        const expansion = await expandGraph(currentPrompt, this.graph);

        // Safely log reasoning if it exists
        if (expansion.reasoning) {
          console.log('Reasoning output:', expansion.reasoning);
        }

        // Process nodes from this iteration
        for (const nodeData of expansion.nodes || []) {
          try {
            const node = await storage.createNode(nodeData);
            if (!this.graph.hasNode(node.id.toString())) {
              this.graph.addNode(node.id.toString(), { ...node });
              console.log('Added new node:', node.label);
            }
          } catch (error) {
            console.error('Failed to create node:', error);
          }
        }

        // Process edges from this iteration
        for (const edgeData of expansion.edges || []) {
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
              console.log('Added new edge:', `${edge.sourceId}-${edge.targetId}: ${edge.label}`);
            }
          } catch (error) {
            console.error('Failed to create edge:', error);
          }
        }

        // Update prompt for next iteration if available
        if (expansion.nextQuestion) {
          currentPrompt = expansion.nextQuestion;
          console.log('Next iteration prompt:', currentPrompt);
        } else {
          console.log('No next question provided, stopping expansion');
          break;
        }

        this.currentIteration++;

        // Allow some time between iterations
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Error during iteration:', error);
        break;
      }
    }
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