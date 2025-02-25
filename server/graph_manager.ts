import Graph from "graphology";
import { centrality } from "graphology-metrics";
import { type Node, type Edge, type GraphData, type InsertEdge, type InsertNode } from "@shared/schema";
import { storage } from "./storage";
import { expandGraph } from "./openai_client";
import { SemanticClusteringService, type ClusterResult } from "./semantic_clustering";
import connectedComponents from "graphology-components";
import { semanticAnalysis } from "./semantic_analysis";

interface GraphDataWithClusters extends GraphData {
  clusters: ClusterResult[];
}

export class GraphManager {
  private graph: Graph;
  private isExpanding: boolean = false;
  private expandPromise: Promise<void> | null = null;
  private currentIteration: number = 0;
  private maxIterations: number = process.env.NODE_ENV === 'test' ? 1 : 1000;
  private semanticClustering: SemanticClusteringService;

  constructor() {
    this.graph = new Graph({ type: "directed", multi: false });
    this.semanticClustering = new SemanticClusteringService(this.graph);
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

    // First pass: collect all proposed nodes and check for valid data
    nodes.forEach(node => {
      if (node && node.id && node.label) {
        nodeLabels.set(node.id, node.label);
        console.log('Processing node:', {
          id: node.id,
          label: node.label,
          type: node.type,
          metadata: node.metadata
        });
      } else {
        console.warn('Invalid node data:', node);
      }
    });

    // Second pass: validate edges and track connected nodes
    edges.forEach(edge => {
      if (!edge || !edge.sourceId || !edge.targetId) {
        console.warn('Invalid edge data:', edge);
        return;
      }

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

    // Third pass: only accept nodes that have connections or existing edges
    nodes.forEach(node => {
      if (!node || !node.id) {
        console.warn('Skipping invalid node:', node);
        return;
      }

      const nodeId = node.id.toString();
      const hasNewConnections = connectedNodes.has(nodeId);
      const existingConnections = this.graph.hasNode(nodeId) ? this.graph.degree(nodeId) : 0;

      if (hasNewConnections || existingConnections > 0) {
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
          expansion,
          nodesProposed: expansion.nodes?.length || 0,
          edgesProposed: expansion.edges?.length || 0,
          nextQuestion: expansion.nextQuestion
        });

        if (!expansion.nodes?.length && !expansion.edges?.length) {
          console.log('No expansion data received, ending iterations');
          break;
        }

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
              console.log('Added node:', {
                id: node.id,
                label: node.label,
                type: node.type
              });
            }
          } catch (error) {
            console.error('Failed to create node:', {
              error,
              nodeData
            });
          }
        }

        // Process validated edges
        for (const edgeData of validEdges) {
          try {
            const edge = await storage.createEdge(edgeData);
            const sourceId = edge.sourceId.toString();
            const targetId = edge.targetId.toString();

            if (!this.graph.hasEdge(sourceId, targetId)) {
              this.graph.addEdge(sourceId, targetId, { ...edge });
              console.log('Added edge:', {
                id: edge.id,
                source: sourceId,
                target: targetId,
                label: edge.label
              });
            }
          } catch (error) {
            console.error('Failed to create edge:', {
              error,
              edgeData
            });
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
    console.log('Starting metrics calculation');

    // Store initial edge count and data for verification
    const initialEdgeCount = this.graph.size;
    const initialEdges = Array.from(this.graph.edges()).map(edgeId => {
      const attrs = this.graph.getEdgeAttributes(edgeId);
      return {
        ...attrs,
        id: attrs.id || parseInt(edgeId) // Ensure we have a valid numeric ID
      };
    });

    console.log('Initial graph state:', {
      edgeCount: initialEdgeCount,
      edgeDetails: initialEdges.map(e => ({
        id: e.id,
        source: e.sourceId,
        target: e.targetId,
        label: e.label
      }))
    });

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

    // Perform clustering without modifying edges
    const clusters = this.semanticClustering.clusterNodes();

    // Get current nodes
    const currentNodes = Array.from(this.graph.nodes()).map(nodeId => ({
      ...this.graph.getNodeAttributes(nodeId),
      id: parseInt(nodeId)
    })) as Node[];

    // Get current edges with proper ID handling
    const currentEdges = Array.from(this.graph.edges()).map(edgeId => {
      const attrs = this.graph.getEdgeAttributes(edgeId);
      return {
        ...attrs,
        id: attrs.id || parseInt(edgeId) // Ensure we have a valid numeric ID
      };
    }) as Edge[];

    console.log('Final graph state:', {
      nodes: currentNodes.length,
      edges: currentEdges.length,
      edgeDetails: currentEdges.map(e => ({
        id: e.id,
        source: e.sourceId,
        target: e.targetId,
        label: e.label
      }))
    });

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

    // Store initial state for verification
    const initialState = {
      edges: this.graph.size,
      edgeList: Array.from(this.graph.edges())
    };

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

    let reconnectionAttempts = 0;
    let reconnectedCount = 0;

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
              !targetNodeId &&
              potentialTarget !== nodeId
            ) {
              targetNodeId = potentialTarget;
            }
          });

