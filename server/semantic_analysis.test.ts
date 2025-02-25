import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SemanticAnalysisService } from './semantic_analysis';
import type { Node } from '@shared/schema';
import Anthropic from '@anthropic-ai/sdk';

// Setup mocks before any test data or usage
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn(() => ({
      messages: {
        create: vi.fn()
      }
    }))
  };
});

// Get mock instance after setup
const mockAnthropicInstance = vi.mocked(Anthropic).mock.results[0]?.value;
const mockCreateMessage = mockAnthropicInstance?.messages.create as jest.Mock;

describe('SemanticAnalysisService', () => {
  let service: SemanticAnalysisService;
  let mockNodes: Node[];

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SemanticAnalysisService();
    mockNodes = [
      { id: 1, label: "Existing Node", type: "concept", metadata: {} }
    ];

    // Setup default success responses
    mockCreateMessage.mockImplementation(async ({ messages }) => {
      if (messages[0].content.includes('Given these knowledge graph nodes')) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify([
              { sourceId: 1, targetId: 2, label: "test_relation", weight: 1 }
            ])
          }]
        };
      }
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
    });
  });

  describe('analyzeContent', () => {
    it('should analyze content and return structured results', async () => {
      const result = await service.analyzeContent("Test content", mockNodes);

      // Expect ID to be assigned to the new node (lastNodeId + 1)
      expect(result).toEqual({
        nodes: [
          { id: 2, label: "Test Node", type: "concept", metadata: { description: "A test node" } }
        ],
        edges: [
          { sourceId: 1, targetId: 2, label: "test_relation", weight: 1 }
        ],
        reasoning: "Test analysis"
      });

      expect(mockCreateMessage).toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      // Suppress error logging
      vi.spyOn(console, 'error').mockImplementation(() => {});

      // Setup error mock
      mockCreateMessage.mockRejectedValueOnce(new Error('API Error'));

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

      expect(mockCreateMessage).toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      // Suppress error logging
      vi.spyOn(console, 'error').mockImplementation(() => {});

      // Setup error mock
      mockCreateMessage.mockRejectedValueOnce(new Error('API Error'));

      await expect(service.suggestRelationships(mockNodes))
        .rejects.toThrow('Failed to suggest relationships');
    });
  });
});