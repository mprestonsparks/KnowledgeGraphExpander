import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '../../test/utils';
import userEvent from '@testing-library/user-event';
import { GraphVisualizer } from '../GraphVisualizer';

// Mock graph data
const mockGraphData = {
  nodes: [
    { id: 1, label: 'Concept A', type: 'concept', metadata: { description: 'Test description' } }
  ],
  edges: [],
  metrics: {
    betweenness: {},
    eigenvector: {},
    degree: {},
    scaleFreeness: {
      powerLawExponent: 0,
      fitQuality: 0,
      hubNodes: [],
      bridgingNodes: []
    }
  }
};

describe('GraphVisualizer', () => {
  it('renders graph nodes correctly', async () => {
    render(<GraphVisualizer graphData={mockGraphData} />);
    
    await waitFor(() => {
      expect(screen.getByText('Concept A')).toBeInTheDocument();
    });
  });

  it('displays node details on click', async () => {
    const user = userEvent.setup();
    render(<GraphVisualizer graphData={mockGraphData} />);

    const node = await screen.findByText('Concept A');
    await user.click(node);

    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('handles empty graph data gracefully', () => {
    render(<GraphVisualizer graphData={{ nodes: [], edges: [], metrics: mockGraphData.metrics }} />);
    expect(screen.getByText(/No nodes to display/i)).toBeInTheDocument();
  });
});