          if (targetNodeId) {
            reconnectionAttempts++;
            const sourceNode = this.graph.getNodeAttributes(nodeId);
            const targetNode = this.graph.getNodeAttributes(targetNodeId);

            // Create edge in database first
            const edge = await storage.createEdge({
              sourceId: parseInt(nodeId),
              targetId: parseInt(targetNodeId),
              label: "related_to",
              weight: 1
            });

            // Then add edge to graph if it doesn't exist
            if (!this.graph.hasEdge(nodeId, targetNodeId)) {
              this.graph.addEdge(nodeId, targetNodeId, { ...edge });
              reconnectedCount++;

              console.log('Connected nodes:', {
                source: { id: nodeId, label: sourceNode.label },
                target: { id: targetNodeId, label: targetNode.label }
              });
            }
          }
        } catch (error) {
          console.error('Failed to connect node:', {
            nodeId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    // Verify edge preservation
    const finalState = {
      edges: this.graph.size,
      edgeList: Array.from(this.graph.edges())
    };

    console.log('Reconnection complete:', {
      initialEdges: initialState.edges,
      finalEdges: finalState.edges,
      reconnectionAttempts,
      reconnectedCount,
      remainingDisconnected: this.countDisconnectedNodes(),
      edgesPreserved: initialState.edgeList.every(edge => finalState.edgeList.includes(edge))
    });

    // Calculate final metrics
    return this.calculateMetrics();
  }

  async expandWithSemantics(content: string): Promise<GraphData> {
    if (this.isExpanding) {
      console.log('Waiting for ongoing expansion to complete');
      await this.expandPromise;
      return this.calculateMetrics();
    }

    try {
      this.isExpanding = true;
      console.log('Starting semantic expansion with content');

      // Get current nodes
      const currentNodes = Array.from(this.graph.nodes()).map(nodeId => ({
        ...this.graph.getNodeAttributes(nodeId),
        id: parseInt(nodeId)
      })) as Node[];

      // Perform semantic analysis
      const analysisResult = await semanticAnalysis.analyzeContent(content, currentNodes);
      console.log('Semantic analysis complete:', {
        newNodes: analysisResult.nodes.length,
        newEdges: analysisResult.edges.length,
        reasoning: analysisResult.reasoning
      });

      // Add new nodes and edges
      for (const nodeData of analysisResult.nodes) {
        try {
          const node = await storage.createNode(nodeData);
          if (!this.graph.hasNode(node.id.toString())) {
            this.graph.addNode(node.id.toString(), { ...node });
          }
        } catch (error) {
          console.error('Failed to create node:', error);
        }
      }

      for (const edgeData of analysisResult.edges) {
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

      return this.calculateMetrics();
    } finally {
      this.isExpanding = false;
    }
  }
}

export const graphManager = new GraphManager();