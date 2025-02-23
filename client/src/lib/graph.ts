import { type GraphData } from "@shared/schema";
import { apiRequest } from "./queryClient";

export async function expandGraph(prompt: string): Promise<GraphData> {
  const response = await apiRequest("POST", "/api/graph/expand", { prompt });
  return response.json();
}
