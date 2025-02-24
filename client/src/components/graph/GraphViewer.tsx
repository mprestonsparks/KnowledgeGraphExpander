import { useEffect, useRef } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import type { Core, ElementDefinition } from "cytoscape";
import { type GraphData, type ClusterResult } from "@shared/schema";

interface GraphViewerProps {
  data: GraphData & { clusters?: ClusterResult[] };
}

const layoutConfig = {
  name: "cose",
  animate: false, // Disable animation to prevent style resets
  nodeRepulsion: 15000,
  idealEdgeLength: 200,
  nodeOverlap: 30,
  padding: 50,
  randomize: true,
  componentSpacing: 300,
  refresh: 30,
  fit: true,
  boundingBox: undefined,
  gravity: 0.3,
  numIter: 10000,
  initialTemp: 1000,
  coolingFactor: 0.99,
  minTemp: 1.0
};

const baseNodeStyle = {
  "background-color": "hsl(var(--primary))",
  "label": "data(label)",
  "color": "hsl(var(--foreground))",
  "text-valign": "center",
  "text-halign": "center",
  "font-size": "14px",
  "text-wrap": "wrap",
  "text-max-width": "120px",
  "width": "45px",
  "height": "45px",
  "border-width": "2px",
  "border-color": "hsl(var(--border))"
};

const styleSheet = [
  {
    selector: "node",
    style: baseNodeStyle
  },
  {
    selector: "node[degree >= 3]",
    style: {
      "width": "60px",
      "height": "60px",
      "border-width": "3px",
      "font-size": "16px"
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
      "font-size": "12px",
      "text-rotation": "autorotate",
      "text-margin-y": "-10px",
      "text-background-color": "hsl(var(--background))",
      "text-background-opacity": 0.8,
      "text-background-padding": "3px"
    }
  },
  {
    selector: "node.clustered",
    style: {
      "background-color": "data(clusterColor)",
      "border-color": "data(clusterColor)",
      "border-width": "3px",
      "z-index": 10
    }
  },
  {
    selector: "node.centroid",
    style: {
      "border-width": "5px",
      "border-color": "hsl(var(--primary))",
      "width": "70px",
      "height": "70px",
      "z-index": 20
    }
  },
  {
    selector: "node.disconnected",
    style: {
      "border-color": "hsl(var(--destructive))",
      "border-width": "3px"
    }
  }
];

function validateGraphElements(nodes: ElementDefinition[], edges: ElementDefinition[]): void {
  const nodeIds = new Set(nodes.map(n => n.data.id));
  const connectedNodes = new Set<string>();

  edges.forEach(edge => {
    if (edge.data.source && edge.data.target) {
      connectedNodes.add(edge.data.source);
      connectedNodes.add(edge.data.target);
    }
  });

  const disconnectedNodes = Array.from(nodeIds).filter(id => !connectedNodes.has(id));
  console.log('Graph validation:', {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    disconnectedCount: disconnectedNodes.length
  });
}

export function GraphViewer({ data }: GraphViewerProps) {
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!cyRef.current) return;

    const cy = cyRef.current;

    console.log('Starting graph update with data:', {
      nodes: data.nodes.length,
      edges: data.edges.length,
      clusters: data.clusters?.length || 0
    });

    // Generate cluster colors
    const clusterColors = data.clusters?.reduce((acc, cluster) => {
      const hue = (cluster.clusterId * 137.5) % 360;
      const saturation = 70 + (cluster.clusterId * 5) % 20;
      const lightness = 45 + (cluster.clusterId * 7) % 20;
      acc[cluster.clusterId] = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      return acc;
    }, {} as Record<number, string>) || {};

    // Create elements with cluster data
    const nodeElements = data.nodes.map(node => {
      const nodeCluster = data.clusters?.find(c =>
        c.nodes.includes(node.id.toString())
      );

      const element: ElementDefinition = {
        data: {
          id: node.id.toString(),
          label: node.label,
          degree: data.metrics.degree[node.id] || 0,
          betweenness: data.metrics.betweenness[node.id] || 0,
        },
        classes: [] as string[],
        group: 'nodes'
      };

      if (nodeCluster) {
        element.data.clusterColor = clusterColors[nodeCluster.clusterId];
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
        label: edge.label,
        weight: edge.weight
      },
      group: 'edges' as const
    }));

    // Clear and add new elements
    cy.elements().remove();
    cy.add([...nodeElements, ...edgeElements]);

    // Function to enforce styles
    const enforceStyles = () => {
      cy.style(styleSheet);

      cy.nodes().forEach(node => {
        // Re-add classes to ensure style application
        if (node.data('clusterColor')) {
          node.addClass('clustered');
        }
        if (node.degree() === 0) {
          node.addClass('disconnected');
        }
      });

      // Force style refresh
      cy.style().update();
    };

    // Apply initial styles
    enforceStyles();

    // Create and run layout
    const layout = cy.layout({
      ...layoutConfig,
      stop: () => {
        // Ensure styles persist after layout
        enforceStyles();
        cy.fit();
      }
    });

    layout.run();

    // Clean up
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