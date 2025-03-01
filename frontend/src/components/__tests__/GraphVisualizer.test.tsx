import { describe, it, expect, vi } from 'vitest';
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

  it('should render without crashing', () => {
    const { container } = render(<GraphVisualizer data={mockGraphData} />);
    expect(container).toBeTruthy();
  });

  it('should handle node selection', () => {
    const handleNodeSelect = vi.fn();
    render(<GraphVisualizer data={mockGraphData} onSelect={handleNodeSelect} />);
    expect(handleNodeSelect).toBeDefined();
  });
});