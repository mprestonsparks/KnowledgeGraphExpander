import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { GraphViewer } from './GraphViewer';
import type { GraphData, ClusterResult } from '@shared/schema';

describe('GraphViewer', () => {
  let mockCy: any;
  let mockElements: any[];
  let mockStyle: any;

  const mockGraphData: GraphData & { clusters: ClusterResult[] } = {
    nodes: [
      { id: 1, label: "Node 1", type: "concept", metadata: {} },
      { id: 2, label: "Node 2", type: "concept", metadata: {} },
      { id: 3, label: "Node 3", type: "concept", metadata: {} }
    ],
    edges: [
      { id: 1, sourceId: 1, targetId: 2, label: "related_to", weight: 1 },
      { id: 2, sourceId: 2, targetId: 3, label: "connects_to", weight: 1 }
    ],
    metrics: {
      betweenness: { 1: 0.5, 2: 0.5, 3: 0.0 },
      eigenvector: { 1: 0.5, 2: 0.5, 3: 0.0 },
      degree: { 1: 1, 2: 2, 3: 1 }
    },
    clusters: [
      {
        clusterId: 0,
        nodes: ["1", "2"],
        metadata: {
          centroidNode: "1",
          semanticTheme: "concept cluster",
          coherenceScore: 0.8
        }
      }
    ]
  };

  beforeEach(() => {
    mockElements = [];
    mockStyle = vi.fn();

    mockCy = {
      elements: () => ({
        remove: vi.fn(),
        length: mockElements.length,
      }),
      add: (elements: any[]) => {
        mockElements = elements;
        return {
          style: mockStyle
        };
      },
      style: mockStyle,
      layout: () => ({
        run: vi.fn(),
        stop: vi.fn(),
        one: (event: string, callback: Function) => {
          if (event === 'layoutstop') {
            callback();
          }
        }
      }),
      nodes: () => ({
        length: mockElements.filter(el => el.group === 'nodes').length,
        forEach: (callback: Function) => mockElements
          .filter(el => el.group === 'nodes')
          .forEach(callback)
      }),
      edges: () => ({
        length: mockElements.filter(el => el.group === 'edges').length,
        map: (callback: Function) => mockElements
          .filter(el => el.group === 'edges')
          .map(callback)
      }),
      fit: vi.fn()
    };

    // Mock Cytoscape component
    vi.mock('react-cytoscapejs', () => ({
      default: vi.fn().mockImplementation(({ cy }) => {
        if (cy) cy(mockCy);
        return <div data-testid="cytoscape-mock" />;
      })
    }));
  });

  it('should assign cluster colors to nodes', () => {
    render(<GraphViewer data={mockGraphData} />);

    const nodesWithColors = mockElements
      .filter(el => el.group === 'nodes' && el.data.clusterColor);

    expect(nodesWithColors).toHaveLength(2);
    expect(nodesWithColors[0].data.clusterColor).toMatch(/^hsl\(\d+,\s*\d+%,\s*\d+%\)$/);
  });

  it('should apply cluster styles correctly', () => {
    render(<GraphViewer data={mockGraphData} />);

    const clusteredNodes = mockElements
      .filter(el => el.group === 'nodes' && el.classes?.includes('clustered'));

    expect(clusteredNodes).toHaveLength(2);
    expect(clusteredNodes[0].data.clusterColor).toBeDefined();
    expect(mockStyle).toHaveBeenCalled();
  });

  it('should mark centroid nodes', () => {
    render(<GraphViewer data={mockGraphData} />);

    const centroidNodes = mockElements
      .filter(el => el.group === 'nodes' && el.classes?.includes('centroid'));

    expect(centroidNodes).toHaveLength(1);
    expect(centroidNodes[0].data.id).toBe('1');
  });

  it('should mark disconnected nodes', () => {
    render(<GraphViewer data={mockGraphData} />);

    const disconnectedNodes = mockElements
      .filter(el => el.group === 'nodes' && el.classes?.includes('disconnected'));

    expect(disconnectedNodes).toHaveLength(1);
    expect(disconnectedNodes[0].data.id).toBe('3');
  });

  it('should preserve all edges when adding elements to graph', () => {
    render(<GraphViewer data={mockGraphData} />);

    const edgeElements = mockElements.filter(el => 
      el.data && el.data.source && el.data.target
    );

    expect(edgeElements).toHaveLength(mockGraphData.edges.length);

    // Verify each edge from mockData is present in rendered elements
    mockGraphData.edges.forEach(edge => {
      const renderedEdge = edgeElements.find(el => 
        el.data.source === edge.sourceId.toString() && 
        el.data.target === edge.targetId.toString()
      );
      expect(renderedEdge).toBeDefined();
      expect(renderedEdge.data.label).toBe(edge.label);
    });
  });

  it('should correctly handle ID types when creating edges', () => {
    render(<GraphViewer data={mockGraphData} />);

    const edgeElements = mockElements.filter(el => el.data && el.data.source);

    edgeElements.forEach(edge => {
      // Verify IDs are strings
      expect(typeof edge.data.source).toBe('string');
      expect(typeof edge.data.target).toBe('string');
      // Verify IDs match source data after conversion
      const originalEdge = mockGraphData.edges.find(e => 
        e.sourceId.toString() === edge.data.source &&
        e.targetId.toString() === edge.data.target
      );
      expect(originalEdge).toBeDefined();
    });
  });

  it('should maintain edge visibility after clustering', () => {
    // Render initial state
    render(<GraphViewer data={mockGraphData} />);

    const initialEdgeCount = mockElements.filter(el => 
      el.data && el.data.source
    ).length;

    // Simulate updating with new cluster data
    const updatedData = {
      ...mockGraphData,
      clusters: [
        ...mockGraphData.clusters,
        {
          clusterId: 1,
          nodes: ["3"],
          metadata: {
            centroidNode: "3",
            semanticTheme: "new cluster",
            coherenceScore: 0.7
          }
        }
      ]
    };

    render(<GraphViewer data={updatedData} />);

    const finalEdgeCount = mockElements.filter(el => 
      el.data && el.data.source
    ).length;

    expect(finalEdgeCount).toBe(initialEdgeCount);
  });

  it('should correctly apply edge styles', () => {
    render(<GraphViewer data={mockGraphData} />);

    // Verify that style was called with edge styles
    const styleCall = mockStyle.mock.calls.find(call => 
      call[0].some((style: any) => style.selector === 'edge')
    );

    expect(styleCall).toBeDefined();
    const edgeStyle = styleCall[0].find((style: any) => style.selector === 'edge');
    expect(edgeStyle.style).toMatchObject({
      width: expect.any(Number),
      'line-color': expect.any(String),
      'target-arrow-shape': 'triangle',
      opacity: 1
    });
  });
});