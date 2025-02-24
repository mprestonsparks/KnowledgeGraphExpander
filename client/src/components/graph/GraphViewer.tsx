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
    selector: "node.disconnected",
    style: {
      "border-color": "hsl(var(--destructive))",
      "border-width": "3px"
    }
  },
  {
    selector: "node[?clusterColor]",
    style: {
      "background-color": "data(clusterColor)",
      "border-color": "data(clusterColor)",
      "border-width": "3px"
    }
  },
  {
    selector: "node[?isCentroid]",
    style: {
      "border-width": "5px",
      "border-color": "hsl(var(--primary))",
      "width": "70px",
      "height": "70px"
    }
  }
];

function validateGraphElements(nodes: ElementDefinition[], edges: ElementDefinition[]): void {
  const nodeIds = new Set(nodes.map(n => n.data.id));
  const connectedNodes = new Set<string>();
  const edgeConnections = new Map<string, Set<string>>();

  edges.forEach(edge => {
    if (edge.data.source && edge.data.target) {
      connectedNodes.add(edge.data.source);
      connectedNodes.add(edge.data.target);

      if (!edgeConnections.has(edge.data.source)) {
        edgeConnections.set(edge.data.source, new Set());
      }
      if (!edgeConnections.has(edge.data.target)) {
        edgeConnections.set(edge.data.target, new Set());
      }
      edgeConnections.get(edge.data.source)!.add(edge.data.target);
      edgeConnections.get(edge.data.target)!.add(edge.data.source);
    }
  });

  const disconnectedNodes = Array.from(nodeIds).filter(id => !connectedNodes.has(id));

  console.log('Graph validation results:', {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    disconnectedCount: disconnectedNodes.length
  });
}

export function GraphViewer({ data }: GraphViewerProps) {
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!cyRef.current) return;

    console.log('Updating graph with clusters:', {
      nodes: data.nodes.length,
      edges: data.edges.length,
      clusters: data.clusters?.length || 0
    });

    const clusterColors = data.clusters?.reduce((acc, cluster) => {
      // Use a wider color spectrum for better distinction
      const hue = (cluster.clusterId * 137.5) % 360;
      const saturation = 70 + (cluster.clusterId * 5) % 20; // Vary saturation
      const lightness = 45 + (cluster.clusterId * 7) % 20; // Vary lightness
      acc[cluster.clusterId] = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      return acc;
    }, {} as Record<number, string>) || {};

    // Log cluster color assignments
    if (data.clusters) {
      console.log('Cluster colors:', Object.entries(clusterColors).map(([id, color]) => ({
        clusterId: id,
        color,
        nodeCount: data.clusters?.find(c => c.clusterId === parseInt(id))?.nodes.length
      })));
    }

    const nodeElements = data.nodes.map(node => {
      const nodeCluster = data.clusters?.find(c => 
        c.nodes.includes(node.id.toString())
      );

      const nodeData = {
        id: node.id.toString(),
        label: node.label,
        degree: data.metrics.degree[node.id] || 0,
        betweenness: data.metrics.betweenness[node.id] || 0
      };

      if (nodeCluster) {
        Object.assign(nodeData, {
          cluster: nodeCluster.clusterId,
          clusterColor: clusterColors[nodeCluster.clusterId],
          isCentroid: nodeCluster.metadata.centroidNode === node.id.toString()
        });
      }

      // Log node styling data
      console.log('Node styling:', {
        id: node.id,
        cluster: nodeCluster?.clusterId,
        color: nodeCluster ? clusterColors[nodeCluster.clusterId] : 'default',
        isCentroid: nodeCluster?.metadata.centroidNode === node.id.toString()
      });

      return {
        data: nodeData,
        group: 'nodes' as const
      };
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

    validateGraphElements(nodeElements, edgeElements);

    cyRef.current.elements().remove();
    const elements = [...nodeElements, ...edgeElements];
    cyRef.current.add(elements);

    const layout = cyRef.current.layout(layoutConfig);
    layout.run();

    cyRef.current.nodes().forEach(node => {
      if (node.degree() === 0) {
        node.addClass('disconnected');
      } else {
        node.removeClass('disconnected');
      }
    });

    cyRef.current.fit();
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