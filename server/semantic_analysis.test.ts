import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SemanticAnalysisService } from './semantic_analysis';
import type { Node } from '@shared/schema';
import Anthropic from '@anthropic-ai/sdk';

// Create mock function before usage
const mockCreate = vi.fn();

// Mock Anthropic client
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate }
  }))
}));

// Define test data
const mockApiResponse = {
  content: [{
    type: 'text',
    text: JSON.stringify({
      nodes: [
        { label: "Test Node", type: "concept", metadata: { description: "A test node" } }
      ],
      edges: [
        { sourceId: 1, targetId: 2, label: "test_relation", weight: 1 }
      ],
      reasoning: "Test analysis"
    })
  }]
};

const mockRelationshipResponse = {
  content: [{
    type: 'text',
    text: JSON.stringify([
      { sourceId: 1, targetId: 2, label: "test_relation", weight: 1 }
    ])
  }]
};

describe('SemanticAnalysisService', () => {
  let service: SemanticAnalysisService;
  let mockNodes: Node[];

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SemanticAnalysisService();
    mockNodes = [
      { id: 1, label: "Existing Node", type: "concept", metadata: {} }
    ];

    // Reset mock to default success behavior
    mockCreate.mockImplementation(async ({ messages }) => {
      if (messages[0].content.includes('Given these knowledge graph nodes')) {
        return mockRelationshipResponse;
      }
      return mockApiResponse;
    });
  });

  describe('analyzeContent', () => {
    it('should analyze content and return structured results', async () => {
      const result = await service.analyzeContent("Test content", mockNodes);

      expect(result).toEqual({
        nodes: [
          { label: "Test Node", type: "concept", metadata: { description: "A test node" } }
        ],
        edges: [
          { sourceId: 1, targetId: 2, label: "test_relation", weight: 1 }
        ],
        reasoning: "Test analysis"
      });
    });

    it('should handle API errors gracefully', async () => {
      // Suppress error logging
      vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock API error
      mockCreate.mockRejectedValueOnce(new Error('API Error'));

      await expect(service.analyzeContent("Test content", mockNodes))
        .rejects.toThrow('Failed to perform semantic analysis');
    });
  });

  describe('suggestRelationships', () => {
    it('should suggest relationships between nodes', async () => {
      const result = await service.suggestRelationships(mockNodes);

      expect(result).toEqual([
        { id: 1, sourceId: 1, targetId: 2, label: "test_relation", weight: 1 }
      ]);
    });

    it('should handle API errors gracefully', async () => {
      // Suppress error logging
      vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock API error for this test
      mockCreate.mockRejectedValueOnce(new Error('API Error'));

      await expect(service.suggestRelationships(mockNodes))
        .rejects.toThrow('Failed to suggest relationships');
    });
  });
});