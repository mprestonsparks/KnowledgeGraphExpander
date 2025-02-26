import { useEffect, useRef } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import type { Core, ElementDefinition } from "cytoscape";
import { type GraphData, type ClusterResult } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-react";
import { wsClient } from "@/lib/websocket";

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

  const refreshGraph = () => {
    if (!cyRef.current) {
      console.warn('Cytoscape instance not available');
      return;
    }

    if (!data?.nodes?.length) {
      console.warn('No nodes available in data');
      return;
    }

    const cy = cyRef.current;

    // Log initial state for debugging
    console.log('Graph refresh triggered:', {
      totalNodes: data.nodes.length,
      totalEdges: data.edges?.length || 0,
      nodeDetails: data.nodes.map(n => ({
        id: n.id,
        label: n.label,
        type: n.type
      }))
    });

    // Clear existing elements
    cy.elements().remove();

    // Generate cluster colors
    const clusterColors = data.clusters ? calculateClusterColors(data.clusters) : {};

    // Create node elements
    const nodeElements: ElementDefinition[] = data.nodes.map(node => {
      const nodeId = node.id.toString();
      const nodeCluster = data.clusters?.find(c => c.nodes.includes(nodeId));

      const element: ElementDefinition = {
        group: 'nodes',
        data: {
          id: nodeId,
          label: node.label || `Node ${nodeId}`,
          type: node.type || 'concept',
          ...(nodeCluster && {
            clusterColor: clusterColors[nodeCluster.clusterId],
            clusterId: nodeCluster.clusterId
          })
        },
        classes: []
      };

      // Add cluster class if node is part of a cluster
      if (nodeCluster) {
        element.classes.push('clustered');
      }

      // Add centroid class if node is a cluster centroid
      if (nodeCluster?.metadata.centroidNode === nodeId) {
        element.classes.push('centroid');
      }

      // Add disconnected class if node has no edges
      const degree = data.metrics?.degree?.[node.id] || 0;
      if (degree === 0) {
        element.classes.push('disconnected');
      }

      return element;
    });

    // Create edge elements
    const edgeElements: ElementDefinition[] = (data.edges || []).map(edge => ({
      group: 'edges',
      data: {
        id: `e${edge.id}`,
        source: edge.sourceId.toString(),
        target: edge.targetId.toString(),
        label: edge.label || 'related_to',
        weight: edge.weight || 1
      }
    }));

    // Add all elements at once
    cy.add([...nodeElements, ...edgeElements]);

    // Apply layout
    const layout = cy.layout(layoutConfig);

    // Log final state after layout
    layout.one('layoutstop', () => {
      console.log('Layout complete:', {
        nodesInGraph: cy.nodes().length,
        edgesInGraph: cy.edges().length,
        clusteredNodes: cy.nodes('.clustered').length,
        centroidNodes: cy.nodes('.centroid').length,
        disconnectedNodes: cy.nodes('.disconnected').length
      });
      cy.fit();
    });

    layout.run();
  };

  // Handle WebSocket updates
  useEffect(() => {
    console.log('Setting up WebSocket subscription');
    const unsubscribe = wsClient.subscribe((newData) => {
      console.log('Received graph update via WebSocket:', {
        nodes: newData.nodes.length,
        edges: newData.edges?.length || 0
      });
      if (cyRef.current) {
        refreshGraph();
      }
    });

    return () => {
      console.log('Cleaning up WebSocket subscription');
      unsubscribe();
    };
  }, []);

  // Refresh graph when data changes
  useEffect(() => {
    refreshGraph();
  }, [data]);

  return (
    <div className="relative w-full h-full bg-background">
      <div className="absolute top-4 right-4 z-50 bg-background/80 p-2 rounded-lg shadow-md">
        <Button
          onClick={refreshGraph}
          size="sm"
          variant="secondary"
          className="gap-2 font-medium"
        >
          <RefreshCcw className="w-4 h-4" />
          Refresh Graph
        </Button>
      </div>
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