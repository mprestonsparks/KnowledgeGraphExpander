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
      "text-background-padding": "3px",
      "opacity": 1,
      "z-index": 1
    }
  },
  {
    selector: "node.clustered",
    style: {
      "background-color": "data(clusterColor)",
      "border-color": "data(clusterColor)",
      "border-width": "3px"
    }
  },
  {
    selector: "node.centroid",
    style: {
      "border-width": "5px",
      "border-color": "hsl(var(--primary))",
      "width": "70px",
      "height": "70px"
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

    console.log('Updating graph with new data:', {
      nodes: data.nodes.length,
      edges: data.edges.length,
      clusters: data.clusters?.length || 0
    });

    // Calculate cluster colors
    const clusterColors = data.clusters?.reduce((acc, cluster) => {
      const hue = (cluster.clusterId * 137.5) % 360;
      const saturation = 70 + (cluster.clusterId * 5) % 20;
      const lightness = 45 + (cluster.clusterId * 7) % 20;
      acc[cluster.clusterId] = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      return acc;
    }, {} as Record<number, string>) || {};

    // Log cluster assignments
    if (data.clusters?.length) {
      console.log('Cluster assignments:', data.clusters.map(c => ({
        id: c.clusterId,
        nodes: c.nodes.length,
        color: clusterColors[c.clusterId],
        centroid: c.metadata.centroidNode
      })));
    }

    // Prepare nodes with cluster data
    const nodeElements = data.nodes.map(node => {
      const nodeCluster = data.clusters?.find(c => 
        c.nodes.includes(node.id.toString())
      );

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

      if (nodeCluster) {
        element.data.clusterColor = clusterColors[nodeCluster.clusterId];
        element.classes.push('clustered');

        if (nodeCluster.metadata.centroidNode === node.id.toString()) {
          element.classes.push('centroid');
        }
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

    validateGraphElements(nodeElements, edgeElements);

    // Remove existing elements
    cyRef.current.elements().remove();

    // Add new elements with initial styles
    cyRef.current.add([...nodeElements, ...edgeElements]);
    cyRef.current.style(styleSheet);

    // Function to apply cluster styles
    const applyClusterStyles = () => {
      cyRef.current?.nodes().forEach(node => {
        const clusterColor = node.data('clusterColor');
        if (clusterColor) {
          node.addClass('clustered');
        }
        if (node.degree() === 0) {
          node.addClass('disconnected');
        }
      });
      cyRef.current?.style().update();
    };

    // First apply styles
    applyClusterStyles();

    // Run layout
    const layout = cyRef.current.layout(layoutConfig);

    // Add event handlers for layout
    layout.on('layoutstart', () => {
      console.log('Layout started');
    });

    layout.on('layoutstop', () => {
      console.log('Layout stopped, reapplying styles');
      setTimeout(() => {
        applyClusterStyles();
        cyRef.current?.fit();
        console.log('Final graph state:', {
          nodes: cyRef.current?.nodes().length,
          clusteredNodes: cyRef.current?.nodes('.clustered').length,
          centroidNodes: cyRef.current?.nodes('.centroid').length,
          disconnectedNodes: cyRef.current?.nodes('.disconnected').length
        });
      }, 50);
    });

    layout.run();

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