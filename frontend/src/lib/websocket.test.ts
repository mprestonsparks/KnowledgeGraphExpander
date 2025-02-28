import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketClient } from './websocket';
import type { GraphData } from '@shared/schema';

describe('WebSocketClient', () => {
  let wsClient: WebSocketClient;
  let mockWebSocket: any;

  // Mock window object
  const mockWindow = {
    location: {
      protocol: 'http:',
      host: 'localhost:3000'
    }
  };

  beforeEach(() => {
    // Setup window mock
    vi.stubGlobal('window', mockWindow);

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
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('establishes connection on connect()', () => {
    wsClient.connect();
    expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:3000/ws');
  });

  it('handles incoming messages correctly', () => {
    const mockCallback = vi.fn();
    const mockData: GraphData = {
      nodes: [{ id: 1, label: "Test", type: "test", metadata: {} }],
      edges: [],
      metrics: {
        betweenness: {},
        eigenvector: {},
        degree: {},
        scaleFreeness: {
          powerLawExponent: 2.1,
          fitQuality: 0.85,
          hubNodes: [{ id: 1, degree: 2, influence: 0.8 }],
          bridgingNodes: [{ id: 2, communities: 2, betweenness: 0.7 }]
        }
      },
      clusters: []
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