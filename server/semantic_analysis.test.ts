import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SemanticAnalysisService } from './semantic_analysis';
import type { Node } from '@shared/schema';
import Anthropic from '@anthropic-ai/sdk';

// Mock Anthropic client
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn().mockImplementation(async ({ messages }) => {
    if (messages[0].content.includes('Given these knowledge graph nodes')) {
      // For relationship suggestions
      return {
        content: [{
          type: 'text',
          text: JSON.stringify([
            { sourceId: 1, targetId: 2, label: "test_relation", weight: 1 }
          ])
        }]
      };
    } else {
      // For content analysis
      return {
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
    }
  });

  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate }
    }))
  };
});

describe('SemanticAnalysisService', () => {
  let service: SemanticAnalysisService;
  let mockNodes: Node[];

  beforeEach(() => {
    service = new SemanticAnalysisService();
    mockNodes = [
      { id: 1, label: "Existing Node", type: "concept", metadata: {} }
    ];
  });

  describe('analyzeContent', () => {
    it('should analyze content and return structured results', async () => {
      const result = await service.analyzeContent("Test content", mockNodes);

      expect(result).toEqual({
        nodes: [
          { id: 2, label: "Test Node", type: "concept", metadata: { description: "A test node" } }
        ],
        edges: [
          { sourceId: 1, targetId: 2, label: "test_relation", weight: 1 }
        ],
        reasoning: "Test analysis"
      });
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
      // Suppress console error output during test
      vi.spyOn(console, 'error').mockImplementation(() => {});

      // Override the mock for this test only
      const mockCreate = vi.fn().mockRejectedValueOnce(new Error('API Error'));
      vi.mocked(Anthropic).mockImplementationOnce(() => ({
        messages: { create: mockCreate }
      }));

      await expect(service.suggestRelationships(mockNodes))
        .rejects.toThrow('Failed to suggest relationships');
    });
  });
});