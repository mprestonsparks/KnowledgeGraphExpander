import { type GraphData } from "@shared/schema";
import { apiRequest } from "./queryClient";

export async function getGraphData(): Promise<GraphData> {
  console.log('Fetching graph data');
  const response = await apiRequest("GET", "/api/graph");
  const data = await response.json();
  console.log('Received graph data:', {
    nodes: data.nodes.length,
    edges: data.edges.length,
    clusters: data.clusters?.length,
    clusterDetails: data.clusters?.map((c: any) => ({
      id: c.clusterId,
      nodes: c.nodes.length,
      theme: c.metadata.semanticTheme
    }))
  });
  return data;
}

export async function expandGraph(prompt: string): Promise<GraphData> {
  const response = await apiRequest("POST", "/api/graph/expand", { prompt });
  return response.json();
}

export async function reconnectNodes(): Promise<GraphData> {
  console.log('Requesting node reconnection');
  const response = await apiRequest("POST", "/api/graph/reconnect");
  const data = await response.json();
  console.log('Received reconnected graph data:', {
    nodes: data.nodes.length,
    edges: data.edges.length,
    newEdges: data.edges.length - (window as any).previousEdgeCount || 0
  });
  (window as any).previousEdgeCount = data.edges.length;
  return data;
}

export async function reapplyClustering(): Promise<GraphData> {
  console.log('Requesting cluster recalculation');
  const response = await apiRequest("POST", "/api/graph/cluster");
  const data = await response.json();
  console.log('Received updated cluster data:', {
    clusters: data.clusters?.length,
    clusterDetails: data.clusters?.map((c: any) => ({
      id: c.clusterId,
      nodes: c.nodes.length,
      theme: c.metadata.semanticTheme
    }))
  });
  return data;
}