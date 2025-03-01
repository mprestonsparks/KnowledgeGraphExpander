import { useRef, useEffect } from 'react';
import cytoscape from 'cytoscape';
import type { ElementDefinition, NodeDataDefinition, EdgeDataDefinition, ElementGroup } from 'cytoscape';
import type { GraphData } from '@shared/schema';

interface Props {
  data: GraphData;
  onNodeClick?: (nodeId: string) => void;
}

export function GraphVisualizer({ data, onNodeClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const elements: ElementDefinition[] = [
      ...data.nodes.map(node => ({
        data: {
          id: node.id.toString(),
          label: node.label,
          type: node.type,
          ...node.metadata
        } as NodeDataDefinition,
        group: 'nodes' as ElementGroup
      })),
      ...data.edges.map(edge => ({
        data: {
          id: `e${edge.id}`,
          source: edge.sourceId.toString(),
          target: edge.targetId.toString(),
          label: edge.label,
          weight: edge.weight,
          ...edge.metadata
        } as EdgeDataDefinition,
        group: 'edges' as ElementGroup
      }))
    ];

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'text-valign': 'center',
            'background-color': '#6366f1',
            'color': '#000000',
            'font-size': '12px',
            'width': '30px',
            'height': '30px'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#94a3b8',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '10px'
          }
        }
      ],
      layout: {
        name: 'cose',
        animate: false,
        nodeDimensionsIncludeLabels: true
      }
    });

    if (onNodeClick) {
      cyRef.current.on('tap', 'node', event => {
        onNodeClick(event.target.id());
      });
    }

    return () => {
      cyRef.current?.destroy();
    };
  }, [data, onNodeClick]);

  return <div ref={containerRef} style={{ width: '100%', height: '400px' }} />;
}