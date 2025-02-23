import OpenAI from "openai";
import Graph from "graphology";
import { type InsertNode, type InsertEdge } from "@shared/schema";

let openaiInstance: OpenAI | null = null;

export function initializeOpenAI(apiKey: string) {
  openaiInstance = new OpenAI({ 
    apiKey,
    dangerouslyAllowBrowser: true // Required for test environment
  });
}

// For testing purposes
export function setOpenAIInstance(instance: OpenAI) {
  openaiInstance = instance;
}

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
export async function expandGraph(prompt: string, currentGraph: Graph) {
  if (!openaiInstance) {
    initializeOpenAI(process.env.OPENAI_API_KEY || '');
  }

  const existingNodes = Array.from(currentGraph.nodes()).map(nodeId => 
    currentGraph.getNodeAttributes(nodeId)
  );

  try {
    const response = await openaiInstance!.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a knowledge graph expansion system. Given the current graph nodes and a prompt, generate new nodes and edges to expand the graph. Format the response as JSON with the following structure:
          {
            "nodes": [{ "label": string, "type": string, "metadata": object }],
            "edges": [{ "sourceId": number, "targetId": number, "label": string, "weight": number }]
          }`
        },
        {
          role: "user",
          content: `Current nodes: ${JSON.stringify(existingNodes)}\nPrompt: ${prompt}`
        }
      ],
      response_format: { type: "json_object" }
    });

    if (!response.choices?.[0]?.message?.content) {
      throw new Error('No content in OpenAI response');
    }

    let result: { nodes: InsertNode[]; edges: InsertEdge[] };
    try {
      result = JSON.parse(response.choices[0].message.content);
    } catch (error) {
      throw new Error('Invalid JSON response from OpenAI');
    }

    if (!Array.isArray(result.nodes) || !Array.isArray(result.edges)) {
      throw new Error('Invalid response format from OpenAI');
    }

    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to expand graph');
  }
}

export interface RelationshipSuggestion {
  sourceId: number;
  targetId: number;
  label: string;
  confidence: number;
  explanation: string;
}

export async function suggestRelationships(currentGraph: Graph): Promise<RelationshipSuggestion[]> {
  if (!openaiInstance) {
    initializeOpenAI(process.env.OPENAI_API_KEY || '');
  }

  const nodes = Array.from(currentGraph.nodes()).map(nodeId => 
    currentGraph.getNodeAttributes(nodeId)
  );

  const existingEdges = Array.from(currentGraph.edges()).map(edgeId => {
    const edge = currentGraph.getEdgeAttributes(edgeId);
    return {
      source: currentGraph.source(edgeId),
      target: currentGraph.target(edgeId),
      label: edge.label
    };
  });

  try {
    const response = await openaiInstance!.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a knowledge graph relationship expert. Analyze the current nodes and edges, then suggest potential new relationships between existing nodes. For each suggestion, provide:
          - The source and target node IDs
          - A descriptive label for the relationship
          - A confidence score (0-1)
          - A brief explanation of why this relationship might be valid
          Format as JSON array: [{ "sourceId": number, "targetId": number, "label": string, "confidence": number, "explanation": string }]`
        },
        {
          role: "user",
          content: `Nodes: ${JSON.stringify(nodes)}\nExisting Edges: ${JSON.stringify(existingEdges)}\nSuggest new relationships between these nodes.`
        }
      ],
      response_format: { type: "json_object" }
    });

    if (!response.choices?.[0]?.message?.content) {
      throw new Error('No content in OpenAI response');
    }

    const result = JSON.parse(response.choices[0].message.content);
    if (!Array.isArray(result)) {
      throw new Error('Invalid response format from OpenAI');
    }

    return result.map((suggestion: any) => ({
      sourceId: parseInt(suggestion.sourceId),
      targetId: parseInt(suggestion.targetId),
      label: suggestion.label,
      confidence: Math.min(1, Math.max(0, parseFloat(suggestion.confidence))),
      explanation: suggestion.explanation
    }));
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to get relationship suggestions');
  }
}