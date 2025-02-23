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
    <div className="flex flex-col h-screen bg-background">
      <div className="h-24 p-4">
        <ControlPanel />
      </div>
      <div className="flex flex-1 p-4 gap-4">
        <div className="flex-1 rounded-lg border border-border">
          <GraphViewer data={data} />
        </div>
        <div className="w-80">
          <MetricsPanel data={data} />
        </div>
      </div>
    </div>
  );
}