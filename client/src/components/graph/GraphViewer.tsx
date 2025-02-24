import { useEffect, useRef } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import type { Core, ElementDefinition, Stylesheet } from "cytoscape";
import { type GraphData, type ClusterResult } from "@shared/schema";

interface GraphViewerProps {
  data: GraphData & { clusters?: ClusterResult[] };
}

const styleSheet: Stylesheet[] = [
  {
    selector: "node",
    style: {
      "background-color": "#888",
      "label": "data(label)",
      "width": 45,
      "height": 45,
      "text-valign": "center",
      "text-halign": "center"
    }
  },
  {
    selector: "edge",
    style: {
      "width": 2,
      "line-color": "#888",
      "target-arrow-color": "#888",
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      "label": "data(label)"
    }
  }
];

const layoutConfig = {
  name: "grid",
  rows: 3
};

export function GraphViewer({ data }: GraphViewerProps) {
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!cyRef.current) {
      console.log('[DEBUG] Cytoscape ref not initialized');
      return;
    }

    const cy = cyRef.current;

    try {
      console.log('[DEBUG] Creating graph elements from data:', {
        nodes: data.nodes.length,
        edges: data.edges.length
      });

      // Create basic elements
      const elements: ElementDefinition[] = [
        ...data.nodes.map(node => {
          console.log('[DEBUG] Processing node:', node);
          return {
            data: {
              id: node.id.toString(),
              label: node.label
            },
            group: 'nodes'
          };
        }),
        ...data.edges.map(edge => {
          console.log('[DEBUG] Processing edge:', edge);
          return {
            data: {
              id: `e${edge.id}`,
              source: edge.sourceId.toString(),
              target: edge.targetId.toString(),
              label: edge.label
            },
            group: 'edges'
          };
        })
      ];

      console.log('[DEBUG] Created elements:', elements);

      // Clear and add elements
      cy.elements().remove();
      cy.add(elements);

      // Apply layout
      const layout = cy.layout(layoutConfig);
      layout.run();

      console.log('[DEBUG] Graph rendered successfully');
    } catch (error) {
      console.error('[DEBUG] Error rendering graph:', error);
    }
  }, [data]);

  if (!data.nodes.length) {
    return <div className="w-full h-full border p-4">No graph data available</div>;
  }

  return (
    <div className="w-full h-full border">
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