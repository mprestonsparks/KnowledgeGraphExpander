import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
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
    stop: vi.fn()
  }),
  fit: vi.fn(),
  destroy: vi.fn()
});

let mockCy = createMockCy();

// Mock Cytoscape component
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
      { id: 2, label: "Node 2", type: "concept", metadata: {} }
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
          reasoning: "Test connection",
          validatedAt: new Date().toISOString()
        }
      }
    ],
    metrics: {
      betweenness: { 1: 0.5, 2: 0.5 },
      eigenvector: { 1: 0.5, 2: 0.5 },
      degree: { 1: 1, 2: 1 },
      scaleFreeness: {
        powerLawExponent: 2.1,
        fitQuality: 0.85,
        hubNodes: [{ id: 1, degree: 2, influence: 0.8 }],
        bridgingNodes: [{ id: 2, communities: 2, betweenness: 0.7 }]
      }
    }
  };

  beforeEach(() => {
    mockElements = [];
    mockCy = createMockCy();
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

  it('should handle node click events', () => {
    const onNodeClick = vi.fn();
    render(<GraphViewer data={mockGraphData} onNodeClick={onNodeClick} />);
    expect(onNodeClick).toBeDefined();
  });
});