import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
      { id: 1, sourceId: 1, targetId: 2, label: "related_to", weight: 1 }
    ],
    metrics: {
      betweenness: { 1: 0.5, 2: 0.5, 3: 0.0 },
      eigenvector: { 1: 0.5, 2: 0.5, 3: 0.0 },
      degree: { 1: 1, 2: 1, 3: 0 }
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
        stop: vi.fn()
      }),
      nodes: () => ({
        forEach: (callback: Function) => mockElements
          .filter(el => el.group === 'nodes')
          .forEach(callback),
        filter: () => ({
          length: mockElements.filter(el => el.group === 'nodes').length
        })
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
});