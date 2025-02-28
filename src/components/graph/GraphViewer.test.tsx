import { render } from '@testing-library/react';
import { GraphViewer } from './GraphViewer';
import type { GraphData, GraphMetrics } from '@shared/schema';
import type { ElementDefinition } from 'cytoscape';

describe('GraphViewer', () => {
  const mockData: GraphData = {
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
        metadata: { confidence: 0.8, reasoning: "Test connection" }
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
    clusters: []
  };

  it('should render without crashing', () => {
    const { container } = render(<GraphViewer data={mockData} />);
    expect(container).toBeTruthy();
  });
});