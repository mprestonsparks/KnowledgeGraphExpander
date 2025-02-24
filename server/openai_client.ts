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

  // Get current graph state
  const existingNodes = Array.from(currentGraph.nodes()).map(nodeId => ({
    id: parseInt(nodeId),
    ...currentGraph.getNodeAttributes(nodeId)
  }));

  const nextNodeId = Math.max(...existingNodes.map(n => n.id)) + 1;

  console.log('[DEBUG] Current graph state:', {
    nodeCount: existingNodes.length,
    existingIds: existingNodes.map(n => n.id),
    nextNodeId
  });

  try {
    const response = await openaiInstance!.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a knowledge graph expansion system. Add ONE new node and connect it to the graph.

Format response as JSON:
{
  "node": { 
    "label": "string (node name)",
    "type": "concept",
    "metadata": { "description": "string" }
  },
  "edge": {
    "sourceId": number (pick an existing node ID: ${existingNodes.map(n => n.id).join(', ')}),
    "targetId": ${nextNodeId} (this will be the new node's ID),
    "label": "string (relationship)",
    "weight": 1
  }
}`
        },
        {
          role: "user", 
          content: `Current nodes: ${JSON.stringify(existingNodes.map(n => ({ id: n.id, label: n.label })), null, 2)}

Add a node related to: ${prompt}`
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
      console.log('[DEBUG] OpenAI response:', result);
    } catch (error) {
      throw new Error('Invalid JSON response from OpenAI');
    }

    // Validate response
    if (!result.node || !result.edge) {
      console.error('[DEBUG] Invalid response structure:', result);
      throw new Error('Invalid response format: missing node or edge');
    }

    // Validate node
    if (!result.node.label || !result.node.type || !result.node.metadata?.description) {
      console.error('[DEBUG] Invalid node:', result.node);
      throw new Error('Invalid node: missing required fields');
    }

    // Validate edge
    if (!result.edge.sourceId || !result.edge.label || typeof result.edge.weight !== 'number') {
      console.error('[DEBUG] Invalid edge:', result.edge);
      throw new Error('Invalid edge: missing required fields');
    }

    // Check edge connections
    const sourceExists = existingNodes.some(n => n.id === result.edge.sourceId);
    if (!sourceExists) {
      console.error('[DEBUG] Invalid source node:', {
        sourceId: result.edge.sourceId,
        existingNodes: existingNodes.map(n => n.id)
      });
      throw new Error('Invalid edge: source node does not exist');
    }

    // Ensure edge.targetId is set to the next available ID
    result.edge.targetId = nextNodeId;

    console.log('[DEBUG] Validated expansion result:', {
      node: result.node,
      edge: result.edge
    });

    // Return simplified structure
    return {
      nodes: [result.node],
      edges: [result.edge]
    };

  } catch (error) {
    console.error('[DEBUG] Expansion error:', error);
    throw error;
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