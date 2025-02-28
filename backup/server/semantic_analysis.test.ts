import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SemanticAnalysisService } from './semantic_analysis';
import type { Node } from '@shared/schema';
import Anthropic from '@anthropic-ai/sdk';

// Sample base64 image (1x1 transparent PNG)
const sampleImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';

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
            text: JSON.stringify([{
              sourceId: 1,
              targetId: 2,
              label: "test_relation",
              confidence: 0.85,
              explanation: "Strong thematic connection"
            }])
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
    it('should analyze text content and return structured results', async () => {
      const result = await service.analyzeContent({ text: "Test content" }, mockNodes);

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

    it('should analyze multimodal content with images', async () => {
      const mockImage = {
        data: sampleImageBase64,
        type: 'image/png'
      };

      mockCreateMessage.mockImplementationOnce(async () => ({
        content: [{
          type: 'text',
          text: JSON.stringify({
            nodes: [
              {
                label: "Visual Node",
                type: "image_concept",
                metadata: {
                  description: "Image analysis result",
                  imageUrl: `data:image/png;base64,${sampleImageBase64}`,
                  imageDescription: "Description of image content"
                }
              }
            ],
            edges: [
              { sourceId: 1, targetId: 2, label: "visual_relation", weight: 0.8 }
            ],
            reasoning: "Multimodal analysis combining text and image content"
          })
        }]
      }));

      const result = await service.analyzeContent({
        text: "Analyze this image",
        images: [mockImage]
      }, mockNodes);

      expect(result.nodes[0].metadata).toHaveProperty('imageDescription');
      expect(result.nodes[0].type).toBe('image_concept');
      expect(mockCreateMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.arrayContaining([
                expect.objectContaining({ type: 'image' })
              ])
            })
          ])
        })
      );
    });

    it('should handle invalid image data gracefully', async () => {
      const mockInvalidImage = {
        data: 'invalid_base64',
        type: 'image/png'
      };

      // Suppress error logging for test
      vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(service.analyzeContent({
        text: "Test with invalid image",
        images: [mockInvalidImage]
      }, mockNodes)).rejects.toThrow('Invalid image data format');
    });
  });

  describe('validateRelationships', () => {
    it('should validate relationships with semantic confidence scores', async () => {
      const sourceNode = mockNodes[0];
      const targetNodes = [
        { id: 2, label: "Target Node", type: "concept", metadata: {} }
      ];

      mockCreateMessage.mockImplementationOnce(async () => ({
        content: [{
          type: 'text',
          text: JSON.stringify({
            confidenceScores: { 2: 0.85 },
            reasoning: "Strong semantic connection found"
          })
        }]
      }));

      const result = await service.validateRelationships(sourceNode, targetNodes);

      expect(result.confidenceScores).toHaveProperty('2', 0.85);
      expect(result.reasoning).toBeTruthy();
    });

    it('should handle missing or invalid input gracefully', async () => {
      await expect(service.validateRelationships(null as any, [])).rejects.toThrow('Invalid source node');
      await expect(service.validateRelationships(mockNodes[0], null as any)).rejects.toThrow('Invalid target nodes');
    });
  });

  describe('suggestRelationships', () => {
    it('should suggest relationships with confidence and explanations', async () => {
      mockCreateMessage.mockImplementationOnce(async () => ({
        content: [{
          type: 'text',
          text: JSON.stringify([{
            sourceId: 1,
            targetId: 2,
            label: "suggests",
            confidence: 0.85,
            explanation: "Strong thematic connection"
          }])
        }]
      }));

      const result = await service.suggestRelationships(mockNodes);

      expect(result[0]).toHaveProperty('confidence');
      expect(result[0]).toHaveProperty('explanation');
    });

    it('should handle empty or invalid input gracefully', async () => {
      await expect(service.suggestRelationships([])).rejects.toThrow('No nodes provided');
      await expect(service.suggestRelationships(null as any)).rejects.toThrow('Invalid nodes array');
    });
  });
});