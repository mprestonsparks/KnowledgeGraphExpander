import { useEffect, useRef } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import type { Core, ElementDefinition } from "cytoscape";
import { type GraphData } from "@shared/schema";

interface GraphViewerProps {
  data: GraphData;
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
  // Style for disconnected nodes
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
  const edgeConnections = new Map<string, Set<string>>();

  // Track nodes with connections and build edge connection map
  edges.forEach(edge => {
    if (edge.data.source && edge.data.target) {
      connectedNodes.add(edge.data.source);
      connectedNodes.add(edge.data.target);

      // Track edges per node
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

  // Find disconnected nodes
  const disconnectedNodes = Array.from(nodeIds).filter(id => !connectedNodes.has(id));

  console.log('Detailed graph validation:', {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    disconnectedNodes: disconnectedNodes.length,
    disconnectedNodeIds: disconnectedNodes,
    nodesWithMostConnections: Array.from(edgeConnections.entries())
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 5)
      .map(([nodeId, connections]) => ({
        nodeId,
        connectionCount: connections.size
      }))
  });

  // Verify edge endpoints and log any issues
  edges.forEach(edge => {
    if (!nodeIds.has(edge.data.source) || !nodeIds.has(edge.data.target)) {
      console.error('Invalid edge connection:', {
        edgeId: edge.data.id,
        source: edge.data.source,
        target: edge.data.target,
        sourceExists: nodeIds.has(edge.data.source),
        targetExists: nodeIds.has(edge.data.target)
      });
    }
  });
}

export function GraphViewer({ data }: GraphViewerProps) {
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!cyRef.current) return;

    console.log('Updating graph visualization:', {
      nodes: data.nodes.length,
      edges: data.edges.length,
      metrics: {
        nodeCount: Object.keys(data.metrics.degree).length,
        edgeCount: data.edges.length
      }
    });

    const nodeElements = data.nodes.map(node => ({
      data: { 
        id: node.id.toString(),
        label: node.label,
        degree: data.metrics.degree[node.id] || 0,
        betweenness: data.metrics.betweenness[node.id] || 0
      },
      group: 'nodes' as const
    }));

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

    // Clear existing elements
    cyRef.current.elements().remove();

    // Add new elements
    const elements = [...nodeElements, ...edgeElements];
    cyRef.current.add(elements);

    // Run layout with a completion callback
    const layout = cyRef.current.layout(layoutConfig);
    layout.run();

    // Mark disconnected nodes and adjust their styling
    cyRef.current.nodes().forEach(node => {
      const degree = node.degree();
      if (degree === 0) {
        node.addClass('disconnected');
        console.warn('Disconnected node:', {
          id: node.id(),
          label: node.data('label')
        });
      } else {
        node.removeClass('disconnected');
      }
    });

    // Fit the graph to the viewport
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