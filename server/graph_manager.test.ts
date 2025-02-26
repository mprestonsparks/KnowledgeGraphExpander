import { describe, it, expect, vi, beforeEach } from "vitest";
import { GraphManager } from "./graph_manager";
import { storage } from "./storage";
import { expandGraph } from "./openai_client";
import { semanticAnalysis } from "./semantic_analysis";
import type { Node, Edge } from "@shared/schema";

// Mock dependencies
vi.mock("./storage");
vi.mock("./openai_client");
vi.mock("./semantic_analysis");

describe("GraphManager", () => {
  let graphManager: GraphManager;

  // Setup test data
  const mockNodes: Node[] = [
    { id: 1, label: "A", type: "concept", metadata: {} },
    { id: 2, label: "B", type: "concept", metadata: {} },
    { id: 3, label: "C", type: "concept", metadata: {} }
  ];

  const mockEdges: Edge[] = [
    { id: 1, sourceId: 1, targetId: 2, label: "connects", weight: 1 },
    { id: 2, sourceId: 2, targetId: 3, label: "connects", weight: 1 }
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    graphManager = new GraphManager();

    // Mock storage responses
    vi.mocked(storage.getFullGraph).mockResolvedValue({
      nodes: mockNodes,
      edges: mockEdges,
      metrics: {
        betweenness: { 1: 0.5, 2: 0.5, 3: 0.0 },
        eigenvector: { 1: 0.5, 2: 0.5, 3: 0.0 },
        degree: { 1: 1, 2: 1, 3: 0 },
        scaleFreeness: {
          powerLawExponent: 2.1,
          fitQuality: 0.85,
          hubNodes: [{ id: 1, degree: 2, influence: 0.8 }],
          bridgingNodes: [{ id: 2, communities: 2, betweenness: 0.7 }]
        }
      }
    });

    vi.mocked(storage.createNode).mockImplementation(async (node) => ({
      id: mockNodes.length + 1,
      ...node
    }));

    vi.mocked(storage.createEdge).mockImplementation(async (edge) => ({
      id: mockEdges.length + 1,
      ...edge
    }));
  });

  it("should perform iterative graph expansion", async () => {
    await graphManager.initialize();

    const mockExpansionResult = {
      nodes: [
        { id: 1, label: "A", type: "concept", metadata: {} } // Duplicate node to test deduplication
      ],
      edges: [
        { sourceId: 1, targetId: 2, label: "connects", weight: 1 } // Duplicate edge
      ],
      nextQuestion: null
    };

    vi.mocked(expandGraph).mockResolvedValue(mockExpansionResult);

    const result = await graphManager.expand("Test expansion");

    // Due to deduplication, nodes and edges should remain unchanged
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(2);

    // Verify storage operations were attempted
    expect(storage.createNode).toHaveBeenCalledWith(mockExpansionResult.nodes[0]);
    expect(storage.createEdge).toHaveBeenCalledWith(mockExpansionResult.edges[0]);

    // Verify metrics
    expect(result.metrics).toBeDefined();
    expect(result.metrics.betweenness).toBeDefined();
    expect(result.metrics.eigenvector).toBeDefined();
    expect(result.metrics.degree).toBeDefined();
  }, { timeout: 10000 });

  it("should handle concurrent expansion requests correctly", async () => {
    await graphManager.initialize();

    // Both expansions attempt to add duplicate nodes/edges
    const expansion1 = {
      nodes: [{ id: 1, label: "A", type: "concept", metadata: {} }],
      edges: [{ sourceId: 1, targetId: 2, label: "connects", weight: 1 }],
      nextQuestion: null
    };

    const expansion2 = {
      nodes: [{ id: 2, label: "B", type: "concept", metadata: {} }],
      edges: [{ sourceId: 2, targetId: 3, label: "connects", weight: 1 }],
      nextQuestion: null
    };

    vi.mocked(expandGraph)
      .mockResolvedValueOnce(expansion1)
      .mockResolvedValueOnce(expansion2);

    // Execute expansions concurrently
    const [result1, result2] = await Promise.all([
      graphManager.expand("First expansion"),
      graphManager.expand("Second expansion")
    ]);

    // Due to deduplication, both results should be identical
    expect(result1.nodes).toEqual(result2.nodes);
    expect(result1.edges).toEqual(result2.edges);
    expect(result1.nodes).toHaveLength(3); // Original nodes only
    expect(result1.edges).toHaveLength(2); // Original edges only
  }, { timeout: 10000 });

  it("should handle expansion timeout", async () => {
    await graphManager.initialize();

    // Mock a slow expansion that would trigger timeout
    vi.mocked(expandGraph).mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 9000)); // Longer than maxProcessingTime
      return {
        nodes: [],
        edges: [],
        nextQuestion: null
      };
    });

    const result = await graphManager.expand("Test timeout", 10);

    // Should return current state without waiting for expansion
    expect(result.nodes).toHaveLength(mockNodes.length);
    expect(result.edges).toHaveLength(mockEdges.length);
  });

  it("should perform multimodal content analysis", async () => {
    await graphManager.initialize();

    // Mock multimodal analysis response
    const mockMultimodalResult = {
      nodes: [{
        label: "Image Concept",
        type: "image_concept",
        metadata: {
          description: "Test image analysis",
          imageUrl: "data:image/png;base64,test",
          imageDescription: "Test image description"
        }
      }],
      edges: [{
        sourceId: 1,
        targetId: mockNodes.length + 1,
        label: "visual_relation",
        weight: 0.8
      }],
      reasoning: "Visual analysis test"
    };

    vi.mocked(semanticAnalysis.analyzeContent).mockResolvedValue(mockMultimodalResult);

    const result = await graphManager.expandWithSemantics({
      text: "Test content",
      images: [{
        data: "base64_test_image",
        type: "image/png"
      }]
    });

    // Verify multimodal node creation
    expect(result.nodes).toContainEqual(
      expect.objectContaining({
        type: "image_concept",
        metadata: expect.objectContaining({
          imageUrl: expect.any(String),
          imageDescription: expect.any(String)
        })
      })
    );

    // Verify edge creation
    expect(result.edges).toContainEqual(
      expect.objectContaining({
        label: "visual_relation",
        weight: 0.8
      })
    );
  });

  it("should respect maxIterations in recursive expansion", async () => {
    await graphManager.initialize();

    const maxIterations = 3;
    let iterationCount = 0;

    vi.mocked(expandGraph).mockImplementation(async () => {
      iterationCount++;
      return {
        nodes: [{ label: `Test Node ${iterationCount}`, type: "concept", metadata: {} }],
        edges: [],
        nextQuestion: iterationCount < maxIterations ? "Next question" : null
      };
    });

    await graphManager.expand("Test iterations", maxIterations);

    expect(iterationCount).toBeLessThanOrEqual(maxIterations);
    expect(expandGraph).toHaveBeenCalledTimes(iterationCount);
  });

  it("should handle early exit conditions", async () => {
    await graphManager.initialize();

    const mockEmptyExpansion = {
      nodes: [],
      edges: [],
      nextQuestion: null
    };

    vi.mocked(expandGraph).mockResolvedValue(mockEmptyExpansion);

    const result = await graphManager.expand("Test early exit", 10);

    // Should exit early due to no expansion data
    expect(expandGraph).toHaveBeenCalledTimes(1);
    expect(result.nodes).toHaveLength(mockNodes.length);
  });

  describe("reconnectDisconnectedNodes", () => {
    it("should identify and reconnect disconnected nodes", async () => {
      // Mock initial state with node 3 disconnected
      const initialGraphData = {
        nodes: mockNodes,
        edges: [mockEdges[0]], // Only include first edge
        metrics: {
          betweenness: { 1: 0.5, 2: 0.5, 3: 0.0 },
          eigenvector: { 1: 0.5, 2: 0.5, 3: 0.0 },
          degree: { 1: 1, 2: 1, 3: 0 }
        }
      };

      // Set up mock responses
      vi.mocked(storage.getFullGraph)
        .mockResolvedValueOnce(initialGraphData)  // For initialize()
        .mockResolvedValueOnce(initialGraphData); // For reconnection

      await graphManager.initialize();

      // Mock new edge creation
      const newEdge = {
        id: 3,
        sourceId: 2,
        targetId: 3,
        label: "related_to",
        weight: 1
      };
      vi.mocked(storage.createEdge).mockResolvedValueOnce(newEdge);

      // Get initial state
      const beforeReconnect = await graphManager.calculateMetrics();
      const disconnectedNodes = beforeReconnect.nodes.filter(n =>
        !beforeReconnect.edges.some(e => e.sourceId === n.id || e.targetId === n.id)
      );

      // Verify initial disconnected state
      expect(disconnectedNodes).toHaveLength(1);
      expect(disconnectedNodes[0].id).toBe(3);

      // Perform reconnection
      const afterReconnect = await graphManager.reconnectDisconnectedNodes();

      // Verify edges were added
      const newEdges = afterReconnect.edges.filter(e =>
        !initialGraphData.edges.some(me => me.id === e.id)
      );
      expect(newEdges).toHaveLength(1);

      // Verify no disconnected nodes remain
      const disconnectedAfter = afterReconnect.nodes.filter(n =>
        !afterReconnect.edges.some(e => e.sourceId === n.id || e.targetId === n.id)
      );
      expect(disconnectedAfter).toHaveLength(0);
    });
  });
});