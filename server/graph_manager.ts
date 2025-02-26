import Graph from "graphology";
import { centrality, topology } from "graphology-metrics";
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
  private maxProcessingTime: number = 8000; // 8 seconds max processing time
  private debugLogging: boolean = process.env.NODE_ENV !== 'production';
  private semanticClustering: SemanticClusteringService;
  private onUpdate: ((graphData: GraphDataWithClusters) => void) | null = null; // Added onUpdate callback


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

  private async detectKnowledgeGaps(): Promise<{
    disconnectedConcepts: string[];
    weakConnections: Array<{ source: string; target: string; weight: number }>;
    underdevelopedThemes: Array<{ theme: string; nodeCount: number; avgCoherence: number }>;
  }> {
    console.log('Starting knowledge gap detection');

    // Find disconnected concepts
    const disconnectedConcepts = Array.from(this.graph.nodes())
      .filter(nodeId => this.graph.degree(nodeId) === 0)
      .map(nodeId => this.graph.getNodeAttributes(nodeId).label);

    // Identify weak connections (low weight edges)
    const weakConnections = Array.from(this.graph.edges())
      .map(edgeId => {
        const edge = this.graph.getEdgeAttributes(edgeId);
        return {
          source: this.graph.getNodeAttributes(edge.sourceId.toString()).label,
          target: this.graph.getNodeAttributes(edge.targetId.toString()).label,
          weight: edge.weight
        };
      })
      .filter(conn => conn.weight < 0.3);

    // Analyze cluster development
    const clusters = this.semanticClustering.clusterNodes();
    const underdevelopedThemes = clusters
      .map(cluster => ({
        theme: cluster.metadata.semanticTheme,
        nodeCount: cluster.nodes.length,
        avgCoherence: cluster.metadata.coherenceScore
      }))
      .filter(theme => theme.nodeCount < 3 || theme.avgCoherence < 0.4);

    console.log('Knowledge gap analysis complete:', {
      disconnectedCount: disconnectedConcepts.length,
      weakConnectionsCount: weakConnections.length,
      underdevelopedThemesCount: underdevelopedThemes.length
    });

    return {
      disconnectedConcepts,
      weakConnections,
      underdevelopedThemes
    };
  }

  async expand(prompt: string, maxIterations: number = 10): Promise<GraphData> {
    if (this.expandPromise) {
      console.log('Waiting for ongoing expansion to complete');
      await this.expandPromise;
      return this.calculateMetrics();
    }

    try {
      this.isExpanding = true;
      console.log('Starting expansion with prompt:', prompt);
      this.currentIteration = 0;

      const startTime = performance.now();

      // Initial expansion with timeout
      this.expandPromise = Promise.race([
        this.performIterativeExpansion(prompt, maxIterations),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Expansion timeout')), this.maxProcessingTime)
        )
      ]);

      try {
        await this.expandPromise;
      } catch (error) {
        if (error.message === 'Expansion timeout') {
          console.log('Expansion timed out, returning current state');
          return this.calculateMetrics();
        }
        throw error;
      }

      // Knowledge gap analysis if time permits
      const remainingTime = this.maxProcessingTime - (performance.now() - startTime);
      if (remainingTime > 2000) { // Only perform gap analysis if we have >2s remaining
        const gaps = await this.detectKnowledgeGaps();
        if (this.debugLogging) {
          console.log('Detected knowledge gaps:', gaps);
        }

        // Additional expansion focused on gaps
        if (gaps.disconnectedConcepts.length > 0 || gaps.underdevelopedThemes.length > 0) {
          if (this.debugLogging) {
            console.log('Starting gap-focused expansion');
          }
          const gapPrompt = `
            Analyze and expand upon these areas:
            Disconnected concepts: ${gaps.disconnectedConcepts.join(', ')}
            Underdeveloped themes: ${gaps.underdevelopedThemes.map(t => t.theme).join(', ')}
            ${prompt}
          `;

          const gapIterations = Math.max(2, Math.floor(maxIterations / 4));
          this.expandPromise = this.performIterativeExpansion(gapPrompt, gapIterations);
          await this.expandPromise;
        }
      }

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

    // First pass: collect all proposed nodes and generate IDs if needed
    const lastNodeId = Math.max(0, ...Array.from(this.graph.nodes()).map(id => parseInt(id)));
    nodes.forEach((node, index) => {
      if (!node) {
        console.warn('Null node data received');
        return;
      }

      // Generate ID for new nodes if not provided
      const nodeId = node.id || (lastNodeId + index + 1);
      const nodeLabel = node.label || `Node ${nodeId}`;

      nodeLabels.set(nodeId, nodeLabel);
      validNodes.push({
        id: nodeId,
        label: nodeLabel,
        type: node.type || 'concept',
        metadata: node.metadata || {}
      });

      console.log('Processing node:', {
        id: nodeId,
        label: nodeLabel,
        type: node.type || 'concept'
      });
    });

    // Second pass: validate edges and track connected nodes
    edges.forEach(edge => {
      if (!edge) {
        console.warn('Null edge data received');
        return;
      }

      const sourceId = (edge.sourceId || validNodes[0]?.id)?.toString();
      const targetId = (edge.targetId || validNodes[1]?.id)?.toString();

      if (!sourceId || !targetId) {
        console.warn('Edge missing source or target:', edge);
        return;
      }

      const sourceExists = this.graph.hasNode(sourceId) || validNodes.some(n => n.id.toString() === sourceId);
      const targetExists = this.graph.hasNode(targetId) || validNodes.some(n => n.id.toString() === targetId);

      if (sourceExists && targetExists) {
        validEdges.push({
          sourceId: parseInt(sourceId),
          targetId: parseInt(targetId),
          label: edge.label || 'related_to',
          weight: edge.weight || 1
        });

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
          source: sourceId,
          sourceLabel: nodeLabels.get(parseInt(sourceId)) || 'existing node',
          target: targetId,
          targetLabel: nodeLabels.get(parseInt(targetId)) || 'existing node',
          label: edge.label || 'related_to'
        });
      }
    });

    const isValid = validNodes.length > 0 || validEdges.length > 0;
    console.log('Expansion validation results:', {
      proposedNodes: nodes.length,
      proposedEdges: edges.length,
      validNodes: validNodes.length,
      validEdges: validEdges.length,
      isValid
    });

    return {
      isValid,
      connectedNodes,
      validNodes,
      validEdges
    };
  }

  private async performIterativeExpansion(initialPrompt: string, maxIterations: number): Promise<void> {
    let currentPrompt = initialPrompt;
    this.currentIteration = 0;
    const startTime = performance.now();

    while (this.currentIteration < maxIterations) {
      if (performance.now() - startTime > this.maxProcessingTime) {
        if (this.debugLogging) {
          console.log('Reached processing time limit, stopping expansion');
        }
        break;
      }

      if (this.debugLogging) {
        console.log(`Starting iteration ${this.currentIteration + 1}/${maxIterations}`);
        console.log('Current prompt:', currentPrompt);
      }

      try {
        const expansion = await expandGraph(currentPrompt, this.graph);

        if (!expansion.nodes?.length && !expansion.edges?.length) {
          if (this.debugLogging) {
            console.log('No expansion data received, ending iterations');
          }
          break;
        }

        // Validate expansion data
        const { isValid, validNodes, validEdges } = this.validateExpansionData(
          expansion.nodes || [],
          expansion.edges || []
        );

        if (!isValid) {
          if (this.debugLogging) {
            console.log('Skipping invalid expansion - no valid connected components found');
          }
          break;
        }

        // Track initial state for logging
        const initialState = this.debugLogging ? {
          nodes: this.graph.order,
          edges: this.graph.size,
          disconnectedBefore: this.countDisconnectedNodes()
        } : null;

        // Process validated nodes and edges
        let hasChanges = false;

        for (const nodeData of validNodes) {
          try {
            const node = await storage.createNode(nodeData);
            if (!this.graph.hasNode(node.id.toString())) {
              this.graph.addNode(node.id.toString(), { ...node });
              hasChanges = true;
              if (this.debugLogging) {
                console.log('Added node:', {
                  id: node.id,
                  label: node.label,
                  type: node.type
                });
              }
            }
          } catch (error) {
            console.error('Failed to create node:', error);
          }
        }

        for (const edgeData of validEdges) {
          try {
            const edge = await storage.createEdge(edgeData);
            const sourceId = edge.sourceId.toString();
            const targetId = edge.targetId.toString();

            if (!this.graph.hasEdge(sourceId, targetId)) {
              this.graph.addEdge(sourceId, targetId, { ...edge });
              hasChanges = true;
              if (this.debugLogging) {
                console.log('Added edge:', {
                  source: sourceId,
                  target: targetId,
                  label: edge.label
                });
              }
            }
          } catch (error) {
            console.error('Failed to create edge:', error);
          }
        }

        // If we made changes, calculate metrics and emit update
        if (hasChanges) {
          const graphData = this.calculateMetrics();
          if (this.onUpdate) {
            this.onUpdate(graphData);
          }
        }

        // Log final state and changes if debug logging is enabled
        if (this.debugLogging && initialState) {
          const finalState = {
            nodes: this.graph.order,
            edges: this.graph.size,
            disconnectedAfter: this.countDisconnectedNodes()
          };

          console.log('Iteration complete:', {
            iteration: this.currentIteration + 1,
            maxIterations,
            before: initialState,
            after: finalState,
            nodesAdded: finalState.nodes - initialState.nodes,
            edgesAdded: finalState.edges - initialState.edges,
            disconnectedNodeChange: finalState.disconnectedAfter - initialState.disconnectedBefore
          });
        }

        if (expansion.nextQuestion) {
          currentPrompt = expansion.nextQuestion;
        } else {
          break;
        }

        this.currentIteration++;
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between iterations
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

    // Calculate scale-free network metrics
    const degreeDistribution = topology.degreePowerLaw(this.graph);
    const hubNodes = this.identifyHubs();
    const bridgingNodes = this.identifyBridgingNodes();

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
        degree,
        scaleFreeness: {
          powerLawExponent: degreeDistribution.alpha,
          fitQuality: degreeDistribution.r2,
          hubNodes: hubNodes.map(node => ({
            id: parseInt(node),
            degree: this.graph.degree(node),
            influence: betweenness[node]
          })),
          bridgingNodes: bridgingNodes.map(node => ({
            id: parseInt(node),
            communities: Array.from(this.graph.neighbors(node)).length,
            betweenness: betweenness[node]
          }))
        }
      },
      clusters
    };
  }

  private identifyHubs(): string[] {
    // Identify nodes with significantly higher degree than average
    const degrees = Array.from(this.graph.nodes()).map(node => ({
      id: node,
      degree: this.graph.degree(node)
    }));

    const avgDegree = degrees.reduce((sum, n) => sum + n.degree, 0) / degrees.length;
    const stdDev = Math.sqrt(
      degrees.reduce((sum, n) => sum + Math.pow(n.degree - avgDegree, 2), 0) / degrees.length
    );

    // Consider nodes with degree > avg + 2*stddev as hubs
    return degrees
      .filter(n => n.degree > avgDegree + 2 * stdDev)
      .map(n => n.id);
  }

  private identifyBridgingNodes(): string[] {
    const betweenness = centrality.betweenness(this.graph);
    const avgBetweenness = Object.values(betweenness)
      .reduce((sum, val) => sum + val, 0) / Object.keys(betweenness).length;

    // Nodes with high betweenness are likely bridge nodes
    return Object.entries(betweenness)
      .filter(([_, value]) => value > 2 * avgBetweenness)
      .map(([node, _]) => node);
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

  setOnUpdateCallback(onUpdate: (graphData: GraphDataWithClusters) => void): void { // Added setOnUpdateCallback
    this.onUpdate = onUpdate;
  }

  async expandWithSemantics(content: {
    text: string;
    images?: Array<{ data: string; type: string; }>;
  }): Promise<GraphData> {
    if (this.isExpanding) {
      console.log('Waiting for ongoing expansion to complete');
      await this.expandPromise;
      return this.calculateMetrics();
    }

    try {
      this.isExpanding = true;
      console.log('Starting semantic expansion with content:', {
        hasText: !!content.text,
        imageCount: content.images?.length || 0,
        textLength: content.text.length
      });

      // Get current nodes
      const currentNodes = Array.from(this.graph.nodes()).map(nodeId => ({
        ...this.graph.getNodeAttributes(nodeId),
        id: parseInt(nodeId)
      })) as Node[];

      const startTime = performance.now();

      // Perform semantic analysis
      const analysisResult = await semanticAnalysis.analyzeContent(content, currentNodes);
      console.log('Semantic analysis complete:', {
        newNodes: analysisResult.nodes.length,
        newEdges: analysisResult.edges.length,
        reasoning: analysisResult.reasoning,
        processingTime: `${(performance.now() - startTime).toFixed(2)}ms`
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

      const totalTime = performance.now() - startTime;
      console.log('Multimodal expansion complete:', {
        processingTime: `${totalTime.toFixed(2)}ms`,
        nodesAdded: this.graph.order - currentNodes.length,
        edgesAdded: this.graph.size - this.graph.edges().length,
        imageNodes: analysisResult.nodes.filter(n => n.metadata?.imageUrl).length
      });

      return this.calculateMetrics();
    } finally {
      this.isExpanding = false;
    }
  }

  private async validateGraphConsistency(): Promise<{
    isValid: boolean;
    anomalies: Array<{
      type: 'disconnected' | 'inconsistent' | 'redundant';
      nodeIds: number[];
      description: string;
    }>;
  }> {
    console.log('Starting graph consistency validation');
    const anomalies = [];

    // Check for disconnected subgraphs
    const components = connectedComponents(this.graph);
    console.log('Found graph components:', {
      count: components.length,
      sizes: components.map(c => c.length)
    });

    if (components.length > 1) {
      const disconnectedNodes = components.slice(1).flat().map(id => parseInt(id));
      console.log('Detected disconnected subgraphs:', {
        mainComponentSize: components[0].length,
        disconnectedNodes
      });

      anomalies.push({
        type: 'disconnected',
        nodeIds: disconnectedNodes,
        description: 'Disconnected subgraphs detected'
      });
    }

    // Check for semantic inconsistencies using node clusters
    const clusters = this.semanticClustering.clusterNodes();
    console.log('Analyzing semantic clusters:', {
      clusterCount: clusters.length,
      clusterSizes: clusters.map(c => c.nodes.length)
    });

    for (const cluster of clusters) {
      const clusterNodes = cluster.nodes.map(id => parseInt(id));
      const semanticTheme = cluster.metadata.semanticTheme;
      console.log('Analyzing cluster:', {
        clusterId: cluster.clusterId,
        theme: semanticTheme,
        nodeCount: clusterNodes.length
      });

      // Analyze relationships within cluster
      for (const nodeId of clusterNodes) {
        const neighbors = Array.from(this.graph.neighbors(nodeId.toString()));
        const neighborNodes = neighbors.map(id => parseInt(id));

        // Find edges that connect to semantically unrelated nodes
        const unrelatedConnections = neighborNodes.filter(neighborId => {
          const neighborCluster = clusters.find(c =>
            c.nodes.includes(neighborId.toString())
          );
          return neighborCluster &&
            neighborCluster.metadata.semanticTheme !== semanticTheme &&
            neighborCluster.metadata.coherenceScore < 0.3;
        });

        if (unrelatedConnections.length > 0) {
          console.log('Found potentially inconsistent relationships:', {
            nodeId,
            unrelatedConnections,
            semanticTheme
          });

          anomalies.push({
            type: 'inconsistent',
            nodeIds: [nodeId, ...unrelatedConnections],
            description: `Potentially inconsistent relationships detected in cluster ${cluster.clusterId}`
          });
        }
      }
    }

    // Check for redundant edges
    const edges = Array.from(this.graph.edges());
    const redundantPairs = new Map<string, Edge[]>();

    edges.forEach(edgeId => {
      const edge = this.graph.getEdgeAttributes(edgeId);
      const key = `${edge.sourceId}-${edge.targetId}`;
      if (!redundantPairs.has(key)) {
        redundantPairs.set(key, []);
      }
      redundantPairs.get(key)!.push(edge);
    });

    let redundantEdgeCount = 0;
    redundantPairs.forEach((edges, key) => {
      if (edges.length > 1) {
        const [source, target] = key.split('-').map(id => parseInt(id));
        console.log('Found redundant edges:', {
          source,
          target,
          edgeCount: edges.length,
          edges: edges.map(e => ({
            id: e.id,
            label: e.label,
            weight: e.weight
          }))
        });

        redundantEdgeCount += edges.length - 1;
        anomalies.push({
          type: 'redundant',
          nodeIds: [source, target],
          description: `Multiple edges between nodes detected`
        });
      }
    });

    console.log('Validation complete:', {
      anomalyCount: anomalies.length,
      anomalyTypes: anomalies.map(a => a.type),
      redundantEdgeCount
    });

    return {
      isValid: anomalies.length === 0,
      anomalies
    };
  }

  private async repairGraphAnomalies(anomalies: Array<{
    type: 'disconnected' | 'inconsistent' | 'redundant';
    nodeIds: number[];
    description: string;
  }>): Promise<void> {
    console.log('Starting graph repair for anomalies:', {
      count: anomalies.length,
      types: anomalies.map(a => a.type)
    });

    for (const anomaly of anomalies) {
      console.log('Repairing anomaly:', {
        type: anomaly.type,
        nodeIds: anomaly.nodeIds,
        description: anomaly.description
      });

      switch (anomaly.type) {
        case 'disconnected': {
          const mainComponent = connectedComponents(this.graph)[0];
          const mainComponentNode = mainComponent[0];

          console.log('Repairing disconnected nodes:', {
            mainComponentNode,
            nodesToConnect: anomaly.nodeIds
          });

          for (const nodeId of anomaly.nodeIds) {
            try {
              const edge = await storage.createEdge({
                sourceId: parseInt(mainComponentNode),
                targetId: nodeId,
                label: 'connected_to',
                weight: 1
              });

              this.graph.addEdge(
                mainComponentNode,
                nodeId.toString(),
                { ...edge }
              );

              console.log('Connected node to main component:', {
                nodeId,
                mainComponentNode,
                edgeId: edge.id
              });
            } catch (error) {
              console.error('Failed to repair disconnected node:', {
                nodeId,
                error: error instanceof Error ? error.message : String(error)
              });
            }
          }
          break;
        }

        case 'inconsistent': {
          const [sourceId, ...targetIds] = anomaly.nodeIds;
          const sourceNode = this.graph.getNodeAttributes(sourceId.toString());
          const targetNodes = targetIds.map(id =>
            this.graph.getNodeAttributes(id.toString())
          );

          console.log('Validating semantic relationships:', {
            sourceNode: {
              id: sourceId,
              label: sourceNode.label
            },
            targetNodes: targetNodes.map(n => ({
              id: n.id,
              label: n.label
            }))
          });

          try {
            const analysis = await semanticAnalysis.validateRelationships(
              sourceNode,
              targetNodes
            );

            console.log('Relationship validation results:', {
              sourceId,
              confidenceScores: analysis.confidenceScores,
              reasoning: analysis.reasoning
            });

            for (const targetId of targetIds) {
              const edgeId = this.graph.edge(
                sourceId.toString(),
                targetId.toString()
              );
              if (edgeId) {
                const confidence = analysis.confidenceScores[targetId] || 0;
                this.graph.setEdgeAttribute(edgeId, 'weight', confidence);
                console.log('Updated edge weight based on semantic confidence:', {
                  edgeId,
                  sourceId,
                  targetId,
                  newWeight: confidence
                });
              }
            }
          } catch (error) {
            console.error('Failed to validate relationships:', {
              sourceId,
              targetIds,
              error: error instanceof Error ? error.message : String(error)
            });
          }
          break;
        }

        case 'redundant': {
          const [sourceId, targetId] = anomaly.nodeIds;
          const edges = Array.from(this.graph.edges())
            .filter(edgeId => {
              const edge = this.graph.getEdgeAttributes(edgeId);
              return edge.sourceId === sourceId && edge.targetId === targetId;
            })
            .map(edgeId => ({
              id: edgeId,
              ...this.graph.getEdgeAttributes(edgeId)
            }))
            .sort((a, b) => b.weight - a.weight);

          console.log('Merging redundant edges:', {
            sourceId,
            targetId,
            edgeCount: edges.length,
            edges: edges.map(e => ({
              id: e.id,
              weight: e.weight
            }))
          });

          // Keep the edge with highest weight, remove others
          const keptEdge = edges[0];
          console.log('Keeping edge with highest weight:', {
            edgeId: keptEdge.id,
            weight: keptEdge.weight
          });

          for (let i = 1; i < edges.length; i++) {
            console.log('Removing redundant edge:', {
              edgeId: edges[i].id,
              weight: edges[i].weight
            });
            this.graph.dropEdge(edges[i].id);
          }
          break;
        }
      }
    }

    console.log('Graph repair complete');
  }
}

export const graphManager = new GraphManager();