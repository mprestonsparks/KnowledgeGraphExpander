import { useEffect, useRef } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import type { Core, ElementDefinition } from "cytoscape";
import { type GraphData, type ClusterResult } from "@shared/schema";

interface GraphViewerProps {
  data: GraphData & { clusters?: ClusterResult[] };
}

const layoutConfig = {
  name: "cose",
  animate: true,
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

const styleSheet = [
  {
    selector: "node",
    style: {
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
      "border-color": "hsl(var(--border))",
      "transition-property": "background-color, border-color, width, height",
      "transition-duration": "0.2s"
    }
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

    // Store a reference to cytoscape instance
    const cy = cyRef.current;

    console.log('Starting graph update with data:', {
      nodes: data.nodes.length,
      edges: data.edges.length,
      clusters: data.clusters?.length || 0
    });

    // Calculate cluster colors with guaranteed unique hues
    const clusterColors = data.clusters?.reduce((acc, cluster) => {
      const hue = (cluster.clusterId * 137.5) % 360; // Golden ratio for better distribution
      const saturation = 70 + (cluster.clusterId * 5) % 20;
      const lightness = 45 + (cluster.clusterId * 7) % 20;
      acc[cluster.clusterId] = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      return acc;
    }, {} as Record<number, string>) || {};

    // Debug cluster assignments
    if (data.clusters?.length) {
      console.log('Cluster color assignments:', data.clusters.map(c => ({
        id: c.clusterId,
        color: clusterColors[c.clusterId],
        nodeCount: c.nodes.length,
        centroid: c.metadata.centroidNode
      })));
    }

    // Prepare nodes with enforced cluster data
    const nodeElements = data.nodes.map(node => {
      const element = {
        data: {
          id: node.id.toString(),
          label: node.label,
          degree: data.metrics.degree[node.id] || 0,
          betweenness: data.metrics.betweenness[node.id] || 0,
        },
        classes: [] as string[],
        group: 'nodes' as const
      };

      const nodeCluster = data.clusters?.find(c =>
        c.nodes.includes(node.id.toString())
      );

      if (nodeCluster) {
        element.data.clusterColor = clusterColors[nodeCluster.clusterId];
        element.classes.push('clustered');

        if (nodeCluster.metadata.centroidNode === node.id.toString()) {
          element.classes.push('centroid');
        }

        // Debug node cluster assignment
        console.log('Node cluster assignment:', {
          nodeId: node.id,
          clusterId: nodeCluster.clusterId,
          color: element.data.clusterColor,
          isCentroid: nodeCluster.metadata.centroidNode === node.id.toString()
        });
      }

      return element;
    });

    // Prepare edges
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

    // Remove existing elements
    cy.elements().remove();

    // Add new elements and apply initial styles
    cy.add([...nodeElements, ...edgeElements]);
    cy.style(styleSheet);

    // Function to verify and enforce styles
    const enforceStyles = () => {
      cy.nodes().forEach(node => {
        const clusterColor = node.data('clusterColor');
        if (clusterColor && !node.hasClass('clustered')) {
          node.addClass('clustered');
        }
        if (node.degree() === 0) {
          node.addClass('disconnected');
        }
      });

      // Force style update
      cy.style().update();

      // Verify style application
      console.log('Style verification:', {
        totalNodes: cy.nodes().length,
        clusteredNodes: cy.nodes('.clustered').length,
        stylesApplied: cy.nodes('.clustered').map(n => ({
          id: n.id(),
          color: n.data('clusterColor'),
          hasClass: n.hasClass('clustered')
        }))
      });
    };

    // Configure layout with proper style handling
    const layout = cy.layout({
      ...layoutConfig,
      animate: true,
      fit: true,
      stop: function() {
        console.log('Layout complete, enforcing final styles');
        enforceStyles();
        cy.fit();
      }
    });

    // Initial style enforcement
    enforceStyles();

    // Run layout
    layout.run();

    // Add cleanup
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