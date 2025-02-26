import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { graphManager } from '../server/graph_manager';
import { type GraphData } from '@shared/schema';

// Sample base64 image (1x1 transparent PNG)
const sampleImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';

describe('API Multimodal Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/graph/analyze', () => {
    it('should handle multimodal content analysis', async () => {
      const testPayload = {
        content: "Test content for multimodal analysis",
        images: [{
          data: sampleImageBase64,
          type: "image/png"
        }]
      };

      // Mock the graph manager response
      const mockGraphData: GraphData = {
        nodes: [{
          id: 1,
          label: "Visual Concept",
          type: "image_concept",
          metadata: {
            description: "Test description",
            imageUrl: `data:image/png;base64,${sampleImageBase64}`,
            imageDescription: "A test image description",
            documentContext: "Context from combined analysis"
          }
        }],
        edges: [],
        metrics: {
          betweenness: {},
          eigenvector: {},
          degree: {},
          scaleFreeness: {
            powerLawExponent: 0,
            fitQuality: 0,
            hubNodes: [],
            bridgingNodes: []
          }
        }
      };

      vi.spyOn(graphManager, 'expandWithSemantics').mockResolvedValue(mockGraphData);

      const response = await request(app)
        .post('/api/graph/analyze')
        .send(testPayload)
        .expect(200);

      expect(response.body.nodes[0].metadata).toHaveProperty('imageUrl');
      expect(response.body.nodes[0].metadata).toHaveProperty('imageDescription');
      expect(response.body.nodes[0].type).toBe('image_concept');

      expect(graphManager.expandWithSemantics).toHaveBeenCalledWith({
        text: testPayload.content,
        images: testPayload.images
      });
    });

    it('should handle invalid image data gracefully', async () => {
      const invalidPayload = {
        content: "Test content",
        images: [{
          data: "invalid-base64",
          type: "image/png"
        }]
      };

      const response = await request(app)
        .post('/api/graph/analyze')
        .send(invalidPayload)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should accept text-only content', async () => {
      const textOnlyPayload = {
        content: "Test content without images"
      };

      const mockGraphData: GraphData = {
        nodes: [{
          id: 1,
          label: "Text Concept",
          type: "concept",
          metadata: {
            description: "Test description"
          }
        }],
        edges: [],
        metrics: {
          betweenness: {},
          eigenvector: {},
          degree: {},
          scaleFreeness: {
            powerLawExponent: 0,
            fitQuality: 0,
            hubNodes: [],
            bridgingNodes: []
          }
        }
      };

      vi.spyOn(graphManager, 'expandWithSemantics').mockResolvedValue(mockGraphData);

      const response = await request(app)
        .post('/api/graph/analyze')
        .send(textOnlyPayload)
        .expect(200);

      expect(response.body.nodes[0].type).toBe('concept');
      expect(response.body.nodes[0].metadata).not.toHaveProperty('imageUrl');
    });

    it('should handle large multimodal content', async () => {
      // Create a larger test payload
      const largeContent = "A".repeat(10000);
      const testPayload = {
        content: largeContent,
        images: [{
          data: sampleImageBase64,
          type: "image/png"
        }]
      };

      const mockGraphData: GraphData = {
        nodes: [{
          id: 1,
          label: "Large Content Node",
          type: "image_concept",
          metadata: {
            description: "Test description",
            imageUrl: `data:image/png;base64,${sampleImageBase64}`,
            imageDescription: "Test image description"
          }
        }],
        edges: [],
        metrics: {
          betweenness: {},
          eigenvector: {},
          degree: {},
          scaleFreeness: {
            powerLawExponent: 0,
            fitQuality: 0,
            hubNodes: [],
            bridgingNodes: []
          }
        }
      };

      vi.spyOn(graphManager, 'expandWithSemantics').mockResolvedValue(mockGraphData);
      
      const response = await request(app)
        .post('/api/graph/analyze')
        .send(testPayload)
        .expect(200);

      expect(response.body.nodes[0].metadata).toHaveProperty('imageUrl');
      expect(graphManager.expandWithSemantics).toHaveBeenCalled();
    });
  });
});
