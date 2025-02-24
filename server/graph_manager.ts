import Graph from "graphology";
import { centrality } from "graphology-metrics";
import { type Node, type Edge, type GraphData, type InsertEdge, type InsertNode } from "@shared/schema";
import { storage } from "./storage";
import { expandGraph } from "./openai_client";
import { SemanticClusteringService, type ClusterResult } from "./semantic_clustering";
import { connectedComponents } from "graphology-components";

interface GraphDataWithClusters extends GraphData {
  clusters: ClusterResult[];
}

interface ExpansionState {
  currentIteration: number;
  maxIterations: number;
  lastPrompt: string;
  isExpanding: boolean;
}

export class GraphManager {
  private graph: Graph;
  private semanticClustering: SemanticClusteringService;
  private expansionState: ExpansionState;

  constructor() {
    this.graph = new Graph({ type: "directed", multi: false });
    this.semanticClustering = new SemanticClusteringService(this.graph);
    this.expansionState = {
      currentIteration: 0,
      maxIterations: process.env.NODE_ENV === 'test' ? 1 : 1000,
      lastPrompt: "",
      isExpanding: false
    };
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

    console.log('Graph initialized:', {
      nodes: this.graph.order,
      edges: this.graph.size,
      disconnectedNodes: this.countDisconnectedNodes()
    });
  }

