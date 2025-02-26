import Anthropic from '@anthropic-ai/sdk';
import type { Node, Edge, InsertNode, InsertEdge } from "@shared/schema";

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: process.env.NODE_ENV === 'test' // Enable for testing environment
});

interface SemanticAnalysisResult {
  nodes: InsertNode[];
  edges: InsertEdge[];
  reasoning: string;
}

export class SemanticAnalysisService {
  async analyzeContent(content: string, existingNodes: Node[]): Promise<SemanticAnalysisResult> {
    try {
      const systemPrompt = `You are a semantic analysis expert. Analyze the following content and extract knowledge graph elements.

Important: Your response must be valid JSON in this exact format:
{
  "nodes": [{ "label": string, "type": string, "metadata": { "description": string } }],
  "edges": [{ "sourceId": number, "targetId": number, "label": string, "weight": number }],
  "reasoning": string
}

Rules:
1. Node types should be one of: "concept", "entity", "process", "attribute"
2. Edge labels should describe meaningful relationships
3. Edge weights should be between 0 and 1
4. Include semantic reasoning about why these connections were made
5. Response must be pure JSON - no explanation text before or after`;

      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        messages: [
          {
            role: "user",
            content: `${systemPrompt}\n\nExisting nodes:\n${JSON.stringify(existingNodes, null, 2)}\n\nContent to analyze:\n${content}`
          }
        ],
        max_tokens: 1024
      });

      const responseText = response.content[0].text.trim();
      let parsedResponse;

      try {
        parsedResponse = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse API response:', responseText);
        throw new Error('Invalid JSON response from semantic analysis');
      }

      // Add IDs to new nodes starting after the last existing node ID
      const lastNodeId = Math.max(0, ...existingNodes.map(n => n.id));
      const nodesWithIds = parsedResponse.nodes.map((node: any, index: number) => ({
        ...node,
        id: lastNodeId + index + 1
      }));

      return {
        nodes: nodesWithIds,
        edges: parsedResponse.edges,
        reasoning: parsedResponse.reasoning
      };
    } catch (error) {
      console.error('Semantic analysis failed:', error);
      throw new Error('Failed to perform semantic analysis');
    }
  }

  async suggestRelationships(nodes: Node[]): Promise<Edge[]> {
    try {
      const prompt = `Given these knowledge graph nodes, suggest meaningful relationships between them. 
Output must be a valid JSON array of edges in this format:
[{ "sourceId": number, "targetId": number, "label": string, "weight": number }]

Only suggest high-confidence relationships.
Response must be pure JSON - no explanation text before or after.

Nodes:
${JSON.stringify(nodes, null, 2)}`;

      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1024
      });

      const responseText = response.content[0].text.trim();
      let suggestions;

      try {
        suggestions = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse API response:', responseText);
        throw new Error('Invalid JSON response from relationship suggestions');
      }

      return suggestions.map((edge: Edge, index: number) => ({
        ...edge,
        id: index + 1
      }));
    } catch (error) {
      console.error('Failed to suggest relationships:', error);
      throw new Error('Failed to suggest relationships');
    }
  }
}

export const semanticAnalysis = new SemanticAnalysisService();