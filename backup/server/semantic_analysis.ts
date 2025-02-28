import { z } from "zod";
import Anthropic from '@anthropic-ai/sdk';
import type { Node, Edge, InsertNode, InsertEdge, RelationshipSuggestion } from "@shared/schema";

// the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
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

interface MultimodalContent {
  text: string;
  images?: Array<{
    data: string; // base64 encoded image data
    type: string; // MIME type
  }>;
}

function isValidBase64(str: string): boolean {
  if (!str) return false;

  try {
    // Check for valid base64 characters only
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(str)) return false;

    // Check length is multiple of 4
    if (str.length % 4 !== 0) return false;

    // Try to decode and verify
    const buffer = Buffer.from(str, 'base64');
    return Buffer.from(buffer.toString('base64')).length === buffer.length;
  } catch {
    return false;
  }
}

export class SemanticAnalysisService {
  async analyzeContent(content: MultimodalContent, existingNodes: Node[] = []): Promise<SemanticAnalysisResult> {
    try {
      if (!content.text) {
        throw new Error('Text content is required');
      }

      // Validate image data if present
      if (content.images?.length) {
        for (const image of content.images) {
          if (!isValidBase64(image.data)) {
            throw new Error('Invalid image data format');
          }
        }
      }

      const systemPrompt = `You are a semantic analysis expert. Analyze the following content and extract knowledge graph elements.

Important: Your response must be valid JSON in this exact format:
{
  "nodes": [{ 
    "label": string, 
    "type": string, 
    "metadata": { 
      "description": string,
      "imageUrl"?: string,
      "imageDescription"?: string,
      "documentContext"?: string
    } 
  }],
  "edges": [{ "sourceId": number, "targetId": number, "label": string, "weight": number }],
  "reasoning": string
}

Rules:
1. Node types should be one of: "concept", "entity", "process", "attribute"
2. Edge labels should describe meaningful relationships
3. Edge weights should be between 0 and 1
4. Include semantic reasoning about why these connections were made
5. For image nodes, include descriptions and visual context
6. Response must be pure JSON - no explanation text before or after`;

      // Prepare message content
      const messages = [{
        role: "user" as const,
        content: [
          {
            type: "text",
            text: `${systemPrompt}\n\nExisting nodes:\n${JSON.stringify(existingNodes, null, 2)}\n\nContent to analyze:\n${content.text}`
          }
        ]
      }];

      // Add image content if available
      if (content.images?.length) {
        for (const image of content.images) {
          messages[0].content.push({
            type: "image",
            source: {
              type: "base64",
              media_type: image.type,
              data: image.data
            }
          });
        }
      }

      const response = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219",
        messages,
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
      throw error;
    }
  }

  async validateRelationships(sourceNode: Node | null, targetNodes: Node[] | null): Promise<ValidationResult> {
    try {
      if (!sourceNode) {
        throw new Error('Invalid source node');
      }
      if (!Array.isArray(targetNodes)) {
        throw new Error('Invalid target nodes');
      }

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
        model: "claude-3-7-sonnet-20250219",
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
      throw error;
    }
  }

  async suggestRelationships(nodes: Node[] | null): Promise<RelationshipSuggestion[]> {
    try {
      if (!Array.isArray(nodes)) {
        throw new Error('Invalid nodes array');
      }
      if (nodes.length === 0) {
        throw new Error('No nodes provided');
      }

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
        model: "claude-3-7-sonnet-20250219",
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
      throw error;
    }
  }
}

export const semanticAnalysis = new SemanticAnalysisService();