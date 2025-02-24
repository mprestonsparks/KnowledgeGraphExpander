import { describe, it, expect, vi, beforeEach } from "vitest";
import { GraphManager } from "./graph_manager";
import { storage } from "./storage";
import { expandGraph } from "./openai_client";
import type { Node, Edge } from "../shared/schema";

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
    vi.mocked(storage.getFullGraph).mockResolvedValue({
      nodes: mockNodes,
      edges: mockEdges,
      metrics: {
        betweenness: {},
        eigenvector: {},
        degree: {}
      }
    });
  });

  it("should perform iterative graph expansion", async () => {
    await graphManager.initialize();

    const mockExpansionResult = {
      reasoning: "<|thinking|>Testing expansion reasoning</|thinking|>",
      nodes: [
        { label: "D", type: "concept", metadata: { description: "Test node" } }
      ],
      edges: [
        { sourceId: 3, targetId: 4, label: "leads_to", weight: 1 }
      ],
      nextQuestion: null // This will stop the iteration
    };

    vi.mocked(expandGraph).mockResolvedValue(mockExpansionResult);
    vi.mocked(storage.createNode).mockResolvedValue({ id: 4, ...mockExpansionResult.nodes[0] });
    vi.mocked(storage.createEdge).mockResolvedValue({ id: 3, ...mockExpansionResult.edges[0] });

    const result = await graphManager.expand("Test expansion");

    // Verify graph was expanded
    expect(result.nodes).toHaveLength(4); // Original 3 + new node
    expect(result.edges).toHaveLength(3); // Original 2 + new edge

    // Verify storage operations
    expect(storage.createNode).toHaveBeenCalledWith(mockExpansionResult.nodes[0]);
    expect(storage.createEdge).toHaveBeenCalledWith(mockExpansionResult.edges[0]);

    // Verify metrics were calculated
    expect(result.metrics).toBeDefined();
    expect(result.metrics.betweenness).toBeDefined();
    expect(result.metrics.eigenvector).toBeDefined();
    expect(result.metrics.degree).toBeDefined();
  }, { timeout: 10000 });

  it("should handle missing properties in expansion response", async () => {
    await graphManager.initialize();

    const mockExpansionResult = {
      nodes: [{ label: "E", type: "concept", metadata: { description: "Test node" } }],
      edges: [],
      nextQuestion: null
    };

    vi.mocked(expandGraph).mockResolvedValue(mockExpansionResult);
    vi.mocked(storage.createNode).mockResolvedValue({ id: 5, ...mockExpansionResult.nodes[0] });

    const result = await graphManager.expand("Test missing properties");

    expect(result.nodes).toHaveLength(4); // Original 3 + new node
    expect(result.edges).toHaveLength(2); // Original edges only
  }, { timeout: 10000 });

  it("should handle errors during expansion", async () => {
    await graphManager.initialize();

    vi.mocked(expandGraph).mockRejectedValue(new Error("Test error"));

    const result = await graphManager.expand("Test error handling");

    // Should maintain original graph state
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(2);
  }, { timeout: 10000 });

  it("should broadcast graph updates after expansion", async () => {
    await graphManager.initialize();

    const mockExpansion = {
      reasoning: "<|thinking|>Testing update broadcast</|thinking|>",
      nodes: [{ label: "E", type: "concept", metadata: { description: "Broadcast test" } }],
      edges: [{ sourceId: 1, targetId: 5, label: "broadcasts_to", weight: 1 }],
      nextQuestion: "What other broadcasts are possible?"
    };

    vi.mocked(expandGraph).mockResolvedValue(mockExpansion);
    vi.mocked(storage.createNode).mockResolvedValue({ id: 5, ...mockExpansion.nodes[0] });
    vi.mocked(storage.createEdge).mockResolvedValue({ id: 4, ...mockExpansion.edges[0] });

    const result = await graphManager.expand("Test broadcasting");

    // Verify the final graph state includes the new node and edge
    expect(result.nodes).toContainEqual(expect.objectContaining({ id: 5, label: "E" }));
    expect(result.edges).toContainEqual(expect.objectContaining({ 
      sourceId: 1, 
      targetId: 5,
      label: "broadcasts_to" 
    }));
  }, { timeout: 10000 });

  it("should handle concurrent expansion requests correctly", async () => {
    await graphManager.initialize();

    const expansion1 = {
      reasoning: "<|thinking|>First expansion</|thinking|>",
      nodes: [{ label: "F", type: "concept", metadata: {} }],
      edges: [{ sourceId: 3, targetId: 6, label: "first", weight: 1 }],
      nextQuestion: "First follow-up?"
    };

    const expansion2 = {
      reasoning: "<|thinking|>Second expansion</|thinking|>",
      nodes: [{ label: "G", type: "concept", metadata: {} }],
      edges: [{ sourceId: 6, targetId: 7, label: "second", weight: 1 }],
      nextQuestion: "Second follow-up?"
    };

    vi.mocked(expandGraph)
      .mockResolvedValueOnce(expansion1)
      .mockResolvedValueOnce(expansion2);

    vi.mocked(storage.createNode)
      .mockResolvedValueOnce({ id: 6, ...expansion1.nodes[0] })
      .mockResolvedValueOnce({ id: 7, ...expansion2.nodes[0] });

    vi.mocked(storage.createEdge)
      .mockResolvedValueOnce({ id: 5, ...expansion1.edges[0] })
      .mockResolvedValueOnce({ id: 6, ...expansion2.edges[0] });

    // Execute expansions concurrently
    const [result1, result2] = await Promise.all([
      graphManager.expand("First expansion"),
      graphManager.expand("Second expansion")
    ]);

    // Verify both operations completed and produced consistent results
    expect(result1).toEqual(result2);
    expect(result1.nodes).toHaveLength(4); // Original 3 + 1 new node
    expect(result1.edges).toHaveLength(3); // Original 2 + 1 new edge
  }, { timeout: 10000 });
});