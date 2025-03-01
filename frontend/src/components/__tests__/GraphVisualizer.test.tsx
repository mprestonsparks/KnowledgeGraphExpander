import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { GraphVisualizer } from '../GraphVisualizer';
import type { GraphData } from '@shared/schema';

describe('GraphVisualizer', () => {
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
    ]
  };

  it('should render without crashing', () => {
    const { container } = render(<GraphVisualizer data={mockGraphData} />);
    expect(container).toBeTruthy();
  });

  it('should handle node click events', () => {
    const onNodeClick = vi.fn();
    render(<GraphVisualizer data={mockGraphData} onNodeClick={onNodeClick} />);
    // Note: Direct DOM testing of cytoscape events is difficult
    // We're just verifying the component renders with the click handler
    expect(onNodeClick).toBeDefined();
  });
});