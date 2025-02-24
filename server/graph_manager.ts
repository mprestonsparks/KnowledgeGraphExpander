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

        // Log the full expansion result
        console.log('Expansion result:', {
          nodesCount: expansion.nodes?.length || 0,
          edgesCount: expansion.edges?.length || 0,
          nodes: expansion.nodes,
          edges: expansion.edges
        });

        // Process nodes from this iteration
        for (const nodeData of expansion.nodes || []) {
          try {
            const node = await storage.createNode(nodeData);
            if (!this.graph.hasNode(node.id.toString())) {
              this.graph.addNode(node.id.toString(), { ...node });
              console.log('Added new node:', {
                id: node.id,
                label: node.label,
                graphSize: this.graph.order
              });
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
              console.log('Added new edge:', {
                id: edge.id,
                source: edge.sourceId,
                target: edge.targetId,
                label: edge.label,
                graphEdges: this.graph.size
              });
            }
          } catch (error) {
            console.error('Failed to create edge:', error);
          }
        }

        // Verify graph state after updates
        console.log('Graph state after iteration:', {
          nodes: this.graph.order,
          edges: this.graph.size,
          disconnectedNodes: this.countDisconnectedNodes()
        });

        if (expansion.nextQuestion) {
          currentPrompt = expansion.nextQuestion;
          console.log('Next iteration prompt:', currentPrompt);
        } else {
          console.log('No next question provided, stopping expansion');
          break;
        }

        this.currentIteration++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Error during iteration:', error);
        break;
      }
    }
  }

  private validateEdgeData(edgeData: any): boolean {
    if (typeof edgeData.sourceId !== 'number' || typeof edgeData.targetId !== 'number') {
      console.warn('Invalid edge data types:', {
        sourceId: typeof edgeData.sourceId,
        targetId: typeof edgeData.targetId,
        data: edgeData
      });
      return false;
    }

    const sourceNode = this.graph.hasNode(edgeData.sourceId.toString());
    const targetNode = this.graph.hasNode(edgeData.targetId.toString());

    if (!sourceNode || !targetNode) {
      console.warn('Edge references missing nodes:', {
        edge: edgeData,
        sourceExists: sourceNode,
        targetExists: targetNode
      });
      return false;
    }

    // Check if edge already exists
    if (this.graph.hasEdge(edgeData.sourceId.toString(), edgeData.targetId.toString())) {
      console.warn('Edge already exists:', edgeData);
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
  private countDisconnectedNodes(): number {
    let count = 0;
    this.graph.forEachNode((nodeId: string) => {
      if (this.graph.degree(nodeId) === 0) {
        count++;
      }
    });
    return count;
  }
}

export const graphManager = new GraphManager();