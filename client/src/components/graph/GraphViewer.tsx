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
  nodeRepulsion: 8000,
  idealEdgeLength: 100,
  nodeOverlap: 20,
  padding: 40,
  randomize: false,
  componentSpacing: 150,
  refresh: 20,
  fit: true,
  boundingBox: undefined
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
  }
];

export function GraphViewer({ data }: GraphViewerProps) {
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!cyRef.current) return;

    console.log('Updating graph with:', {
      nodes: data.nodes.length,
      edges: data.edges.length
    });

    const elements: ElementDefinition[] = [
      ...data.nodes.map(node => ({
        data: { 
          id: node.id.toString(),
          label: node.label,
          degree: data.metrics.degree[node.id] || 0,
          betweenness: data.metrics.betweenness[node.id] || 0
        },
        group: 'nodes'
      })),
      ...data.edges.map(edge => ({
        data: {
          id: `e${edge.id}`,
          source: edge.sourceId.toString(),
          target: edge.targetId.toString(),
          label: edge.label,
          weight: edge.weight
        },
        group: 'edges'
      }))
    ];

    console.log('Generated elements:', {
      total: elements.length,
      nodes: elements.filter(e => e.group === 'nodes').length,
      edges: elements.filter(e => e.group === 'edges').length
    });

    cyRef.current.elements().remove();
    cyRef.current.add(elements);
    cyRef.current.layout(layoutConfig).run();
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