import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import { wsClient } from "./lib/websocket";

console.log('Starting Knowledge Graph Frontend Application...');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

// Connect to WebSocket when the app loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, connecting to WebSocket');
  wsClient.connect();
});

console.log('Creating root and rendering application...');

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);

console.log('Application rendered successfully');