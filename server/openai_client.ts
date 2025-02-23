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