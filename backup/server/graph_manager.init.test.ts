import { describe, it, expect, vi, beforeEach } from "vitest";
import { GraphManager } from "./graph_manager";
import { storage } from "./storage";
import { type Node, type Edge } from "@shared/schema";

// Mock dependencies
vi.mock("./storage");

describe("GraphManager Initialization", () => {
  let graphManager: GraphManager;
  const mockNodes: Node[] = [
    { id: 1, label: "A", type: "concept", metadata: {} },
    { id: 2, label: "B", type: "concept", metadata: {} }
  ];

  const mockEdges: Edge[] = [
    { id: 1, sourceId: 1, targetId: 2, label: "connects", weight: 1 }
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

  it("should initialize an empty graph correctly", () => {
    expect(graphManager["graph"].order).toBe(0);
    expect(graphManager["graph"].size).toBe(0);
  });

  it("should load nodes and edges during initialization", async () => {
    await graphManager.initialize();
    expect(graphManager["graph"].order).toBe(2);
    expect(graphManager["graph"].size).toBe(1);
  });

  it("should maintain node attributes after initialization", async () => {
    await graphManager.initialize();
    const nodeAttrs = graphManager["graph"].getNodeAttributes("1");
    expect(nodeAttrs.label).toBe("A");
    expect(nodeAttrs.type).toBe("concept");
  });

  it("should maintain edge attributes after initialization", async () => {
    await graphManager.initialize();
    const edgeAttrs = graphManager["graph"].getEdgeAttributes(
      graphManager["graph"].edges()[0]
    );
    expect(edgeAttrs.label).toBe("connects");
    expect(edgeAttrs.weight).toBe(1);
  });

  it("should handle empty graph initialization", async () => {
    (storage.getFullGraph as jest.Mock).mockResolvedValue({
      nodes: [],
      edges: [],
      metrics: {
        betweenness: {},
        eigenvector: {},
        degree: {}
      }
    });

    await graphManager.initialize();
    expect(graphManager["graph"].order).toBe(0);
    expect(graphManager["graph"].size).toBe(0);
  });
});