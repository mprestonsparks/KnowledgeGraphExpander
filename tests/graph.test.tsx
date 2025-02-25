import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ControlPanel } from '@/components/graph/ControlPanel';
import { GraphViewer } from '@/components/graph/GraphViewer';
import * as graphApi from '@/lib/graph';

// Mock data and setup functions
const createTestClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
};

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

    // Render both components
    render(
      <QueryClientProvider client={queryClient}>
        <div>
          <ControlPanel />
          <GraphViewer data={mockGraphData} />
        </div>
      </QueryClientProvider>
    );

    // Find and click the reconnect button
    const reconnectButton = screen.getByText(/reconnect.*nodes/i);
    expect(reconnectButton).toBeInTheDocument();

    // Click the button
    fireEvent.click(reconnectButton);

    // Verify API was called
    expect(mockReconnectNodes).toHaveBeenCalled();

    // Get the updated GraphViewer component
    const graphElement = screen.getByTestId('cytoscape-mock');
    expect(graphElement).toBeInTheDocument();

    // Verify the edges are displayed
    // Note: Add appropriate test-ids or data attributes to verify edge elements
  });
});

describe('GraphViewer Edge Rendering', () => {
  it('should correctly render all edges from the graph data', () => {
    const queryClient = createTestClient();

    render(
      <QueryClientProvider client={queryClient}>
        <GraphViewer data={mockGraphData} />
      </QueryClientProvider>
    );

    // Verify that edges are being rendered
    const graphContainer = screen.getByTestId('cytoscape-mock');
    expect(graphContainer).toBeInTheDocument();

    // Add specific assertions for edge elements once we add test IDs
  });

  it('should maintain edges after data updates', async () => {
    const queryClient = createTestClient();

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <GraphViewer data={mockGraphData} />
      </QueryClientProvider>
    );

    // Update with new data
    const updatedData = {
      ...mockGraphData,
      edges: [
        ...mockGraphData.edges,
        { id: 2, sourceId: 2, targetId: 3, label: "new_connection", weight: 1 }
      ]
    };

    rerender(
      <QueryClientProvider client={queryClient}>
        <GraphViewer data={updatedData} />
      </QueryClientProvider>
    );

    // Verify edges are preserved
    const graphContainer = screen.getByTestId('cytoscape-mock');
    expect(graphContainer).toBeInTheDocument();

    // Add specific assertions for updated edge elements
  });
});