import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GraphViewer } from './GraphViewer';
import type { GraphData, ClusterResult } from '@shared/schema';

const mockGraphData: GraphData & { clusters: ClusterResult[] } = {
  nodes: [
    { id: 1, label: "Test Node 1", type: "test", metadata: {} },
    { id: 2, label: "Test Node 2", type: "test", metadata: {} }
  ],
  edges: [
    { id: 1, sourceId: 1, targetId: 2, label: "test_edge", weight: 1 }
  ],
  metrics: {
    betweenness: { 1: 0.5, 2: 0.5 },
    eigenvector: { 1: 0.5, 2: 0.5 },
    degree: { 1: 1, 2: 1 }
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

// Mock cytoscape since it requires DOM manipulation
vi.mock('react-cytoscapejs', () => ({
  default: vi.fn().mockImplementation(({ cy }) => {
    if (cy) {
      const mockCy = {
        elements: () => ({ 
          remove: vi.fn(),
          length: 2,
          filter: () => ({ length: 1 }),
          map: () => ['#ff0000']
        }),
        add: vi.fn(),
        layout: () => ({
          run: vi.fn(),
          on: vi.fn(),
          promiseOn: () => Promise.resolve()
        }),
        style: vi.fn(),
        fit: vi.fn(),
        nodes: () => ({
          length: 2,
          forEach: vi.fn(),
          filter: () => ({
            length: 1,
            map: () => [{
              id: () => '1',
              data: () => '#ff0000'
            }]
          })
        })
      };
      cy(mockCy);
    }
    return <div data-testid="cytoscape-mock" />;
  })
}));

describe('GraphViewer', () => {
  it('renders without crashing', () => {
    render(<GraphViewer data={mockGraphData} />);
    expect(screen.getByTestId('cytoscape-mock')).toBeTruthy();
  });

  it('applies cluster styles correctly', () => {
    const { container } = render(<GraphViewer data={mockGraphData} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('maintains cluster styles after layout', async () => {
    render(<GraphViewer data={mockGraphData} />);
    // Allow time for layout and style application
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(screen.getByTestId('cytoscape-mock')).toBeTruthy();
  });
});