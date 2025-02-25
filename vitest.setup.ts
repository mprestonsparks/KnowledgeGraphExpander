import "@testing-library/jest-dom";
import { expect, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Set up test environment
beforeAll(() => {
  // Configure global test environment settings if needed
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});