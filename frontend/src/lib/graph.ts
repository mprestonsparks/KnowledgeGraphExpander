import { type GraphData } from "@shared/schema";
import { apiRequest } from "./queryClient";

export async function getGraphData(): Promise<GraphData> {
  console.log('Fetching graph data');
  const response = await apiRequest("/api/graph", { 
    method: "GET" 
  });
  const data = await response.json();
  console.log('Received graph data:', {
    nodes: data.nodes.length,
    edges: data.edges.length,
    edgeDetails: data.edges.map((e: any) => ({
      id: e.id,
      source: e.sourceId,
      target: e.targetId,
      label: e.label
    })),
    clusters: data.clusters?.length,
    clusterDetails: data.clusters?.map((c: any) => ({
      id: c.clusterId,
      nodes: c.nodes.length,
      theme: c.metadata.semanticTheme
    }))
  });
  return data;
}

export async function expandGraph(prompt: string, maxIterations: number = 10): Promise<GraphData> {
  const response = await apiRequest("/api/graph/expand", { 
    method: "POST",
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt, maxIterations })
  });
  return response.json();
}

export async function reconnectNodes(): Promise<GraphData> {
  console.log('Requesting node reconnection');
  const response = await apiRequest("/api/graph/reconnect", {
    method: "POST"
  });
  const data = await response.json();
  console.log('Received reconnected graph data:', {
    nodes: data.nodes.length,
    edges: data.edges.length,
    edgeDetails: data.edges.map((e: any) => ({
      id: e.id,
      source: e.sourceId,
      target: e.targetId,
      label: e.label
    })),
    newEdges: data.edges.length - (window as any).previousEdgeCount || 0
  });
  (window as any).previousEdgeCount = data.edges.length;
  return data;
}

export async function reapplyClustering(): Promise<GraphData> {
  console.log('Requesting cluster recalculation');
  const response = await apiRequest("/api/graph/cluster", {
    method: "POST"
  });
  const data = await response.json();
  console.log('Received updated cluster data:', {
    clusters: data.clusters?.length,
    edges: data.edges.length,
    edgeDetails: data.edges.map((e: any) => ({
      id: e.id,
      source: e.sourceId,
      target: e.targetId,
      label: e.label
    })),
    clusterDetails: data.clusters?.map((c: any) => ({
      id: c.clusterId,
      nodes: c.nodes.length,
      theme: c.metadata.semanticTheme
    }))
  });
  return data;
}