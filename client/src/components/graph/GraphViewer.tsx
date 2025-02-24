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
      "width": 1.5,
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
      "z-index": 0
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

    console.log('GraphViewer: Processing data', {
      nodes: data.nodes.length,
      edges: data.edges.length,
      clusters: data.clusters?.length || 0
    });

    // Generate cluster colors
    const clusterColors = data.clusters ? calculateClusterColors(data.clusters) : {};

    // Prepare nodes
    const nodeElements = data.nodes.map(node => {
      const nodeCluster = data.clusters?.find(c => 
        c.nodes.includes(node.id.toString())
      );

      const element: ElementDefinition = {
        data: {
          id: node.id.toString(),
          label: node.label,
          type: node.type,
          degree: data.metrics.degree[node.id] || 0,
          ...(nodeCluster && {
            clusterColor: clusterColors[nodeCluster.clusterId],
            clusterId: nodeCluster.clusterId
          })
        },
        classes: [],
        group: 'nodes'
      };

      if (nodeCluster) {
        element.classes.push('clustered');
        if (nodeCluster.metadata.centroidNode === node.id.toString()) {
          element.classes.push('centroid');
        }
      }

      if (data.metrics.degree[node.id] === 0) {
        element.classes.push('disconnected');
      }

      return element;
    });

    // Prepare edges (preserve all edge data)
    const edgeElements = data.edges.map(edge => ({
      data: {
        id: `e${edge.id}`,
        source: edge.sourceId.toString(),
        target: edge.targetId.toString(),
        label: edge.label,
        weight: edge.weight //Added weight to preserve edge data
      },
      group: 'edges'
    }));

    // Clear existing elements
    cy.elements().remove();

    // Add all elements at once
    cy.add([...nodeElements, ...edgeElements]);

    // Apply styles
    cy.style(styleSheet);

    // Run layout
    const layout = cy.layout(layoutConfig);

    layout.one('layoutstop', () => {
      // Verify and log element counts
      console.log('Graph rendered:', {
        nodes: cy.nodes().length,
        edges: cy.edges().length,
        clusteredNodes: cy.nodes('.clustered').length,
        centroidNodes: cy.nodes('.centroid').length,
        disconnectedNodes: cy.nodes('.disconnected').length
      });

      // Ensure styles are applied
      cy.style().update();
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