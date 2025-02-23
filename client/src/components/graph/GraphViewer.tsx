import { useEffect, useRef } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import type { Core, ElementDefinition } from "cytoscape";
import { type GraphData } from "@shared/schema";

interface GraphViewerProps {
  data: GraphData;
}

const layoutConfig = {
  name: "cose-bilkent",
  animate: true,
  nodeRepulsion: 4500,
  idealEdgeLength: 50,
  randomize: false
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
      "font-size": "12px",
      "text-wrap": "wrap",
      "text-max-width": "80px"
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
      "text-rotation": "autorotate"
    }
  },
  {
    selector: "node[degree >= 3]",
    style: {
      "width": 30,
      "height": 30,
      "background-color": "hsl(var(--primary))"
    }
  }
];

export function GraphViewer({ data }: GraphViewerProps) {
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    console.log('GraphViewer useEffect starting, cyRef:', cyRef.current ? 'initialized' : 'not initialized');
    if (!cyRef.current) {
      console.log('No Cytoscape instance available');
      return;
    }

    try {
      console.log('Processing graph data:', { nodes: data.nodes.length, edges: data.edges.length });
      const elements: ElementDefinition[] = [
        ...data.nodes.map(node => ({
          data: { 
            id: node.id.toString(),
            label: node.label,
            degree: data.metrics.degree[node.id] || 0
          }
        })),
        ...data.edges.map(edge => ({
          data: {
            id: `e${edge.id}`,
            source: edge.sourceId.toString(),
            target: edge.targetId.toString(),
            label: edge.label,
            weight: edge.weight
          }
        }))
      ];

      console.log('Removing existing elements');
      cyRef.current.elements().remove();

      console.log('Adding new elements:', elements.length);
      cyRef.current.add(elements);

      console.log('Running layout');
      cyRef.current.layout(layoutConfig).run();

      console.log('Graph update completed successfully');
    } catch (error) {
      console.error('Error updating graph:', error);
    }
  }, [data]);

  return (
    <div className="w-full h-full bg-background">
      <CytoscapeComponent
        elements={[]}
        stylesheet={styleSheet}
        layout={layoutConfig}
        cy={(cy) => {
          console.log('Cytoscape instance initialized');
          cyRef.current = cy;
        }}
        className="w-full h-full"
      />
    </div>
  );
}