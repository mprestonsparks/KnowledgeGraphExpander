import Anthropic from '@anthropic-ai/sdk';
import type { Node, Edge, InsertNode, InsertEdge, RelationshipSuggestion } from "@shared/schema";

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

interface ValidationResult {
  confidenceScores: Record<number, number>;
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

  async validateRelationships(sourceNode: Node, targetNodes: Node[]): Promise<ValidationResult> {
    try {
      const systemPrompt = `You are a semantic relationship validator. Analyze the connections between the source node and target nodes.

Important: Your response must be valid JSON in this exact format:
{
  "confidenceScores": { [nodeId: number]: number },
  "reasoning": string
}

Rules:
1. Each confidence score should be between 0 and 1
2. Higher scores indicate stronger semantic relationships
3. Include reasoning about relationship validity
4. Response must be pure JSON - no explanation text before or after`;

      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        messages: [
          {
            role: "user",
            content: `${systemPrompt}

Source Node:
${JSON.stringify(sourceNode, null, 2)}

Target Nodes:
${JSON.stringify(targetNodes, null, 2)}

Analyze the semantic coherence and validity of relationships between the source node and each target node.`
          }
        ],
        max_tokens: 1024
      });

      const responseText = response.content[0].text.trim();
      let parsedResponse;

      try {
        parsedResponse = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse validation response:', responseText);
        throw new Error('Invalid JSON response from relationship validation');
      }

      return {
        confidenceScores: parsedResponse.confidenceScores,
        reasoning: parsedResponse.reasoning
      };
    } catch (error) {
      console.error('Failed to validate relationships:', error);
      throw new Error('Failed to validate relationships');
    }
  }

  async suggestRelationships(nodes: Node[]): Promise<RelationshipSuggestion[]> {
    try {
      const prompt = `Given these knowledge graph nodes, suggest meaningful relationships between them. 
Output must be a valid JSON array in this format:
[{
  "sourceId": number,
  "targetId": number,
  "label": string,
  "confidence": number,
  "explanation": string
}]

Rules:
1. Only suggest high-confidence relationships
2. Include detailed explanations for each suggestion
3. Confidence scores should be between 0 and 1
4. Response must be pure JSON - no explanation text before or after

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

      return suggestions;
    } catch (error) {
      console.error('Failed to suggest relationships:', error);
      throw new Error('Failed to suggest relationships');
    }
  }
}

export const semanticAnalysis = new SemanticAnalysisService();