  async startIterativeExpansion(initialPrompt: string): Promise<GraphData> {
    if (this.expansionState.isExpanding) {
      console.log('Expansion already in progress');
      return this.calculateMetrics();
    }

    try {
      this.expansionState.isExpanding = true;
      this.expansionState.lastPrompt = initialPrompt;
      this.expansionState.currentIteration = 0;

      console.log('Starting iterative expansion with prompt:', initialPrompt);

      while (this.expansionState.currentIteration < this.expansionState.maxIterations) {
        console.log(`Starting iteration ${this.expansionState.currentIteration + 1}/${this.expansionState.maxIterations}`);

        const expansion = await expandGraph(this.expansionState.lastPrompt, this.graph);

        // Process expansion result
        const { isValid, validNodes, validEdges } = this.validateExpansionData(
          expansion.nodes || [],
          expansion.edges || []
        );

        if (!isValid) {
          console.log('Invalid expansion - no valid connected components');
          break;
        }

        // Update graph with new nodes and edges
        await this.updateGraphWithExpansion(validNodes, validEdges);

        // Update prompt for next iteration if available
        if (expansion.nextQuestion) {
          this.expansionState.lastPrompt = expansion.nextQuestion;
        } else {
          break;
        }

        this.expansionState.currentIteration++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      return this.calculateMetrics();
    } finally {
      this.expansionState.isExpanding = false;
    }
  }

  private async updateGraphWithExpansion(nodes: InsertNode[], edges: InsertEdge[]) {
    const initialState = {
      nodes: this.graph.order,
      edges: this.graph.size,
      disconnectedBefore: this.countDisconnectedNodes()
    };

    // Add new nodes
    for (const nodeData of nodes) {
      try {
        const node = await storage.createNode(nodeData);
        if (!this.graph.hasNode(node.id.toString())) {
          this.graph.addNode(node.id.toString(), { ...node });
        }
      } catch (error) {
        console.error('Failed to create node:', error);
      }
    }

    // Add new edges
    for (const edgeData of edges) {
      try {
        const edge = await storage.createEdge(edgeData);
        const sourceId = edge.sourceId.toString();
        const targetId = edge.targetId.toString();

        if (!this.graph.hasEdge(sourceId, targetId)) {
          this.graph.addEdge(sourceId, targetId, { ...edge });
        }
      } catch (error) {
        console.error('Failed to create edge:', error);
      }
    }

    // Log changes
    const finalState = {
      nodes: this.graph.order,
      edges: this.graph.size,
      disconnectedAfter: this.countDisconnectedNodes()
    };

    console.log('Expansion update complete:', {
      before: initialState,
      after: finalState,
      nodesAdded: finalState.nodes - initialState.nodes,
      edgesAdded: finalState.edges - initialState.edges,
      disconnectedNodeChange: finalState.disconnectedAfter - initialState.disconnectedBefore
    });
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


  async recalculateClusters(): Promise<GraphDataWithClusters> {
    console.log('Recalculating clusters for graph:', {
      nodes: this.graph.order,
      edges: this.graph.size
    });

    // Force new cluster calculation
    this.semanticClustering = new SemanticClusteringService(this.graph);
    return this.calculateMetrics();
  }

  private calculateMetrics(): GraphDataWithClusters {
    const betweenness = centrality.betweenness(this.graph);
    let eigenvector: Record<string, number> = {};

    try {
      eigenvector = centrality.eigenvector(this.graph);
    } catch (error) {
      console.warn('Failed to calculate eigenvector centrality:', error);
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
    console.log('Calculated clusters:', {
      clusterCount: clusters.length,
      clusterSizes: clusters.map(c => c.nodes.length)
    });

    const currentNodes = Array.from(this.graph.nodes()).map(nodeId => ({
      ...this.graph.getNodeAttributes(nodeId),
      id: parseInt(nodeId)
    })) as Node[];

    const currentEdges = Array.from(this.graph.edges()).map(edgeId => ({
      ...this.graph.getEdgeAttributes(edgeId),
      id: parseInt(edgeId.split('-')[0])
    })) as Edge[];

    const metrics = {
      betweenness: Object.fromEntries(
        Object.entries(betweenness).map(([k, v]) => [parseInt(k), v])
      ),
      eigenvector: Object.fromEntries(
        Object.entries(eigenvector).map(([k, v]) => [parseInt(k), v])
      ),
      degree
    };

    console.log('Final graph metrics calculated:', {
      nodes: currentNodes.length,
      edges: currentEdges.length,
      clusters: clusters.length,
      disconnectedNodes: this.countDisconnectedNodes()
    });

    return {
      nodes: currentNodes,
      edges: currentEdges,
      metrics,
      clusters
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

  async reconnectDisconnectedNodes(): Promise<GraphData> {
    console.log('Starting reconnection of disconnected nodes');
    const disconnectedNodeIds = new Set<string>();

    // Identify disconnected nodes
    this.graph.forEachNode((nodeId: string) => {
      if (this.graph.degree(nodeId) === 0) {
        disconnectedNodeIds.add(nodeId);
        console.log('Found disconnected node:', {
          id: nodeId,
          label: this.graph.getNodeAttributes(nodeId).label
        });
      }
    });

    if (disconnectedNodeIds.size === 0) {
      console.log('No disconnected nodes found');
      return this.calculateMetrics();
    }

    console.log(`Found ${disconnectedNodeIds.size} disconnected nodes`);

    // Group nodes by type for more meaningful connections
    const nodesByType = new Map<string, string[]>();
    disconnectedNodeIds.forEach(nodeId => {
      const node = this.graph.getNodeAttributes(nodeId);
      if (!nodesByType.has(node.type)) {
        nodesByType.set(node.type, []);
      }
      nodesByType.get(node.type)!.push(nodeId);
    });

    // Connect nodes of similar types
    for (const [type, nodes] of nodesByType.entries()) {
      console.log(`Processing nodes of type: ${type}`);

      for (const nodeId of nodes) {
        try {
          // Find a suitable connected node to link to
          let targetNodeId: string | null = null;
          this.graph.forEachNode((potentialTarget: string) => {
            if (
              !disconnectedNodeIds.has(potentialTarget) &&
              this.graph.getNodeAttributes(potentialTarget).type === type &&
              !targetNodeId
            ) {
              targetNodeId = potentialTarget;
            }
          });

          if (targetNodeId) {
            const sourceNode = this.graph.getNodeAttributes(nodeId);
            const targetNode = this.graph.getNodeAttributes(targetNodeId);

            // Create edge in database
            const edge = await storage.createEdge({
              sourceId: parseInt(nodeId),
              targetId: parseInt(targetNodeId),
              label: "related_to",
              weight: 1
            });

            // Add edge to graph
            this.graph.addEdge(nodeId, targetNodeId, { ...edge });

            console.log('Connected nodes:', {
              source: { id: nodeId, label: sourceNode.label },
              target: { id: targetNodeId, label: targetNode.label }
            });
          }
        } catch (error) {
          console.error('Failed to connect node:', {
            nodeId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    return this.calculateMetrics();
  }
}

export const graphManager = new GraphManager();