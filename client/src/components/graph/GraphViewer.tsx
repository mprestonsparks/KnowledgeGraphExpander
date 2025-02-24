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
  nodeDimensionsIncludeLabels: true,
  nodeOverlap: 20,
  padding: 20,
  idealEdgeLength: 100,
  randomize: true,
  componentSpacing: 100,
  nodeRepulsion: 4500,
  gravity: 0.25,
};

const styleSheet = [
  {
    selector: "node",
    style: {
      "background-color": "hsl(var(--primary))",
      "label": "data(label)",
      "text-valign": "center",
      "text-halign": "center",
      "width": 30,
      "height": 30,
      "font-size": "12px",
      "color": "hsl(var(--foreground))",
      "text-wrap": "wrap",
      "text-max-width": "80px",
      "border-width": 2,
      "border-color": "hsl(var(--border))"
    }
  },
  {
    selector: "edge",
    style: {
      "width": 1,
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
      "text-background-padding": "2px"
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
      "width": 40,
      "height": 40,
      "z-index": 20
    }
  }
];

function generateClusterColors(clusters: ClusterResult[]): Record<number, string> {
  return clusters.reduce((acc, cluster) => {
    const hue = (cluster.clusterId * 137.5) % 360;
    const saturation = 70;
    const lightness = 50;
    acc[cluster.clusterId] = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    return acc;
  }, {} as Record<number, string>);
}

export function GraphViewer({ data }: GraphViewerProps) {
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!cyRef.current) return;

    console.log('Rendering graph with data:', {
      nodes: data.nodes.length,
      edges: data.edges.length,
      clusters: data.clusters?.length || 0
    });

    const cy = cyRef.current;

    // Generate cluster colors
    const clusterColors = data.clusters ? generateClusterColors(data.clusters) : {};

    if (data.clusters?.length) {
      console.log('Cluster colors generated:', 
        data.clusters.map(c => ({
          id: c.clusterId,
          color: clusterColors[c.clusterId],
          nodes: c.nodes.length
        }))
      );
    }

    // Create elements with cluster data
    const nodeElements = data.nodes.map(node => {
      const nodeCluster = data.clusters?.find(c => 
        c.nodes.includes(node.id.toString())
      );

      const element: ElementDefinition = {
        data: {
          id: node.id.toString(),
          label: node.label,
          type: node.type,
          ...(nodeCluster && { 
            clusterColor: clusterColors[nodeCluster.clusterId],
            clusterId: nodeCluster.clusterId
          })
        },
        classes: [] as string[],
        group: 'nodes'
      };

      if (nodeCluster) {
        element.classes.push('clustered');
        if (nodeCluster.metadata.centroidNode === node.id.toString()) {
          element.classes.push('centroid');
        }
      }

      return element;
    });

    const edgeElements = data.edges.map(edge => ({
      data: {
        id: `e${edge.id}`,
        source: edge.sourceId.toString(),
        target: edge.targetId.toString(),
        label: edge.label
      },
      group: 'edges'
    }));

    // Log element creation
    console.log('Created graph elements:', {
      totalNodes: nodeElements.length,
      clusteredNodes: nodeElements.filter(n => n.classes.includes('clustered')).length,
      centroidNodes: nodeElements.filter(n => n.classes.includes('centroid')).length,
      edges: edgeElements.length
    });

    // Clear and add new elements
    cy.elements().remove();
    cy.add([...nodeElements, ...edgeElements]);

    // Apply styles
    cy.style(styleSheet);

    // Run layout
    const layout = cy.layout({
      ...layoutConfig,
      stop: () => {
        cy.fit();
      }
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