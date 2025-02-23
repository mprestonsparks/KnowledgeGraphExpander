import OpenAI from "openai";
import Graph from "graphology";
import { type InsertNode, type InsertEdge } from "@shared/schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
export async function expandGraph(prompt: string, currentGraph: Graph) {
  const existingNodes = Array.from(currentGraph.nodes()).map(nodeId => 
    currentGraph.getNodeAttributes(nodeId)
  );

  const response = await openai.chat.completions.create({
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

  if (!response.choices[0].message.content) {
    throw new Error('No content in OpenAI response');
  }

  const result = JSON.parse(response.choices[0].message.content) as {
    nodes: InsertNode[];
    edges: InsertEdge[];
  };

  return result;
}