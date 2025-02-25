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
    if (!cyRef.current) return;

    const cy = cyRef.current;

    console.log('GraphViewer: Initializing with data:', {
      nodes: data.nodes.length,
      edges: data.edges.length,
      clusters: data.clusters?.length || 0
    });

    // Generate cluster colors
    const clusterColors = data.clusters ? calculateClusterColors(data.clusters) : {};

    // Map to track node elements by ID for edge creation
    const nodeMap = new Map<number, ElementDefinition>();

    // Create node elements
    const nodeElements = data.nodes.map(node => {
      const nodeId = node.id.toString();
      const nodeCluster = data.clusters?.find(c => c.nodes.includes(nodeId));

      const element: ElementDefinition = {
        data: {
          id: nodeId,
          label: node.label,
          type: node.type,
          degree: data.metrics.degree[node.id] || 0,
          ...(nodeCluster && {
            clusterColor: clusterColors[nodeCluster.clusterId],
            clusterId: nodeCluster.clusterId
          })
        },
        classes: nodeCluster ? ['clustered'] : []
      };

      if (nodeCluster?.metadata.centroidNode === nodeId) {
        element.classes.push('centroid');
      }

      if (data.metrics.degree[node.id] === 0) {
        element.classes.push('disconnected');
      }

      nodeMap.set(node.id, element);
      return element;
    });

    // Create edge elements only between existing nodes
    const edgeElements = data.edges.map(edge => {
      const sourceId = edge.sourceId.toString();
      const targetId = edge.targetId.toString();

      // Only create edge if both nodes exist
      if (nodeMap.has(edge.sourceId) && nodeMap.has(edge.targetId)) {
        return {
          data: {
            id: `e${edge.id}`,
            source: sourceId,
            target: targetId,
            label: edge.label,
            weight: edge.weight
          },
          classes: []
        };
      }
      return null;
    }).filter((edge): edge is ElementDefinition => edge !== null);

    // Log element creation details
    console.log('Creating graph elements:', {
      nodes: nodeElements.length,
      edges: edgeElements.length,
      edgeDetails: edgeElements.map(e => ({
        id: e.data.id,
        source: e.data.source,
        target: e.data.target,
        label: e.data.label
      }))
    });

    // Clear and add elements
    cy.elements().remove();
    cy.add([...nodeElements, ...edgeElements]);

    // Apply styles and layout
    cy.style(styleSheet);
    const layout = cy.layout(layoutConfig);

    layout.one('layoutstop', () => {
      console.log('Graph layout complete. Verifying elements:', {
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
  }, [data]);

  return (
    <div className="w-full h-full">
      <CytoscapeComponent
        elements={[]}
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