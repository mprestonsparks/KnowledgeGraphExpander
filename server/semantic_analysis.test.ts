import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SemanticAnalysisService } from './semantic_analysis';
import type { Node } from '@shared/schema';

// Mock Anthropic client
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{
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
      })
    }
  }))
}));

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
  });
});
