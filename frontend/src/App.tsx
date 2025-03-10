import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getGraphData } from "./lib/graph";
import { wsClient } from "./lib/websocket";
import { type GraphData } from "@shared/schema";

// Initialize the query client
const queryClient = new QueryClient();

// SVG Loading Spinner Component
function LoadingSpinner({ className = "text-blue-500", size = "h-10 w-10" }: { className?: string, size?: string }) {
  return (
    <svg
      className={`animate-spin ${size} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      ></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  );
}

// Graph Node Component to visualize a single node
function GraphNode({ node }: { node: { id: number, label: string, type: string } }) {
  return (
    <div className="p-3 border rounded-lg mb-2 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="font-semibold text-sm">{node.label}</div>
      <div className="text-xs text-gray-500">Type: {node.type}</div>
      <div className="text-xs text-gray-400">ID: {node.id}</div>
    </div>
  );
}

function App() {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const data = await getGraphData();
        setGraphData(data);
        setError(null);
      } catch (err) {
        console.error('Failed to load graph data:', err);
        setError('Failed to load graph data. Please check the server connection.');
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
    
    // Connect to WebSocket
    wsClient.connect();
    
    // Subscribe to WebSocket updates
    const unsubscribe = wsClient.subscribe((data) => {
      console.log('Received WebSocket update:', data);
      setGraphData(data);
    });
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Knowledge Graph System
        </h1>
        <p className="text-lg text-gray-600 mb-4">
          Welcome to your intelligent knowledge mapping system
        </p>
        
        {loading ? (
          <div className="flex justify-center my-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        ) : graphData ? (
          <div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-bold mb-4">Graph Statistics</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-700">Nodes</p>
                  <p className="text-2xl font-bold">{graphData.nodes.length}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-700">Edges</p>
                  <p className="text-2xl font-bold">{graphData.edges.length}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-purple-700">Clusters</p>
                  <p className="text-2xl font-bold">{graphData.clusters?.length || 0}</p>
                </div>
                <div className="bg-amber-50 p-4 rounded-lg">
                  <p className="text-sm text-amber-700">Hub Nodes</p>
                  <p className="text-2xl font-bold">{graphData.metrics?.scaleFreeness?.hubNodes?.length || 0}</p>
                </div>
              </div>
            </div>
            
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Top nodes */}
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-bold mb-4">Recent Nodes</h2>
                {graphData.nodes.slice(0, 5).map(node => (
                  <GraphNode key={node.id} node={node} />
                ))}
              </div>
              
              {/* Clusters */}
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-bold mb-4">Clusters</h2>
                {graphData.clusters?.slice(0, 5).map(cluster => (
                  <div key={cluster.clusterId} className="p-3 border rounded-lg mb-2 bg-white shadow-sm">
                    <div className="font-semibold">{cluster.metadata.semanticTheme}</div>
                    <div className="text-xs text-gray-500">{cluster.nodes.length} nodes</div>
                    <div className="text-xs text-gray-400">Coherence: {cluster.metadata.coherenceScore.toFixed(2)}</div>
                  </div>
                )) || <p>No clusters available</p>}
              </div>
              
              {/* Hub nodes */}
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-bold mb-4">Hub Nodes</h2>
                {graphData.metrics?.scaleFreeness?.hubNodes?.map(hub => {
                  const node = graphData.nodes.find(n => n.id === hub.id);
                  return node ? (
                    <div key={hub.id} className="p-3 border rounded-lg mb-2 bg-white shadow-sm">
                      <div className="font-semibold">{node.label}</div>
                      <div className="text-xs text-gray-500">Connections: {hub.degree}</div>
                      <div className="text-xs text-gray-400">Influence: {hub.influence.toFixed(2)}</div>
                    </div>
                  ) : null;
                }) || <p>No hub nodes available</p>}
              </div>
            </div>
          </div>
        ) : (
          <p>No data available</p>
        )}
      </div>
    </div>
  );
}

export default function AppWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}