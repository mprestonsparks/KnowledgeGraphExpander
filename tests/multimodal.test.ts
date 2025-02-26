import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphManager } from '../server/graph_manager';
import { SemanticAnalysisService } from '../server/semantic_analysis';
import { type Node } from '@shared/schema';

// Mock the semantic analysis service
vi.mock('../server/semantic_analysis', () => ({
  SemanticAnalysisService: vi.fn(() => ({
    analyzeContent: vi.fn(),
    validateRelationships: vi.fn(),
    suggestRelationships: vi.fn()
  }))
}));

describe('Multimodal Knowledge Graph Integration', () => {
  let graphManager: GraphManager;
  let mockSemanticService: jest.Mocked<SemanticAnalysisService>;

  // Sample base64 image (1x1 transparent PNG)
  const sampleImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';

  beforeEach(async () => {
    vi.clearAllMocks();
    graphManager = new GraphManager();
    await graphManager.initialize();
    
    mockSemanticService = vi.mocked(SemanticAnalysisService).mock.instances[0];
  });

  it('should process multimodal content and update graph', async () => {
    // Mock semantic analysis response
    const mockAnalysisResult = {
      nodes: [{
        label: "Image Analysis Result",
        type: "image_concept",
        metadata: {
          description: "Test description",
          imageUrl: `data:image/png;base64,${sampleImageBase64}`,
          imageDescription: "A test image description",
          documentContext: "Context from the combined analysis"
        }
      }],
      edges: [{
        sourceId: 1,
        targetId: 2,
        label: "visual_relation",
        weight: 0.8
      }],
      reasoning: "Test analysis reasoning"
    };

    mockSemanticService.analyzeContent.mockResolvedValue(mockAnalysisResult);

    // Test multimodal content processing
    const result = await graphManager.expandWithSemantics({
      text: "Test content",
      images: [{
        data: sampleImageBase64,
        type: "image/png"
      }]
    });

    // Verify semantic service was called correctly
    expect(mockSemanticService.analyzeContent).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Test content",
        images: expect.arrayContaining([
          expect.objectContaining({
            data: sampleImageBase64,
            type: "image/png"
          })
        ])
      }),
      expect.any(Array)
    );

    // Verify graph was updated with multimodal data
    expect(result.nodes).toContainEqual(
      expect.objectContaining({
        type: "image_concept",
        metadata: expect.objectContaining({
          imageUrl: expect.stringContaining("data:image/png;base64"),
          imageDescription: expect.any(String)
        })
      })
    );
  });

  it('should handle invalid image data gracefully', async () => {
    const invalidContent = {
      text: "Test content",
      images: [{
        data: "invalid-base64",
        type: "image/png"
      }]
    };

    // Expect expansion to fail gracefully
    await expect(graphManager.expandWithSemantics(invalidContent))
      .rejects.toThrow();

    // Verify original graph wasn't corrupted
    const graphData = await graphManager.calculateMetrics();
    expect(graphData.nodes.length).toBe(0);
  });

  it('should merge multimodal analysis with existing nodes', async () => {
    // Add an initial node
    const existingNode: Node = {
      id: 1,
      label: "Existing Node",
      type: "concept",
      metadata: { description: "Initial node" }
    };

    await graphManager.initialize([existingNode], []);

    // Mock analysis that references existing node
    const mockAnalysisResult = {
      nodes: [{
        label: "Image Node",
        type: "image_concept",
        metadata: {
          description: "Visual analysis",
          imageUrl: `data:image/png;base64,${sampleImageBase64}`,
          imageDescription: "Image content description"
        }
      }],
      edges: [{
        sourceId: 1, // Reference existing node
        targetId: 2,
        label: "visual_relation",
        weight: 0.9
      }],
      reasoning: "Test connection reasoning"
    };

    mockSemanticService.analyzeContent.mockResolvedValue(mockAnalysisResult);

    // Process multimodal content
    const result = await graphManager.expandWithSemantics({
      text: "Connect to existing node",
      images: [{
        data: sampleImageBase64,
        type: "image/png"
      }]
    });

    // Verify proper merging
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({
      sourceId: 1,
      targetId: expect.any(Number),
      label: "visual_relation"
    });
  });
});
