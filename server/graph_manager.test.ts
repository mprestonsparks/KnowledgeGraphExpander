import { describe, it, expect, vi, beforeEach } from "vitest";
import { GraphManager } from "./graph_manager";
import { storage } from "./storage";
import { expandGraph } from "./openai_client";
import { type Node, type Edge } from "@shared/schema";

// Mock dependencies
vi.mock("./storage");
vi.mock("./openai_client");

describe("GraphManager", () => {
  let graphManager: GraphManager;
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
    (storage.getFullGraph as jest.Mock).mockResolvedValue({
      nodes: mockNodes,
      edges: mockEdges,
      metrics: {
        betweenness: {},
        eigenvector: {},
        degree: {}
      }
    });
  });

  it("should initialize graph from storage", async () => {
    await graphManager.initialize();
    const graphData = await graphManager.calculateMetrics();
    expect(graphData.nodes).toHaveLength(3);
    expect(graphData.edges).toHaveLength(2);
  });

  it("should expand graph with new knowledge", async () => {
    await graphManager.initialize();

    const mockExpansion = {
      nodes: [{ label: "D", type: "concept", metadata: {} }],
      edges: [{ sourceId: 3, targetId: 4, label: "leads_to", weight: 1 }]
    };

    (expandGraph as jest.Mock).mockResolvedValue(mockExpansion);
    (storage.createNode as jest.Mock).mockResolvedValue({ id: 4, ...mockExpansion.nodes[0] });
    (storage.createEdge as jest.Mock).mockResolvedValue({ id: 3, ...mockExpansion.edges[0] });

    const result = await graphManager.expand("Expand knowledge about C");

    // Verify graph structure was updated
    expect(result.nodes).toHaveLength(4); // Original 3 + new node
    expect(result.edges).toHaveLength(3); // Original 2 + new edge

    // Verify storage operations
    expect(storage.createNode).toHaveBeenCalledTimes(1);
    expect(storage.createEdge).toHaveBeenCalledTimes(1);

    // Verify metrics are present
    expect(result.metrics.betweenness).toBeDefined();
    expect(result.metrics.eigenvector).toBeDefined();
    expect(result.metrics.degree[4]).toBe(1); // New node should have one connection
  });

  it("should handle concurrent expansions safely", async () => {
    await graphManager.initialize();

    const expansion1 = {
      nodes: [{ label: "D", type: "concept", metadata: {} }],
      edges: [{ sourceId: 3, targetId: 4, label: "leads_to", weight: 1 }]
    };

    const expansion2 = {
      nodes: [{ label: "E", type: "concept", metadata: {} }],
      edges: [{ sourceId: 4, targetId: 5, label: "follows", weight: 1 }]
    };

    (expandGraph as jest.Mock)
      .mockResolvedValueOnce(expansion1)
      .mockResolvedValueOnce(expansion2);

    (storage.createNode as jest.Mock)
      .mockResolvedValueOnce({ id: 4, ...expansion1.nodes[0] })
      .mockResolvedValueOnce({ id: 5, ...expansion2.nodes[0] });

    (storage.createEdge as jest.Mock)
      .mockResolvedValueOnce({ id: 3, ...expansion1.edges[0] })
      .mockResolvedValueOnce({ id: 4, ...expansion2.edges[0] });

    // Execute expansions concurrently
    const [result1, result2] = await Promise.all([
      graphManager.expand("First expansion"),
      graphManager.expand("Second expansion")
    ]);

    // Both should get the final state
    expect(result1.nodes).toEqual(result2.nodes);
    expect(result1.edges).toEqual(result2.edges);
    expect(result1.nodes).toHaveLength(4); // Original 3 + 1 new node
    expect(result1.edges).toHaveLength(3); // Original 2 + 1 new edge
  });

  it("should maintain graph consistency during expansion", async () => {
    await graphManager.initialize();

    // Attempt expansion with invalid edges
    const mockExpansion = {
      nodes: [{ label: "D", type: "concept", metadata: {} }],
      edges: [{ sourceId: 999, targetId: 4, label: "invalid", weight: 1 }] // Invalid source node
    };

    (expandGraph as jest.Mock).mockResolvedValue(mockExpansion);
    (storage.createNode as jest.Mock).mockResolvedValue({ id: 4, ...mockExpansion.nodes[0] });

    const result = await graphManager.expand("Test consistency");

    // Only valid operations should succeed
    expect(result.nodes).toHaveLength(4); // Original 3 + new node
    expect(result.edges).toHaveLength(2); // Original edges only, invalid edge not added
  });
});