import { type GraphData } from "@shared/schema";

export type WebSocketCallback = (data: GraphData) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private callbacks: Set<WebSocketCallback> = new Set();

  connect() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as GraphData;
        this.callbacks.forEach(callback => callback(data));
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      setTimeout(() => this.connect(), 1000);
    };
  }

  subscribe(callback: WebSocketCallback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }
}

export const wsClient = new WebSocketClient();
