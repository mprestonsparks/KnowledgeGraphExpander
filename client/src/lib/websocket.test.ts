import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketClient } from './websocket';
import type { GraphData } from '@shared/schema';

describe('WebSocketClient', () => {
  let wsClient: WebSocketClient;
  let mockWebSocket: any;

  beforeEach(() => {
    mockWebSocket = {
      onmessage: null,
      onclose: null,
      send: vi.fn(),
      close: vi.fn(),
    };

    // Mock WebSocket constructor
    global.WebSocket = vi.fn().mockImplementation(() => mockWebSocket);
    
    wsClient = new WebSocketClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('establishes connection on connect()', () => {
    wsClient.connect();
    expect(global.WebSocket).toHaveBeenCalledWith(expect.stringContaining('/ws'));
  });

  it('handles incoming messages correctly', () => {
    const mockCallback = vi.fn();
    const mockData: GraphData = {
      nodes: [{ id: 1, label: "Test", type: "test", metadata: {} }],
      edges: [],
      metrics: { betweenness: {}, eigenvector: {}, degree: {} }
    };

    wsClient.connect();
    wsClient.subscribe(mockCallback);

    // Simulate receiving a message
    mockWebSocket.onmessage({ data: JSON.stringify(mockData) });

    expect(mockCallback).toHaveBeenCalledWith(mockData);
  });

  it('handles connection close and attempts reconnection', () => {
    vi.useFakeTimers();
    wsClient.connect();

    // Simulate connection close
    mockWebSocket.onclose();
    
    // Fast-forward timer
    vi.advanceTimersByTime(1000);

    expect(global.WebSocket).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('properly unsubscribes callbacks', () => {
    const mockCallback = vi.fn();
    wsClient.connect();
    
    const unsubscribe = wsClient.subscribe(mockCallback);
    unsubscribe();

    // Simulate message after unsubscribe
    mockWebSocket.onmessage({ data: JSON.stringify({}) });
    
    expect(mockCallback).not.toHaveBeenCalled();
  });
});
