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
    if (!cyRef.current) return;

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

    cyRef.current.elements().remove();
    cyRef.current.add(elements);
    cyRef.current.layout(layoutConfig).run();
  }, [data]);

  return (
    <div className="w-full h-full bg-background">
      <CytoscapeComponent
        elements={[]}
        stylesheet={styleSheet}
        layout={layoutConfig}
        cy={(cy) => { cyRef.current = cy; }}
        className="w-full h-full"
      />
    </div>
  );
}