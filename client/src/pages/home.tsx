import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { GraphViewer } from "@/components/graph/GraphViewer";
import { ControlPanel } from "@/components/graph/ControlPanel";
import { MetricsPanel } from "@/components/graph/MetricsPanel";
import { wsClient } from "@/lib/websocket";
import { queryClient } from "@/lib/queryClient";
import { type GraphData } from "@shared/schema";

export default function Home() {
  const { data, isLoading } = useQuery<GraphData>({
    queryKey: ["/api/graph"],
    refetchInterval: false
  });

  useEffect(() => {
    console.log('Setting up WebSocket connection');
    wsClient.connect();

    return wsClient.subscribe((newData) => {
      console.log('Received graph update, updating query cache');
      queryClient.setQueryData(["/api/graph"], newData);
    });
  }, []);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  console.log('Rendering graph with data:', {
    nodes: data.nodes.length,
    edges: data.edges.length
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left column - Controls and Suggestions */}
          <div className="lg:col-span-3 space-y-4">
            <ControlPanel />
          </div>

          {/* Main content - Graph Viewer */}
          <div className="lg:col-span-6 min-h-[calc(100vh-2rem)] rounded-xl border border-border bg-card shadow-md">
            <GraphViewer data={data} />
          </div>

          {/* Right column - Metrics */}
          <div className="lg:col-span-3">
            <MetricsPanel data={data} />
          </div>
        </div>
      </div>
    </div>
  );
}