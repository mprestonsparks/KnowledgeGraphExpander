import OpenAI from "openai";
import Graph from "graphology";
import { type InsertNode, type InsertEdge } from "@shared/schema";

let openaiInstance: OpenAI | null = null;

export function initializeOpenAI(apiKey: string) {
  openaiInstance = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true
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

  const existingNodes = Array.from(currentGraph.nodes()).map(nodeId => ({
    id: parseInt(nodeId),
    ...currentGraph.getNodeAttributes(nodeId)
  }));

  const existingEdges = Array.from(currentGraph.edges()).map(edgeId => ({
    source: parseInt(currentGraph.source(edgeId)),
    target: parseInt(currentGraph.target(edgeId)),
    ...currentGraph.getEdgeAttributes(edgeId)
  }));

  console.log('Current graph state for expansion:', {
    prompt,
    nodeCount: existingNodes.length,
    edgeCount: existingEdges.length
  });

  try {
    const response = await openaiInstance!.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a knowledge graph reasoning system. When expanding the graph, follow these rules:

1. Every new node MUST have at least one connection to either:
   - An existing node in the graph
   - Another new node being added in this iteration

2. First, provide your reasoning about how to expand the graph:
<|thinking|>
[Step-by-step reasoning about potential new concepts and relationships]
</|thinking|>

3. Then, extract a local graph that maintains connectivity. Return the result as JSON:
{
  "reasoning": string, // Your <|thinking|> block
  "nodes": [{ 
    "label": string,
    "type": "concept",
    "metadata": { description: string }
  }],
  "edges": [{ 
    "sourceId": number,
    "targetId": number,
    "label": string,
    "weight": number
  }],
  "nextQuestion": string // A follow-up question to explore further
}

IMPORTANT: 
- Each node must have at least one edge connecting it
- Edges must form valid connections between nodes
- Focus on quality over quantity - suggest only a few highly relevant nodes and edges
- Ensure edges reference either existing node IDs or new nodes being added`
        },
        {
          role: "user",
          content: `Current graph state:
Nodes: ${JSON.stringify(existingNodes, null, 2)}
Edges: ${JSON.stringify(existingEdges, null, 2)}

Prompt for expansion: ${prompt}`
        }
      ],
      response_format: { type: "json_object" }
    });

    if (!response.choices?.[0]?.message?.content) {
      throw new Error('No content in OpenAI response');
    }

    let result;
    try {
      result = JSON.parse(response.choices[0].message.content);
      console.log('Parsed expansion result:', {
        reasoning: result.reasoning,
        newNodes: result.nodes?.length,
        newEdges: result.edges?.length,
        nextQuestion: result.nextQuestion
      });
    } catch (error) {
      throw new Error('Invalid JSON response from OpenAI');
    }

    if (!result.nodes || !Array.isArray(result.nodes) || !result.edges || !Array.isArray(result.edges)) {
      throw new Error('Invalid response format from OpenAI');
    }

    // Verify nodes have required fields
    result.nodes.forEach((node: any, index: number) => {
      if (!node.label || !node.type || !node.metadata) {
        throw new Error(`Invalid node at index ${index}: missing required fields`);
      }
    });

    // Verify edges have required fields and valid connections
    result.edges.forEach((edge: any, index: number) => {
      if (!edge.sourceId || !edge.targetId || !edge.label || typeof edge.weight !== 'number') {
        throw new Error(`Invalid edge at index ${index}: missing required fields`);
      }

      const sourceExists = existingNodes.some(n => n.id === edge.sourceId) ||
                          result.nodes.some((_: any, i: number) => edge.sourceId === existingNodes.length + i + 1);

      const targetExists = existingNodes.some(n => n.id === edge.targetId) ||
                          result.nodes.some((_: any, i: number) => edge.targetId === existingNodes.length + i + 1);

      if (!sourceExists || !targetExists) {
        throw new Error(`Invalid edge at index ${index}: references non-existent node`);
      }
    });

    return result;
  } catch (error) {
    console.error('Failed to expand graph:', error);
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
    console.log('Initializing OpenAI client');
    initializeOpenAI(process.env.OPENAI_API_KEY || '');
  }

  // Get all nodes and their metadata
  const nodes = Array.from(currentGraph.nodes()).map(nodeId => ({
    id: parseInt(nodeId),
    ...currentGraph.getNodeAttributes(nodeId)
  }));

  console.log('Current nodes:', nodes);

  // Get existing relationships for context
  const existingEdges = Array.from(currentGraph.edges()).map(edgeId => ({
    source: parseInt(currentGraph.source(edgeId)),
    target: parseInt(currentGraph.target(edgeId)),
    ...currentGraph.getEdgeAttributes(edgeId)
  }));

  console.log('Current edges:', existingEdges);

  if (nodes.length < 2) {
    console.log('Not enough nodes for suggestions');
    return [];
  }

  try {
    console.log('Requesting suggestions from OpenAI');
    const response = await openaiInstance!.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a knowledge graph relationship expert. Analyze the current nodes and edges, then suggest potential new relationships between existing nodes that don't already have direct connections. For each suggestion:
          - Choose nodes that would benefit from being connected
          - Provide a specific, descriptive label for the relationship
          - Assign a confidence score based on semantic relevance
          - Include a brief explanation of the suggested connection
          Format as JSON array: [{ "sourceId": number, "targetId": number, "label": string, "confidence": number, "explanation": string }]`
        },
        {
          role: "user",
          content: `Current graph state:\nNodes: ${JSON.stringify(nodes, null, 2)}\nExisting connections: ${JSON.stringify(existingEdges, null, 2)}\n\nSuggest 2-3 new relationships between nodes that don't already have direct connections.`
        }
      ],
      response_format: { type: "json_object" }
    });

    console.log('OpenAI response:', response.choices?.[0]?.message?.content);

    if (!response.choices?.[0]?.message?.content) {
      console.error('No content in OpenAI response');
      return [];
    }

    let result: RelationshipSuggestion[];
    try {
      const parsed = JSON.parse(response.choices[0].message.content);
      result = Array.isArray(parsed) ? parsed : parsed.suggestions || [];
      console.log('Parsed suggestions:', result);
    } catch (error) {
      console.error('Failed to parse OpenAI response:', error);
      return [];
    }

    // Validate and filter suggestions
    const validSuggestions = result
      .filter(suggestion => {
        const isValid = 
          nodes.some(n => n.id === suggestion.sourceId) &&
          nodes.some(n => n.id === suggestion.targetId) &&
          !existingEdges.some(e =>
            (e.source === suggestion.sourceId && e.target === suggestion.targetId) ||
            (e.source === suggestion.targetId && e.target === suggestion.sourceId)
          );

        if (!isValid) {
          console.log('Filtered out invalid suggestion:', suggestion);
        }
        return isValid;
      })
      .map(suggestion => ({
        sourceId: suggestion.sourceId,
        targetId: suggestion.targetId,
        label: suggestion.label,
        confidence: Math.min(1, Math.max(0, parseFloat(suggestion.confidence.toString()))),
        explanation: suggestion.explanation
      }));

    console.log('Final valid suggestions:', validSuggestions);
    return validSuggestions;
  } catch (error) {
    console.error('Error getting relationship suggestions:', error);
    return [];
  }
}