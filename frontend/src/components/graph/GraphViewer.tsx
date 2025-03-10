// Simplified Graph Viewer that doesn't rely on Cytoscape
import { type GraphData } from "@shared/schema";

interface GraphViewerProps {
  data: GraphData;
  onSelect?: (nodeId: string) => void;
}

export function GraphViewer({ data, onSelect }: GraphViewerProps) {
  if (!data?.nodes?.length) {
    return (
      <div className="flex justify-center items-center w-full h-[400px] bg-gray-100 border rounded-lg">
        <p className="text-gray-500">No graph data available</p>
      </div>
    );
  }

  // Simple node click handler
  const handleNodeClick = (nodeId: string) => {
    if (onSelect) {
      onSelect(nodeId);
    }
  };

  return (
    <div className="w-full min-h-[400px] bg-gray-100 p-4 rounded-lg">
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-lg font-medium">Knowledge Graph Visualization</h3>
        <button 
          className="px-3 py-1 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
          onClick={() => console.log('Refresh graph')}
        >
          Refresh Graph
        </button>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {data.nodes.slice(0, 20).map(node => (
          <div 
            key={node.id}
            className="p-3 border bg-white rounded-lg cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => handleNodeClick(node.id.toString())}
          >
            <div className="font-medium truncate">{node.label}</div>
            <div className="text-xs text-gray-500">Type: {node.type}</div>
            <div className="text-xs text-gray-400 mt-1">
              {data.edges.filter(e => e.sourceId === node.id || e.targetId === node.id).length} connections
            </div>
          </div>
        ))}
      </div>
      
      {data.nodes.length > 20 && (
        <div className="mt-4 text-center text-sm text-gray-500">
          Showing first 20 of {data.nodes.length} nodes
        </div>
      )}
      
      <div className="mt-6">
        <h4 className="font-medium mb-2">Recent Connections</h4>
        <div className="overflow-auto max-h-[200px] border rounded-lg bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Relation</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.edges.slice(0, 10).map(edge => {
                const source = data.nodes.find(n => n.id === edge.sourceId);
                const target = data.nodes.find(n => n.id === edge.targetId);
                return (
                  <tr key={edge.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm">{source?.label || `Node ${edge.sourceId}`}</td>
                    <td className="px-3 py-2 text-sm font-medium text-blue-600">{edge.label}</td>
                    <td className="px-3 py-2 text-sm">{target?.label || `Node ${edge.targetId}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data.edges.length > 10 && (
          <div className="mt-2 text-center text-sm text-gray-500">
            Showing first 10 of {data.edges.length} connections
          </div>
        )}
      </div>
    </div>
  );
}