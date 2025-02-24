import { type GraphData } from "@shared/schema";
import { apiRequest } from "./queryClient";

export async function expandGraph(prompt: string): Promise<GraphData> {
  const response = await apiRequest("POST", "/api/graph/expand", { prompt });
  return response.json();
}

export async function reconnectNodes(): Promise<GraphData> {
  const response = await apiRequest("POST", "/api/graph/reconnect");
  return response.json();
}

export async function reapplyClustering(): Promise<GraphData> {
  const response = await apiRequest("POST", "/api/graph/cluster");
  return response.json();
}