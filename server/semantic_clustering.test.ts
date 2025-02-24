import { expect, describe, it, beforeEach } from 'vitest';
import Graph from 'graphology';
import { SemanticClusteringService } from './semantic_clustering';
import type { Node } from '@shared/schema';

describe('SemanticClusteringService', () => {
  let graph: Graph;
  let service: SemanticClusteringService;

  beforeEach(() => {
    graph = new Graph({ type: 'directed', multi: false });
    service = new SemanticClusteringService(graph);
  });

  it('should create clusters from connected components', () => {
    // Add test nodes
    graph.addNode('1', { id: 1, label: 'Node 1', type: 'test' });
    graph.addNode('2', { id: 2, label: 'Node 2', type: 'test' });
    graph.addNode('3', { id: 3, label: 'Node 3', type: 'other' });
    
    // Add test edges
    graph.addEdge('1', '2', { label: 'test_edge' });
    
    const clusters = service.clusterNodes();
    
    expect(clusters).toHaveLength(2); // Two clusters (one with nodes 1,2 and one with node 3)
    expect(clusters[0].nodes).toHaveLength(2); // First cluster has two nodes
    expect(clusters[1].nodes).toHaveLength(1); // Second cluster has one node
  });

  it('should assign correct cluster metadata', () => {
    graph.addNode('1', { id: 1, label: 'Node 1', type: 'test' });
    graph.addNode('2', { id: 2, label: 'Node 2', type: 'test' });
    graph.addEdge('1', '2', { label: 'test_edge' });

    const clusters = service.clusterNodes();
    
    expect(clusters[0].metadata).toMatchObject({
      semanticTheme: expect.stringContaining('test'),
      coherenceScore: expect.any(Number),
      centroidNode: expect.stringMatching(/[12]/)
    });
  });

  it('should calculate coherence scores based on node similarity', () => {
    // Add nodes of same type
    graph.addNode('1', { id: 1, label: 'Node 1', type: 'test' });
    graph.addNode('2', { id: 2, label: 'Node 2', type: 'test' });
    graph.addEdge('1', '2', { label: 'test_edge' });

    const clustersWithSameType = service.clusterNodes();
    const highCoherence = clustersWithSameType[0].metadata.coherenceScore;

    // Clear and add nodes of different types
    graph.clear();
    graph.addNode('3', { id: 3, label: 'Node 3', type: 'test' });
    graph.addNode('4', { id: 4, label: 'Node 4', type: 'other' });
    graph.addEdge('3', '4', { label: 'test_edge' });

    const clustersWithDiffType = service.clusterNodes();
    const lowCoherence = clustersWithDiffType[0].metadata.coherenceScore;

    expect(highCoherence).toBeGreaterThan(lowCoherence);
  });
});
