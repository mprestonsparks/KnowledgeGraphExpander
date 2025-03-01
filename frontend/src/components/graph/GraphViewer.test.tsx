import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GraphViewer } from './GraphViewer';
import type { GraphData } from '@shared/schema';
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

  const mockGraphData: GraphData = {
    nodes: [
      { id: 1, label: "Node 1", type: "concept", metadata: {} },
      { id: 2, label: "Node 2", type: "concept", metadata: {} },
      { id: 3, label: "Node 3", type: "concept", metadata: {} }
    ],
    edges: [
      { 
        id: 1, 
        sourceId: 1, 
        targetId: 2, 
        label: "related_to", 
        weight: 1,
        metadata: {
          confidence: 0.8,
          reasoning: "Test connection"
        }
      }
    ],
    metrics: {
      betweenness: { 1: 0.5, 2: 0.5, 3: 0.0 },
      eigenvector: { 1: 0.5, 2: 0.5, 3: 0.0 },
      degree: { 1: 1, 2: 1, 3: 0 },
      scaleFreeness: {
        powerLawExponent: 2.1,
        fitQuality: 0.85,
        hubNodes: [{ id: 1, degree: 2, influence: 0.8 }],
        bridgingNodes: [{ id: 2, communities: 2, betweenness: 0.7 }]
      }
    },
    clusters: [{
      clusterId: 0,
      nodes: ["1", "2"],
      metadata: {
        centroidNode: "1",
        semanticTheme: "test cluster",
        coherenceScore: 0.8
      }
    }]
  };

  beforeEach(() => {
    mockElements = [];
    mockCy = createMockCy(); // Reset mockCy for each test
    mockCy.add.mockImplementation((elements: ElementDefinition[]) => {
      mockElements = elements;
      return { style: mockCy.style };
    });
  });

  it('should render without crashing', () => {
    const { container } = render(<GraphViewer data={mockGraphData} />);
    expect(container).toBeTruthy();
  });

  it('should correctly handle edge creation', () => {
    render(<GraphViewer data={mockGraphData} />);
    const edges = mockElements.filter(el => el.group === 'edges');
    expect(edges).toHaveLength(mockGraphData.edges.length);
  });

  it('should mark centroid nodes when clusters are present', () => {
    render(<GraphViewer data={mockGraphData} />);
    const centroidNodes = mockElements
      .filter(el => el.group === 'nodes' && el.classes?.includes('centroid'));
    expect(centroidNodes).toHaveLength(1);
    expect(centroidNodes[0].data.id).toBe('1');
  });
});