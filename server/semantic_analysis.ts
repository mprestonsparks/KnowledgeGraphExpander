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
Output in JSON format with the following structure:
{
  "nodes": [{ "label": string, "type": string, "metadata": { "description": string } }],
  "edges": [{ "sourceId": number, "targetId": number, "label": string, "weight": number }],
  "reasoning": string
}

Rules:
1. Node types should be one of: "concept", "entity", "process", "attribute"
2. Edge labels should describe meaningful relationships
3. Edge weights should be between 0 and 1
4. Include semantic reasoning about why these connections were made`;

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

      const result = JSON.parse(response.content[0].text);

      // Add IDs to new nodes starting after the last existing node ID
      const lastNodeId = Math.max(0, ...existingNodes.map(n => n.id));
      result.nodes = result.nodes.map((node: any, index: number) => ({
        ...node,
        id: lastNodeId + index + 1
      }));

      return {
        nodes: result.nodes,
        edges: result.edges,
        reasoning: result.reasoning
      };
    } catch (error) {
      console.error('Semantic analysis failed:', error);
      throw new Error('Failed to perform semantic analysis');
    }
  }

  async suggestRelationships(nodes: Node[]): Promise<Edge[]> {
    try {
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        messages: [
          {
            role: "user",
            content: `Given these knowledge graph nodes, suggest meaningful relationships between them. Output as JSON array of edges.
Each edge should have: sourceId, targetId, label, and weight (0-1).
Only suggest high-confidence relationships.

Nodes:
${JSON.stringify(nodes, null, 2)}`
          }
        ],
        max_tokens: 1024
      });

      const suggestions = JSON.parse(response.content[0].text);
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