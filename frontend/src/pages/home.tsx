import React from "react";
import { useQuery } from "@tanstack/react-query";
import { type GraphData } from "@shared/schema";

export default function Home() {
  const { data, isLoading } = useQuery<GraphData>({
    queryKey: ["/api/graph"],
    refetchInterval: false
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4">
        <h1 className="text-4xl font-bold mb-8">Knowledge Graph Visualization</h1>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left column - Graph Statistics */}
          <div className="lg:col-span-3 space-y-4">
            <div className="p-4 rounded-xl border border-border bg-card">
              <h2 className="text-xl font-semibold mb-4">Graph Statistics</h2>
              <p>Nodes: {data.nodes.length}</p>
              <p>Edges: {data.edges.length}</p>
            </div>
          </div>

          {/* Main content - Graph Visualization */}
          <div className="lg:col-span-9 min-h-[calc(100vh-2rem)] rounded-xl border border-border bg-card p-4">
            <p className="text-center text-muted-foreground">
              Graph visualization will be implemented here
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}