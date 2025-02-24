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

    mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn()
        }
      }
    };
    setOpenAIInstance(mockOpenAI as unknown as OpenAI);
  });

  it("should format and validate graph expansion", async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            reasoning: "<|thinking|>Test reasoning|</thinking|>",
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
            ],
            nextQuestion: "What are the applications?"
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
    expect(result.nextQuestion).toBe("What are the applications?");
  });

  it("should validate node connectivity", async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            nodes: [
              {
                label: "Isolated Node",
                type: "concept",
                metadata: { description: "Node without connections" }
              }
            ],
            edges: [],
            nextQuestion: null
          })
        },
        finish_reason: "stop"
      }]
    };

    mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);
    await expect(expandGraph("Test invalid node", graph)).rejects.toThrow(/Invalid response format/);
  });

  it("should handle invalid JSON responses", async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{
        message: {
          content: "Not JSON"
        }
      }]
    });

    await expect(expandGraph("Test invalid format", graph)).rejects.toThrow("Invalid JSON response from OpenAI");
  });

  it("should validate edge references", async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            nodes: [
              {
                label: "New Node",
                type: "concept",
                metadata: { description: "Test" }
              }
            ],
            edges: [
              {
                sourceId: 999, // Non-existent node
                targetId: 2,
                label: "invalid_edge",
                weight: 1
              }
            ]
          })
        }
      }]
    };

    mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);
    await expect(expandGraph("Test invalid edge", graph)).rejects.toThrow(/Invalid edge.*references non-existent node/);
  });

  it("should preserve existing graph state", async () => {
    const initialNodeCount = graph.order;
    const initialEdgeCount = graph.size;

    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            nodes: [],
            edges: [],
            nextQuestion: null
          })
        }
      }]
    };

    mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);
    await expandGraph("Empty expansion", graph);

    expect(graph.order).toBe(initialNodeCount);
    expect(graph.size).toBe(initialEdgeCount);
  });
});