import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GraphViewer } from './GraphViewer';
import type { GraphData } from '@shared/schema';

const mockGraphData: GraphData = {
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
  }
};

// Mock cytoscape since it requires DOM manipulation
vi.mock('react-cytoscapejs', () => ({
  default: vi.fn().mockImplementation(({ cy }) => {
    if (cy) cy({ elements: () => ({ remove: vi.fn() }), add: vi.fn(), layout: vi.fn().mockReturnValue({ run: vi.fn() }) });
    return <div data-testid="cytoscape-mock" />;
  })
}));

describe('GraphViewer', () => {
  it('renders without crashing', () => {
    render(<GraphViewer data={mockGraphData} />);
    expect(screen.getByTestId('cytoscape-mock')).toBeInTheDocument();
  });

  it('has the correct wrapper class names', () => {
    const { container } = render(<GraphViewer data={mockGraphData} />);
    expect(container.firstChild).toHaveClass('w-full h-full bg-background');
  });
});
