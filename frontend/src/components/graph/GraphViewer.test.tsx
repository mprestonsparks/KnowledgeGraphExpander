import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GraphViewer } from './GraphViewer';
import type { GraphData, ClusterResult } from '@shared/schema';
import type { ElementDefinition } from 'cytoscape';

// Initialize mockCy outside describe block to ensure proper scoping
const createMockCy = () => ({
  elements: vi.fn().mockReturnValue({ remove: vi.fn() }),
  add: vi.fn().mockReturnValue({ style: vi.fn() }),
  style: vi.fn(),
  layout: vi.fn().mockReturnValue({
    run: vi.fn(),
    stop: vi.fn(),
    one: vi.fn((event: string, callback: Function) => {
      if (event === 'layoutstop') callback();
    })
  }),
  nodes: vi.fn().mockReturnValue({
    length: 0,
    filter: vi.fn().mockReturnValue([]),
    forEach: vi.fn()
  }),
  edges: vi.fn().mockReturnValue({
    length: 0,
    filter: vi.fn().mockReturnValue([]),
    map: vi.fn().mockReturnValue([])
  }),
  fit: vi.fn(),
  destroy: vi.fn()  // Add destroy method for unmounting
});

let mockCy = createMockCy();

// Mock Cytoscape component before tests begin
vi.mock('react-cytoscapejs', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(({ cy }) => {
    if (cy) {
      const instance = mockCy;
      cy(instance);
      return <div data-testid="cytoscape-mock" />;
    }
    return <div data-testid="cytoscape-mock" />;
  })
}));

describe('GraphViewer', () => {
  let mockElements: ElementDefinition[] = [];

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
          semanticTheme: "test cluster",
          coherenceScore: 0.8
        }
      }
    ]
  };

  beforeEach(() => {
    mockElements = [];
    mockCy = createMockCy(); // Reset mockCy for each test
    mockCy.add.mockImplementation((elements: ElementDefinition[]) => {
      mockElements = elements;
      return { style: mockCy.style };
    });
  });

  it('should assign cluster colors to nodes', () => {
    render(<GraphViewer data={mockGraphData} />);

    const nodesWithColors = mockElements
      .filter(el => el.group === 'nodes' && el.data.clusterColor);

    expect(nodesWithColors).toHaveLength(2);
    expect(nodesWithColors[0].data.clusterColor).toMatch(/^hsl\(\d+,\s*\d+%,\s*\d+%\)$/);
  });

  it('should correctly handle edge creation', () => {
    render(<GraphViewer data={mockGraphData} />);

    const edges = mockElements.filter(el => el.group === 'edges');

    expect(edges).toHaveLength(mockGraphData.edges.length);
    edges.forEach((edge, index) => {
      const originalEdge = mockGraphData.edges[index];
      expect(edge.data.source).toBe(originalEdge.sourceId.toString());
      expect(edge.data.target).toBe(originalEdge.targetId.toString());
      expect(edge.data.label).toBe(originalEdge.label);
    });
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

  it('should correctly handle ID types when creating edges', () => {
    render(<GraphViewer data={mockGraphData} />);

    const edges = mockElements.filter(el => el.group === 'edges');
    edges.forEach(edge => {
      expect(typeof edge.data.source).toBe('string');
      expect(typeof edge.data.target).toBe('string');
      expect(edge.data.id).toMatch(/^e\d+$/);
    });
  });

  it('should correctly apply edge styles', () => {
    render(<GraphViewer data={mockGraphData} />);

    expect(mockCy.style).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        selector: 'edge',
        style: expect.objectContaining({
          'width': 2,
          'line-color': expect.any(String),
          'target-arrow-shape': 'triangle'
        })
      })
    ]));
  });
});