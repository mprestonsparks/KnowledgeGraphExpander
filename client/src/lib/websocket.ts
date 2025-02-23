import { type GraphData } from "@shared/schema";

export type WebSocketCallback = (data: GraphData) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private callbacks: Set<WebSocketCallback> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second

  connect() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    console.log('WebSocket connecting to:', wsUrl);
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connection established');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
    };

    this.ws.onmessage = (event) => {
      try {
        console.log('WebSocket message received');
        const data = JSON.parse(event.data) as GraphData;
        this.callbacks.forEach(callback => callback(data));
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = (event) => {
      // Add null checks for event properties
      const code = event?.code ?? 'unknown';
      const reason = event?.reason ?? 'no reason provided';
      console.log('WebSocket connection closed:', code, reason);
      this.handleReconnect();
    };
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

      // Exponential backoff
      setTimeout(() => {
        this.connect();
        this.reconnectDelay *= 2;
      }, this.reconnectDelay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  subscribe(callback: WebSocketCallback) {
    console.log('New WebSocket subscriber added');
    this.callbacks.add(callback);
    return () => {
      console.log('WebSocket subscriber removed');
      this.callbacks.delete(callback);
    };
  }
}

export const wsClient = new WebSocketClient();