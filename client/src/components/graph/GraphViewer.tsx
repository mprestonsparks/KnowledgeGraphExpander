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

    // Log initial state
    console.log('Graph data received:', {
      nodes: data.nodes.map(n => ({ id: n.id, label: n.label })),
      edges: data.edges.map(e => ({
        id: e.id,
        source: e.sourceId,
        target: e.targetId,
        label: e.label
      })),
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
      console.log('Created node element:', {
        id: nodeId,
        label: node.label,
        classes: element.classes
      });
      return element;
    });

    // Create edge elements with proper ID handling
    const edgeElements = data.edges.map(edge => {
      const sourceId = edge.sourceId.toString();
      const targetId = edge.targetId.toString();

      // Verify node existence
      const sourceExists = nodeMap.has(edge.sourceId);
      const targetExists = nodeMap.has(edge.targetId);

      console.log('Processing edge:', {
        id: edge.id,
        source: sourceId,
        target: targetId,
        sourceExists,
        targetExists,
        label: edge.label
      });

      if (sourceExists && targetExists) {
        // Ensure we have a valid edge ID string
        const edgeId = `e${edge.id || Math.floor(Math.random() * 1000000)}`;
        return {
          data: {
            id: edgeId,
            source: sourceId,
            target: targetId,
            label: edge.label,
            weight: edge.weight
          },
          classes: []
        };
      }
      console.warn('Skipping edge due to missing nodes:', {
        edge,
        sourceExists,
        targetExists
      });
      return null;
    }).filter((edge): edge is ElementDefinition => edge !== null);

    // Clear existing elements
    cy.elements().remove();

    // Add elements and verify
    const elementsToAdd = [...nodeElements, ...edgeElements];
    console.log('Adding elements to cytoscape:', {
      totalElements: elementsToAdd.length,
      nodes: nodeElements.length,
      edges: edgeElements.length,
      edgeDetails: edgeElements.map(e => ({
        id: e.data.id,
        source: e.data.source,
        target: e.data.target,
        label: e.data.label
      }))
    });

    cy.add(elementsToAdd);

    // Verify elements were added
    console.log('Elements in cytoscape after adding:', {
      nodes: cy.nodes().length,
      edges: cy.edges().length,
      edgeIds: cy.edges().map(e => e.id()).toArray()
    });

    // Apply styles and layout
    cy.style(styleSheet);
    const layout = cy.layout(layoutConfig);

    layout.one('layoutstop', () => {
      console.log('Layout complete. Final element counts:', {
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