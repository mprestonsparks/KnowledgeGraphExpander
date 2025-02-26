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

  describe('Connected Components', () => {
    it('should identify separate components correctly', () => {
      // Component 1
      graph.addNode('1', { id: 1, label: 'Node 1', type: 'concept' });
      graph.addNode('2', { id: 2, label: 'Node 2', type: 'concept' });
      graph.addEdge('1', '2', { label: 'related_to' });

      // Component 2
      graph.addNode('3', { id: 3, label: 'Node 3', type: 'concept' });
      graph.addNode('4', { id: 4, label: 'Node 4', type: 'concept' });
      graph.addEdge('3', '4', { label: 'related_to' });

      const clusters = service.clusterNodes();
      expect(clusters).toHaveLength(2);
      expect(clusters[0].nodes).toHaveLength(2);
      expect(clusters[1].nodes).toHaveLength(2);
    });
  });

  describe('Node Similarity', () => {
    it('should calculate higher similarity for nodes of same type', () => {
      graph.addNode('1', { id: 1, label: 'Node 1', type: 'concept' });
      graph.addNode('2', { id: 2, label: 'Node 2', type: 'concept' });
      graph.addNode('3', { id: 3, label: 'Node 3', type: 'attribute' });
      graph.addEdge('1', '2', { label: 'related_to' });
      graph.addEdge('2', '3', { label: 'related_to' });

      const clusters = service.clusterNodes();
      expect(clusters[0].metadata.coherenceScore).toBeGreaterThan(0.5);
    });
  });

  describe('Cluster Centroid Selection', () => {
    it('should select node with highest degree as centroid', () => {
      graph.addNode('1', { id: 1, label: 'Central', type: 'concept' });
      graph.addNode('2', { id: 2, label: 'Connected 1', type: 'concept' });
      graph.addNode('3', { id: 3, label: 'Connected 2', type: 'concept' });

      // Make node '1' most connected
      graph.addEdge('1', '2', { label: 'related_to' });
      graph.addEdge('1', '3', { label: 'related_to' });

      const clusters = service.clusterNodes();
      expect(clusters[0].metadata.centroidNode).toBe('1');
    });
  });

  describe('Theme Inference', () => {
    it('should infer theme based on dominant node type', () => {
      graph.addNode('1', { id: 1, label: 'Concept 1', type: 'concept' });
      graph.addNode('2', { id: 2, label: 'Concept 2', type: 'concept' });
      graph.addNode('3', { id: 3, label: 'Attribute 1', type: 'attribute' });

      graph.addEdge('1', '2', { label: 'related_to' });
      graph.addEdge('2', '3', { label: 'related_to' });

      const clusters = service.clusterNodes();
      expect(clusters[0].metadata.semanticTheme).toContain('concept');
    });
  });

  describe('Integration', () => {
    it('should handle complex graph structures', () => {
      // Create a more complex graph structure
      const nodes = [
        { id: '1', label: 'Core 1', type: 'concept' },
        { id: '2', label: 'Core 2', type: 'concept' },
        { id: '3', label: 'Attr 1', type: 'attribute' },
        { id: '4', label: 'Attr 2', type: 'attribute' },
        { id: '5', label: 'Isolated', type: 'concept' }
      ];

      const edges = [
        ['1', '2'],
        ['2', '3'],
        ['3', '4'],
        ['4', '1']
      ];

      nodes.forEach(n => graph.addNode(n.id, { id: parseInt(n.id), label: n.label, type: n.type }));
      edges.forEach(([source, target]) => graph.addEdge(source, target, { label: 'related_to' }));

      const clusters = service.clusterNodes();

      expect(clusters).toHaveLength(2); // One main cluster and one isolated node
      expect(clusters[0].nodes).toHaveLength(4); // Main cluster
      expect(clusters[1].nodes).toHaveLength(1); // Isolated node
      expect(clusters[0].metadata.coherenceScore).toBeGreaterThan(0);
    });
  });
});