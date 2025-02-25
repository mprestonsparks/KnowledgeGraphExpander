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
        betweenness: {},
        eigenvector: {},
        degree: {}
      }
    });

    vi.mocked(storage.createEdge).mockImplementation(async (edge) => ({
      id: Math.floor(Math.random() * 1000),
      ...edge
    }));
  });

  it("should perform iterative graph expansion", async () => {
    await graphManager.initialize();

    const mockExpansionResult = {
      nodes: [
        { label: "D", type: "concept", metadata: { description: "Test node" } }
      ],
      edges: [
        { sourceId: 3, targetId: 4, label: "leads_to", weight: 1 }
      ],
      nextQuestion: null
    };

    vi.mocked(expandGraph).mockResolvedValue(mockExpansionResult);
    vi.mocked(storage.createNode).mockResolvedValue({ id: 4, ...mockExpansionResult.nodes[0] });
    vi.mocked(storage.createEdge).mockResolvedValue({ id: 3, ...mockExpansionResult.edges[0] });

    const result = await graphManager.expand("Test expansion");

    expect(result.nodes).toHaveLength(4); // Original 3 + 1 new node
    expect(result.edges).toHaveLength(3); // Original 2 + 1 new edge

    // Verify storage operations
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

    const expansion1 = {
      nodes: [{ label: "D", type: "concept", metadata: {} }],
      edges: [{ sourceId: 3, targetId: 4, label: "first", weight: 1 }],
      nextQuestion: null
    };

    const expansion2 = {
      nodes: [], // Second expansion only adds edges
      edges: [{ sourceId: 1, targetId: 4, label: "second", weight: 1 }],
      nextQuestion: null
    };

    vi.mocked(expandGraph)
      .mockResolvedValueOnce(expansion1)
      .mockResolvedValueOnce(expansion2);

    vi.mocked(storage.createNode)
      .mockResolvedValueOnce({ id: 4, ...expansion1.nodes[0] });

    vi.mocked(storage.createEdge)
      .mockResolvedValueOnce({ id: 5, ...expansion1.edges[0] })
      .mockResolvedValueOnce({ id: 6, ...expansion2.edges[0] });

    // Execute expansions concurrently
    const [result1, result2] = await Promise.all([
      graphManager.expand("First expansion"),
      graphManager.expand("Second expansion")
    ]);

    // Verify results are consistent
    expect(result1.nodes).toEqual(result2.nodes);
    expect(result1.edges).toEqual(result2.edges);
    expect(result1.nodes).toHaveLength(4); // Original 3 + 1 new node
    expect(result1.edges).toHaveLength(4); // Original 2 + 2 new edges
  }, { timeout: 10000 });

  describe("reconnectDisconnectedNodes", () => {
    it("should identify and reconnect disconnected nodes", async () => {
      await graphManager.initialize();

      // Mock initial state with node 3 disconnected
      vi.mocked(storage.getFullGraph).mockResolvedValueOnce({
        nodes: mockNodes,
        edges: [mockEdges[0]], // Only include first edge, leaving node 3 disconnected
        metrics: {
          betweenness: {},
          eigenvector: {},
          degree: {}
        }
      });

      // Mock edge creation for reconnection
      vi.mocked(storage.createEdge).mockResolvedValueOnce({
        id: 4,
        sourceId: 2,
        targetId: 3,
        label: "related_to",
        weight: 1
      });

      const beforeReconnect = await graphManager.reconnectDisconnectedNodes();
      const disconnectedBefore = beforeReconnect.nodes.filter(n =>
        !beforeReconnect.edges.some(e =>
          e.sourceId === n.id || e.targetId === n.id
        )
      );

      expect(disconnectedBefore).toHaveLength(1);
      expect(disconnectedBefore[0].id).toBe(3);

      // Perform reconnection
      const afterReconnect = await graphManager.reconnectDisconnectedNodes();

      // Verify new edges were created
      const newEdges = afterReconnect.edges.filter(e =>
        !mockEdges.some(me => me.id === e.id)
      );

      expect(newEdges.length).toBeGreaterThan(0);

      // Verify nodes are now connected
      const disconnectedAfter = afterReconnect.nodes.filter(n =>
        !afterReconnect.edges.some(e =>
          e.sourceId === n.id || e.targetId === n.id
        )
      );

      expect(disconnectedAfter.length).toBeLessThan(disconnectedBefore.length);
    });
  });
});