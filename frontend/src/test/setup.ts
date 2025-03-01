import '@testing-library/jest-dom';
import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';

// Mock WebSocket
class MockWebSocket {
  onmessage: ((event: any) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  onopen: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();
}

// Mock global WebSocket
global.WebSocket = MockWebSocket as any;

// Create a new QueryClient for testing
export const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: Infinity
    },
    mutations: {
      retry: false
    }
  }
});

beforeAll(() => {
  // Add any global test setup
  vi.mock('@/lib/queryClient', () => ({
    apiRequest: vi.fn()
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

afterAll(() => {
  vi.resetAllMocks();
});