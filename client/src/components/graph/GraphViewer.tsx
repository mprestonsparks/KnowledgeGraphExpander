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
  idealEdgeLength: 200,
  nodeRepulsion: 7000,
  padding: 80,
  randomize: false,
  fit: true,
  spacingFactor: 1.2
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
      "font-size": "14px",
      "text-wrap": "ellipsis",
      "text-max-width": "120px",
      "width": 60,
      "height": 60,
      "border-width": 2,
      "border-color": "hsl(var(--border))",
      "text-background-color": "hsl(var(--background))",
      "text-background-opacity": 1,
      "text-background-padding": 5,
      "text-background-shape": "roundrectangle",
      "text-outline-color": "hsl(var(--background))",
      "text-outline-width": 3,
      "opacity": 1
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
      "text-background-color": "hsl(var(--background))",
      "text-background-opacity": 1,
      "text-background-padding": 4,
      "text-background-shape": "roundrectangle",
      "text-outline-color": "hsl(var(--background))",
      "text-outline-width": 3,
      "text-margin-y": -12
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

      // Create elements
      const elements: ElementDefinition[] = [
        ...data.nodes.map(node => ({
          data: {
            id: node.id.toString(),
            label: node.label
          },
          group: 'nodes',
          position: { x: 0, y: 0 }
        })),
        ...data.edges.map(edge => ({
          data: {
            id: `e${edge.id}`,
            source: edge.sourceId.toString(),
            target: edge.targetId.toString(),
            label: edge.label
          },
          group: 'edges'
        }))
      ];

      // Clear existing elements
      cy.elements().remove();

      // Add new elements and apply styles
      cy.add(elements);
      cy.style(styleSheet);

      // Run layout with a delay to ensure proper initialization
      setTimeout(() => {
        const layout = cy.layout(layoutConfig);
        layout.run();

        // Add extra padding when fitting view
        cy.fit(undefined, 60);
        cy.center();
      }, 100);

      console.log('[DEBUG] Graph rendered with', elements.length, 'elements');
    } catch (error) {
      console.error('[DEBUG] Error rendering graph:', error);
    }
  }, [data]);

  if (!data.nodes.length) {
    return <div className="w-full h-full border p-4">No graph data available</div>;
  }

  return (
    <div className="w-full h-full border rounded-lg overflow-hidden bg-background p-6">
      <CytoscapeComponent
        elements={[]} // Elements added via useEffect
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