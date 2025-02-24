import { useEffect, useRef } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import type { Core, ElementDefinition, Stylesheet } from "cytoscape";
import { type GraphData, type ClusterResult } from "@shared/schema";
import cytoscape from 'cytoscape';
import coseBilkent from 'cytoscape-cose-bilkent';

// Register the cose-bilkent layout
cytoscape.use(coseBilkent);

interface GraphViewerProps {
  data: GraphData & { clusters?: ClusterResult[] };
}

const layoutConfig = {
  name: "cose-bilkent",
  animate: false,
  nodeDimensionsIncludeLabels: true,
  idealEdgeLength: 50,
  nodeRepulsion: 4500,
  padding: 10,
  randomize: false,
  componentSpacing: 40,
  fit: true,
  uniformNodeDimensions: false,
  nodeOverlap: 4,
  coolingFactor: 0.99,
  minTemp: 1.0
};

const styleSheet: Stylesheet[] = [
  {
    selector: "node",
    style: {
      "background-color": "hsl(var(--muted))",
      "label": "data(label)",
      "color": "hsl(var(--foreground))",
      "text-valign": "center",
      "text-halign": "center",
      "font-size": "12px",
      "text-wrap": "ellipsis",
      "text-max-width": "80px",
      "width": 35,
      "height": 35,
      "border-width": 1,
      "border-color": "hsl(var(--border))",
      "text-background-color": "hsl(var(--background))",
      "text-background-opacity": 1,
      "text-background-padding": 2,
      "text-background-shape": "roundrectangle"
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
      "text-background-color": "hsl(var(--background))",
      "text-background-opacity": 1,
      "text-background-padding": 2,
      "text-background-shape": "roundrectangle",
      "text-margin-y": -5,
      "arrow-scale": 0.8
    }
  }
];

export function GraphViewer({ data }: GraphViewerProps) {
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!cyRef.current) {
      console.log('[DEBUG] Cytoscape ref not initialized');
      return;
    }

    const cy = cyRef.current;

    try {
      console.log('[DEBUG] Processing graph data:', {
        nodes: data.nodes.length,
        edges: data.edges.length
      });

      // Create elements array
      const elements: ElementDefinition[] = [
        ...data.nodes.map(node => ({
          data: {
            id: node.id.toString(),
            label: node.label
          },
          classes: ['node']
        })),
        ...data.edges.map(edge => ({
          data: {
            id: `e${edge.id}`,
            source: edge.sourceId.toString(),
            target: edge.targetId.toString(),
            label: edge.label
          },
          classes: ['edge']
        }))
      ];

      // Clear existing elements
      cy.elements().remove();

      // Initialize the graph
      cy.add(elements);
      cy.style(styleSheet);

      // Run layout after a short delay to ensure proper initialization
      setTimeout(() => {
        const layout = cy.layout(layoutConfig);
        layout.run();

        // Add padding and center
        cy.fit(undefined, 20);
        cy.center();

        console.log('[DEBUG] Layout applied');
      }, 50);

    } catch (error) {
      console.error('[DEBUG] Error rendering graph:', error);
    }

    // Cleanup function
    return () => {
      if (cy) {
        cy.destroy();
      }
    };
  }, [data]);

  if (!data.nodes.length) {
    return <div className="w-full h-full border p-4">No graph data available</div>;
  }

  return (
    <div className="w-full h-full border rounded-lg overflow-hidden bg-background">
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