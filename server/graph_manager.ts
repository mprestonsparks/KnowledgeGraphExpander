import Graph from "graphology";
import { centrality } from "graphology-metrics";
import { type Node, type Edge, type GraphData, type InsertEdge, type InsertNode } from "@shared/schema";
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
      edges: this.graph.size,
      disconnectedNodes: this.countDisconnectedNodes()
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

  private validateExpansionData(nodes: InsertNode[], edges: InsertEdge[]): { 
    isValid: boolean;
    connectedNodes: Set<string>;
    validNodes: InsertNode[];
    validEdges: InsertEdge[];
  } {
    const nodeLabels = new Map<number, string>();
    const connectedNodes = new Set<string>();
    const edgeConnections = new Map<string, Set<string>>();
    const validNodes: InsertNode[] = [];
    const validEdges: InsertEdge[] = [];

    // First pass: collect all proposed nodes and existing nodes
    nodes.forEach(node => {
      nodeLabels.set(node.id, node.label);
      console.log('Processing node:', {
        id: node.id,
        label: node.label
      });
    });

    // Second pass: validate edges and track connected nodes
    edges.forEach(edge => {
      const sourceId = edge.sourceId.toString();
      const targetId = edge.targetId.toString();
      const sourceExists = this.graph.hasNode(sourceId) || nodeLabels.has(edge.sourceId);
      const targetExists = this.graph.hasNode(targetId) || nodeLabels.has(edge.targetId);

      if (sourceExists && targetExists) {
        validEdges.push(edge);
        connectedNodes.add(sourceId);
        connectedNodes.add(targetId);

        // Track edge connections for both nodes
        if (!edgeConnections.has(sourceId)) {
          edgeConnections.set(sourceId, new Set());
        }
        if (!edgeConnections.has(targetId)) {
          edgeConnections.set(targetId, new Set());
        }
        edgeConnections.get(sourceId)!.add(targetId);
        edgeConnections.get(targetId)!.add(sourceId);

        console.log('Valid edge found:', {
          source: edge.sourceId,
          sourceLabel: nodeLabels.get(edge.sourceId) || 'existing node',
          target: edge.targetId,
          targetLabel: nodeLabels.get(edge.targetId) || 'existing node',
          label: edge.label
        });
      } else {
        console.warn('Invalid edge - missing nodes:', {
          edge,
          sourceExists,
          targetExists,
          sourceLabel: nodeLabels.get(edge.sourceId),
          targetLabel: nodeLabels.get(edge.targetId)
        });
      }
    });

    // Third pass: only accept nodes that have connections
    nodes.forEach(node => {
      const nodeId = node.id.toString();
      const hasConnections = connectedNodes.has(nodeId);
      const existingConnections = this.graph.degree(nodeId);

      if (hasConnections || existingConnections > 0) {
        validNodes.push(node);
        console.log('Accepted connected node:', {
          id: node.id,
          label: node.label,
          newConnections: edgeConnections.get(nodeId)?.size || 0,
          existingConnections
        });
      } else {
        console.warn('Rejecting disconnected node:', {
          id: node.id,
          label: node.label,
          reason: 'No valid connections found'
        });
      }
    });

    const isValid = validNodes.length > 0 && validEdges.length > 0;
    console.log('Expansion validation results:', {
      proposedNodes: nodes.length,
      proposedEdges: edges.length,
      validNodes: validNodes.length,
      validEdges: validEdges.length,
      isValid,
      disconnectedNodesRejected: nodes.length - validNodes.length
    });

    return {
      isValid,
      connectedNodes,
      validNodes,
      validEdges
    };
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
        console.log('Raw expansion result:', {
          nodesProposed: expansion.nodes?.length || 0,
          edgesProposed: expansion.edges?.length || 0
        });

        // Validate expansion data
        const { isValid, validNodes, validEdges } = this.validateExpansionData(
          expansion.nodes || [],
          expansion.edges || []
        );

        if (!isValid) {
          console.log('Skipping invalid expansion - no valid connected components found');
          break;
        }

        // Track initial state for logging
        const initialState = {
          nodes: this.graph.order,
          edges: this.graph.size,
          disconnectedBefore: this.countDisconnectedNodes()
        };

        // Process validated nodes and edges
        for (const nodeData of validNodes) {
          try {
            const node = await storage.createNode(nodeData);
            if (!this.graph.hasNode(node.id.toString())) {
              this.graph.addNode(node.id.toString(), { ...node });
            }
          } catch (error) {
            console.error('Failed to create node:', error);
          }
        }

        // Process validated edges
        for (const edgeData of validEdges) {
          try {
            const edge = await storage.createEdge(edgeData);
            if (!this.graph.hasEdge(edge.sourceId.toString(), edge.targetId.toString())) {
              this.graph.addEdge(
                edge.sourceId.toString(),
                edge.targetId.toString(),
                { ...edge }
              );
            }
          } catch (error) {
            console.error('Failed to create edge:', error);
          }
        }

        // Log final state and changes
        const finalState = {
          nodes: this.graph.order,
          edges: this.graph.size,
          disconnectedAfter: this.countDisconnectedNodes()
        };

        console.log('Iteration complete:', {
          before: initialState,
          after: finalState,
          nodesAdded: finalState.nodes - initialState.nodes,
          edgesAdded: finalState.edges - initialState.edges,
          disconnectedNodeChange: finalState.disconnectedAfter - initialState.disconnectedBefore
        });

        if (expansion.nextQuestion) {
          currentPrompt = expansion.nextQuestion;
        } else {
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