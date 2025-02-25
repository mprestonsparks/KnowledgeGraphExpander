import { useEffect, useRef } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import type { Core, ElementDefinition } from "cytoscape";
import { type GraphData, type ClusterResult } from "@shared/schema";

interface GraphViewerProps {
  data: GraphData & { clusters?: ClusterResult[] };
}

const layoutConfig = {
  name: "cose",
  animate: false,
  animationDuration: 500,
  nodeDimensionsIncludeLabels: true,
  refresh: 20,
  fit: true,
  padding: 30,
  nodeRepulsion: 4500,
  nodeOverlap: 20,
  idealEdgeLength: 100,
  gravity: 0.25,
  componentSpacing: 100,
  randomize: false
};

const styleSheet = [
  {
    selector: "node",
    style: {
      "background-color": "hsl(var(--muted))",
      "label": "data(label)",
      "text-valign": "center",
      "text-halign": "center",
      "width": 40,
      "height": 40,
      "font-size": "12px",
      "color": "hsl(var(--foreground))",
      "text-wrap": "wrap",
      "text-max-width": "80px",
      "border-width": 2,
      "border-color": "hsl(var(--border))",
      "z-index": 1
    }
  },
  {
    selector: "edge",
    style: {
      "width": 2,
      "line-color": "hsl(var(--muted))",
      "target-arrow-color": "hsl(var(--muted))",
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      "label": "data(label)",
      "font-size": "10px",
      "text-rotation": "autorotate",
      "text-margin-y": "-10px",
      "text-background-color": "hsl(var(--background))",
      "text-background-opacity": 0.8,
      "text-background-padding": "2px",
      "z-index": 0,
      "opacity": 1
    }
  },
  {
    selector: "node.clustered",
    style: {
      "background-color": "data(clusterColor)",
      "border-color": "data(clusterColor)",
      "border-width": 3,
      "z-index": 10
    }
  },
  {
    selector: "node.centroid",
    style: {
      "border-width": 4,
      "border-color": "hsl(var(--primary))",
      "width": 50,
      "height": 50,
      "z-index": 20,
      "font-size": "14px",
      "font-weight": "bold"
    }
  },
  {
    selector: "node.disconnected",
    style: {
      "border-color": "hsl(var(--destructive))",
      "border-width": 3,
      "border-style": "dashed"
    }
  }
];

function calculateClusterColors(clusters: ClusterResult[]): Record<number, string> {
  return clusters.reduce((acc, cluster, index) => {
    const hue = (index * 137.5) % 360;
    const saturation = 70;
    const lightness = 55;
    acc[cluster.clusterId] = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    return acc;
  }, {} as Record<number, string>);
}

export function GraphViewer({ data }: GraphViewerProps) {
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!cyRef.current || !data?.nodes?.length) return;

    const cy = cyRef.current;

    // Log initial state for debugging
    console.log('Graph data update received:', {
      nodes: data.nodes.map(n => ({ id: n.id, label: n.label })),
      edges: data.edges?.map(e => ({ id: e.id, source: e.sourceId, target: e.targetId, label: e.label })) || []
    });

    // Clear existing elements before adding new ones
    cy.elements().remove();

    // Generate cluster colors
    const clusterColors = data.clusters ? calculateClusterColors(data.clusters) : {};

    // Create node elements with proper data attributes
    const nodeElements: ElementDefinition[] = data.nodes.map(node => {
      const nodeId = node.id.toString();
      const nodeCluster = data.clusters?.find(c => c.nodes.includes(nodeId));

      const element: ElementDefinition = {
        group: 'nodes',
        data: {
          id: nodeId,
          label: node.label || `Node ${nodeId}`,
          type: node.type || 'concept',
          degree: data.metrics?.degree?.[node.id] || 0,
          ...(nodeCluster && {
            clusterColor: clusterColors[nodeCluster.clusterId],
            clusterId: nodeCluster.clusterId
          })
        },
        classes: nodeCluster ? ['clustered'] : []
      };

      // Add special classes based on node properties
      if (nodeCluster?.metadata.centroidNode === nodeId) {
        element.classes = [...(element.classes || []), 'centroid'];
      }

      if ((data.metrics?.degree?.[node.id] || 0) === 0) {
        element.classes = [...(element.classes || []), 'disconnected'];
      }

      return element;
    });

    // Create edge elements with proper data attributes
    const edgeElements: ElementDefinition[] = (data.edges || []).map(edge => {
      if (!edge.sourceId || !edge.targetId) {
        console.warn('Invalid edge data:', edge);
        return null;
      }

      const sourceId = edge.sourceId.toString();
      const targetId = edge.targetId.toString();

      // Ensure we have a valid edge ID
      const edgeId = `e${edge.id || Math.floor(Math.random() * 1000000)}`;

      return {
        group: 'edges',
        data: {
          id: edgeId,
          source: sourceId,
          target: targetId,
          label: edge.label || 'related_to',
          weight: edge.weight || 1
        }
      };
    }).filter(Boolean) as ElementDefinition[];

    // Add elements to the graph
    cy.add([...nodeElements, ...edgeElements]);

    // Apply styles and layout
    cy.style(styleSheet);
    const layout = cy.layout(layoutConfig);

    layout.one('layoutstop', () => {
      console.log('Layout complete:', {
        nodes: cy.nodes().length,
        edges: cy.edges().length,
        clusters: cy.nodes('.clustered').length,
        centroids: cy.nodes('.centroid').length,
        disconnected: cy.nodes('.disconnected').length
      });
      cy.fit();
    });

    layout.run();

    return () => {
      layout.stop();
    };
  }, [data]); // Only re-run when data changes

  return (
    <div className="w-full h-full">
      <CytoscapeComponent
        elements={[]} // Elements will be added in useEffect
        stylesheet={styleSheet}
        layout={layoutConfig}
        cy={(cy) => {
          cyRef.current = cy;
        }}
        className="w-full h-full"
      />
    </div>
  );
}