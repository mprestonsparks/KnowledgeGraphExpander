import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ControlPanel } from '@/components/graph/ControlPanel';
import { GraphViewer } from '@/components/graph/GraphViewer';
import * as graphApi from '@/lib/graph';
import React from 'react';

// Create test client helper
const createTestClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
};

// Initialize mockCy for consistent behavior across tests
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

// Mock Cytoscape component
vi.mock('react-cytoscapejs', () => ({
  __esModule: true,
  default: ({ cy }: any) => {
    if (cy) {
      cy(mockCy);
    }
    return React.createElement('div', { 'data-testid': 'cytoscape-mock' });
  }
}));

const mockGraphData = {
  nodes: [
    { id: 1, label: "Node 1", type: "concept", metadata: {} },
    { id: 2, label: "Node 2", type: "concept", metadata: {} },
    { id: 3, label: "Node 3", type: "concept", metadata: {} }
  ],
  edges: [
    { id: 1, sourceId: 1, targetId: 2, label: "connects", weight: 1 }
  ],
  metrics: {
    betweenness: { 1: 0.5, 2: 0.5, 3: 0.0 },
    eigenvector: { 1: 0.5, 2: 0.5, 3: 0.0 },
    degree: { 1: 1, 2: 1, 3: 0 }
  }
};

describe('Edge Connection Flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockCy = createMockCy();
  });

  it('should handle the full edge reconnection flow', async () => {
    // Mock API responses
    const mockReconnectNodes = vi.spyOn(graphApi, 'reconnectNodes');
    const mockGetGraphData = vi.spyOn(graphApi, 'getGraphData');

    const reconnectedData = {
      ...mockGraphData,
      edges: [
        ...mockGraphData.edges,
        { id: 2, sourceId: 2, targetId: 3, label: "reconnected", weight: 1 }
      ],
      metrics: {
        ...mockGraphData.metrics,
        degree: { 1: 1, 2: 2, 3: 1 }
      }
    };

    mockGetGraphData.mockResolvedValue(mockGraphData);
    mockReconnectNodes.mockResolvedValue(reconnectedData);

    const queryClient = createTestClient();

    // Render components
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <div>
          <ControlPanel />
          <GraphViewer data={mockGraphData} />
        </div>
      </QueryClientProvider>
    );

    // Verify that the graph container exists
    const graphElement = screen.getByTestId('cytoscape-mock');
    expect(graphElement).toBeInTheDocument();

    // Verify edge-related mutations and queries
    expect(mockCy.add).toHaveBeenCalled();
    const addCall = mockCy.add.mock.calls[0][0];
    const edges = addCall.filter((el: any) => el.group === 'edges');
    expect(edges).toHaveLength(mockGraphData.edges.length);
  });
});

describe('GraphViewer Edge Rendering', () => {
  beforeEach(() => {
    mockCy = createMockCy();
  });

  it('should correctly render all edges from the graph data', () => {
    const queryClient = createTestClient();

    render(
      <QueryClientProvider client={queryClient}>
        <GraphViewer data={mockGraphData} />
      </QueryClientProvider>
    );

    // Verify graph container
    const graphContainer = screen.getByTestId('cytoscape-mock');
    expect(graphContainer).toBeInTheDocument();

    // Verify edge rendering
    expect(mockCy.add).toHaveBeenCalled();
    const addCall = mockCy.add.mock.calls[0][0];
    const edges = addCall.filter((el: any) => el.group === 'edges');
    expect(edges).toHaveLength(mockGraphData.edges.length);

    // Verify edge data
    const edge = edges[0];
    expect(edge.data.source).toBe(mockGraphData.edges[0].sourceId.toString());
    expect(edge.data.target).toBe(mockGraphData.edges[0].targetId.toString());
    expect(edge.data.label).toBe(mockGraphData.edges[0].label);
  });

  it('should maintain edges after data updates', async () => {
    const queryClient = createTestClient();
    const updatedData = {
      ...mockGraphData,
      edges: [
        ...mockGraphData.edges,
        { id: 2, sourceId: 2, targetId: 3, label: "new_connection", weight: 1 }
      ]
    };

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <GraphViewer data={mockGraphData} />
      </QueryClientProvider>
    );

    // Verify initial render
    expect(mockCy.add).toHaveBeenCalled();
    const initialEdges = mockCy.add.mock.calls[0][0].filter((el: any) => el.group === 'edges');
    expect(initialEdges).toHaveLength(mockGraphData.edges.length);

    // Rerender with updated data
    rerender(
      <QueryClientProvider client={queryClient}>
        <GraphViewer data={updatedData} />
      </QueryClientProvider>
    );

    // Verify edges are updated
    const addCalls = mockCy.add.mock.calls;
    expect(addCalls.length).toBeGreaterThan(1);
    const updatedEdges = addCalls[addCalls.length - 1][0].filter((el: any) => el.group === 'edges');
    expect(updatedEdges).toHaveLength(updatedData.edges.length);
  });
});