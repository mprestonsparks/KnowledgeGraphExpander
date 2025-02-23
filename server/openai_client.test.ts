import { describe, it, expect, vi, beforeEach } from "vitest";
import { expandGraph, setOpenAIInstance } from "./openai_client";
import Graph from "graphology";
import OpenAI from "openai";

describe("OpenAI Client", () => {
  let graph: Graph;
  let mockOpenAI: any;

  beforeEach(() => {
    graph = new Graph();
    graph.addNode("1", { label: "Machine Learning", type: "concept", metadata: {} });
    graph.addNode("2", { label: "Neural Networks", type: "concept", metadata: {} });
    graph.addEdge("1", "2", { label: "includes", weight: 1 });

    // Create a fresh mock for each test
    mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn()
        }
      }
    };
    setOpenAIInstance(mockOpenAI as unknown as OpenAI);
  });

  it("should expand graph based on prompt", async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            nodes: [
              {
                label: "Deep Learning",
                type: "concept",
                metadata: { description: "Advanced neural network architectures" }
              }
            ],
            edges: [
              {
                sourceId: 2,
                targetId: 3,
                label: "specializes_in",
                weight: 1
              }
            ]
          })
        },
        finish_reason: "stop"
      }]
    };

    mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

    const result = await expandGraph("Expand on Neural Networks", graph);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].label).toBe("Deep Learning");
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].label).toBe("specializes_in");
  });

  it("should handle OpenAI API errors gracefully", async () => {
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error("API Error"));
    await expect(expandGraph("Invalid prompt", graph)).rejects.toThrow("API Error");
  });

  it("should validate response format", async () => {
    const invalidResponse = {
      choices: [{
        message: {
          content: "Invalid JSON",
        },
        finish_reason: "stop"
      }]
    };

    mockOpenAI.chat.completions.create.mockResolvedValue(invalidResponse);
    await expect(expandGraph("Test invalid format", graph)).rejects.toThrow("Invalid JSON response from OpenAI");
  });

  it("should maintain graph consistency after expansion", async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            nodes: [
              {
                label: "Backpropagation",
                type: "concept",
                metadata: { description: "Learning algorithm" }
              }
            ],
            edges: [
              {
                sourceId: 2,
                targetId: 3,
                label: "uses",
                weight: 1
              }
            ]
          })
        },
        finish_reason: "stop"
      }]
    };

    mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

    const result = await expandGraph("Explain Neural Network training", graph);

    // Verify new content is valid
    expect(result.nodes[0].type).toBe("concept");
    expect(result.edges[0].weight).toBe(1);

    // Verify the original nodes/edges are preserved in the graph
    expect(graph.hasNode("1")).toBeTruthy();
    expect(graph.hasNode("2")).toBeTruthy();
    expect(graph.hasEdge("1", "2")).toBeTruthy();
  });
});