// Update the test script configuration to use vitest
import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { graphManager } from "./graph_manager";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Initialize WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Initialize graph manager
  await graphManager.initialize();

  // Broadcast graph updates to all connected clients
  function broadcastUpdate(data: any) {
    console.log('Broadcasting graph update:', {
      nodes: data.nodes.length,
      edges: data.edges.length,
      connectedClients: wss.clients.size
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
        console.log('Sent update to client');
      }
    });
  }

  // WebSocket connection handling
  wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('close', () => {
      console.log('Client disconnected');
    });
  });

  // API Routes
  app.get('/api/graph', async (_req, res) => {
    const graph = await storage.getFullGraph();
    res.json(graph);
  });

  // Update the existing expand endpoint to use iterative expansion
  app.post('/api/graph/expand', async (req, res) => {
    const schema = z.object({ prompt: z.string() });
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    try {
      const updatedGraph = await graphManager.startIterativeExpansion(result.data.prompt);
      console.log('Graph expansion complete, broadcasting update');
      broadcastUpdate(updatedGraph);
      res.json(updatedGraph);
    } catch (error) {
      console.error('Failed to expand graph:', error);
      res.status(500).json({ error: "Failed to expand graph" });
    }
  });

  // New endpoint for relationship suggestions
  app.get('/api/graph/suggestions', async (_req, res) => {
    try {
      const suggestions = await graphManager.suggestRelationships();
      res.json(suggestions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get relationship suggestions" });
    }
  });

  app.post('/api/graph/suggestions/apply', async (req, res) => {
    const schema = z.object({
      sourceId: z.number(),
      targetId: z.number(),
      label: z.string(),
      weight: z.number().default(1)
    });

    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    try {
      const updatedGraph = await graphManager.applyRelationship(result.data);
      broadcastUpdate(updatedGraph);
      res.json(updatedGraph);
    } catch (error) {
      res.status(500).json({ error: "Failed to apply relationship" });
    }
  });

  // Add new cluster endpoint
  app.post('/api/graph/cluster', async (_req, res) => {
    try {
      console.log('Starting cluster recalculation');
      // Force recalculation of clusters through graph manager
      const graphData = await graphManager.recalculateClusters();
      console.log('Clusters recalculated, broadcasting update');
      broadcastUpdate(graphData);
      res.json(graphData);
    } catch (error) {
      console.error('Failed to apply clustering:', error);
      res.status(500).json({ error: "Failed to apply clustering" });
    }
  });

  app.post('/api/graph/reconnect', async (_req, res) => {
    try {
      console.log('Starting node reconnection process');
      const updatedGraph = await graphManager.reconnectDisconnectedNodes();
      console.log('Broadcasting reconnected graph update');
      broadcastUpdate(updatedGraph);
      res.json(updatedGraph);
    } catch (error) {
      console.error('Failed to reconnect nodes:', error);
      res.status(500).json({ error: "Failed to reconnect nodes" });
    }
  });

  return httpServer;
}