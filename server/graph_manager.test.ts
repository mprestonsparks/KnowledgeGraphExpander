import { describe, it, expect, vi, beforeEach } from "vitest";
import { GraphManager } from "./graph_manager";
import { storage } from "./storage";
import { expandGraph } from "./openai_client";
import type { Node, Edge, InsertNode, InsertEdge } from "@shared/schema";

// Mock dependencies
vi.mock("./storage");
vi.mock("./openai_client");

describe("GraphManager - Expansion Tests", () => {
  let graphManager: GraphManager;

  beforeEach(async () => {
    vi.resetAllMocks();
    graphManager = new GraphManager();

    // Setup initial mock state
    vi.mocked(storage.getFullGraph).mockResolvedValue({
      nodes: [
        { id: 1, label: "Initial Concept", type: "concept", metadata: {} }
      ],
      edges: [],
      metrics: {
        betweenness: { 1: 0 },
        eigenvector: { 1: 0 },
        degree: { 1: 0 }
      }
    });

    await graphManager.initialize();
  });

  it("should process OpenAI expansion and update graph", async () => {
    // Mock OpenAI response
    const mockExpansion = {
      reasoning: "<|thinking|>Test expansion|</thinking|>",
      nodes: [
        { 
          label: "New Concept",
          type: "concept",
          metadata: { description: "Test description" }
        }
      ],
      edges: [
        {
          sourceId: 1,
          targetId: 2,
          label: "relates_to",
          weight: 1
        }
      ],
      nextQuestion: "What are the implications?"
    };

    vi.mocked(expandGraph).mockResolvedValue(mockExpansion);

    // Mock storage responses
    vi.mocked(storage.createNode).mockImplementation(async (node: InsertNode) => ({
      id: 2,
      ...node
    }));

    vi.mocked(storage.createEdge).mockImplementation(async (edge: InsertEdge) => ({
      id: 1,
      ...edge
    }));

    const result = await graphManager.startIterativeExpansion("Explain the concept");

    // Verify graph updates
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);

    // Verify storage calls
    expect(storage.createNode).toHaveBeenCalledWith(mockExpansion.nodes[0]);
    expect(storage.createEdge).toHaveBeenCalledWith(mockExpansion.edges[0]);
  });

  it("should handle multiple expansion iterations", async () => {
    const expansions = [
      {
        nodes: [{ label: "First Node", type: "concept", metadata: {} }],
        edges: [{ sourceId: 1, targetId: 2, label: "first", weight: 1 }],
        nextQuestion: "Continue exploration?"
      },
      {
        nodes: [{ label: "Second Node", type: "concept", metadata: {} }],
        edges: [{ sourceId: 2, targetId: 3, label: "second", weight: 1 }],
        nextQuestion: null
      }
    ];

    vi.mocked(expandGraph)
      .mockResolvedValueOnce(expansions[0])
      .mockResolvedValueOnce(expansions[1]);

    let nextNodeId = 2;
    vi.mocked(storage.createNode).mockImplementation(async (node: InsertNode) => ({
      id: nextNodeId++,
      ...node
    }));

    let nextEdgeId = 1;
    vi.mocked(storage.createEdge).mockImplementation(async (edge: InsertEdge) => ({
      id: nextEdgeId++,
      ...edge
    }));

    const result = await graphManager.startIterativeExpansion("Start exploration");

    expect(result.nodes).toHaveLength(3); // Initial + 2 new nodes
    expect(result.edges).toHaveLength(2); // 2 new edges
    expect(expandGraph).toHaveBeenCalledTimes(2);
  });

  it("should validate node connections", async () => {
    const invalidExpansion = {
      nodes: [
        { label: "Disconnected Node", type: "concept", metadata: {} }
      ],
      edges: [], // No edges = disconnected node
      nextQuestion: null
    };

    vi.mocked(expandGraph).mockResolvedValue(invalidExpansion);

    const result = await graphManager.startIterativeExpansion("Invalid expansion");

    // Should not add disconnected nodes
    expect(result.nodes).toHaveLength(1); // Only initial node
    expect(result.edges).toHaveLength(0);
    expect(storage.createNode).not.toHaveBeenCalled();
  });

  it("should handle failed node/edge creation", async () => {
    const mockExpansion = {
      nodes: [{ label: "Test Node", type: "concept", metadata: {} }],
      edges: [{ sourceId: 1, targetId: 2, label: "test", weight: 1 }],
      nextQuestion: null
    };

    vi.mocked(expandGraph).mockResolvedValue(mockExpansion);
    vi.mocked(storage.createNode).mockRejectedValue(new Error("Storage error"));

    const result = await graphManager.startIterativeExpansion("Test error handling");

    // Should maintain existing state
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
  });

  it("should handle node ID assignment correctly", async () => {
    const mockExpansion = {
      nodes: [
        { 
          label: "New Node 1",
          type: "concept",
          metadata: { description: "Test 1" }
        },
        { 
          label: "New Node 2",
          type: "concept",
          metadata: { description: "Test 2" }
        }
      ],
      edges: [
        {
          sourceId: 1,  // Existing node
          targetId: 2,  // Will be assigned to first new node
          label: "connects_to",
          weight: 1
        },
        {
          sourceId: 2,  // First new node
          targetId: 3,  // Will be assigned to second new node
          label: "relates_to",
          weight: 1
        }
      ],
      nextQuestion: "Test follow-up?"
    };

    vi.mocked(expandGraph).mockResolvedValue(mockExpansion);

    let nodeIdCounter = 2;  // Start after initial node (id: 1)
    vi.mocked(storage.createNode).mockImplementation(async (node: InsertNode) => ({
      id: nodeIdCounter++,
      ...node
    }));

    let edgeIdCounter = 1;
    vi.mocked(storage.createEdge).mockImplementation(async (edge: InsertEdge) => ({
      id: edgeIdCounter++,
      ...edge
    }));

    const result = await graphManager.startIterativeExpansion("Test node IDs");

    // Verify node creation and ID assignment
    expect(result.nodes).toHaveLength(3); // Initial + 2 new nodes
    expect(result.nodes.map(n => n.id)).toEqual([1, 2, 3]);

    // Verify edge creation with correct node references
    expect(result.edges).toHaveLength(2);
    expect(result.edges[0].sourceId).toBe(1);
    expect(result.edges[0].targetId).toBe(2);
    expect(result.edges[1].sourceId).toBe(2);
    expect(result.edges[1].targetId).toBe(3);
  });
});