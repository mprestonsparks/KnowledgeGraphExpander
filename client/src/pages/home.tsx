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
    wsClient.connect();
    return wsClient.subscribe((newData) => {
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

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 h-[calc(100vh-3rem)]">
        {/* Left column - Controls and Metrics */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <ControlPanel />
          <MetricsPanel data={data} />
        </div>

        {/* Main content - Graph Viewer */}
        <div className="lg:col-span-7 rounded-xl border border-border bg-card shadow-md">
          <GraphViewer data={data} />
        </div>
      </div>
    </div>
  );
}