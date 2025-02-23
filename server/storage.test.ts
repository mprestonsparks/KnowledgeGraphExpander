import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { storage } from "./storage";
import { type InsertNode, type InsertEdge } from "@shared/schema";
import { sql } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { neon, neonConfig } from "@neondatabase/serverless";
import { WebSocket } from "ws";

// Set up test database connection
neonConfig.webSocketConstructor = WebSocket;
const testDb = drizzle(neon(process.env.DATABASE_URL!));

describe("Storage", () => {
  beforeAll(async () => {
    // Ensure database is ready
    try {
      await testDb.execute(sql`SELECT 1`);
    } catch (error) {
      throw new Error("Database connection failed");
    }
  });

  beforeEach(async () => {
    // Clear the test database before each test
    await testDb.execute(sql`TRUNCATE nodes, edges RESTART IDENTITY CASCADE`);
  });

  const testNode: InsertNode = {
    label: "Test Node",
    type: "test",
    metadata: { test: true }
  };

  const testEdge: InsertEdge = {
    sourceId: 1,
    targetId: 2,
    label: "test_connection",
    weight: 1
  };

  describe("Node Operations", () => {
    it("should create and retrieve a node", async () => {
      const created = await storage.createNode(testNode);
      expect(created.id).toBeDefined();
      expect(created.label).toBe(testNode.label);

      const retrieved = await storage.getNode(created.id);
      expect(retrieved).toEqual(created);
    });

    it("should retrieve all nodes", async () => {
      await storage.createNode(testNode);
      await storage.createNode({ ...testNode, label: "Test Node 2" });

      const nodes = await storage.getAllNodes();
      expect(nodes).toHaveLength(2);
      expect(nodes[0].label).toBe("Test Node");
      expect(nodes[1].label).toBe("Test Node 2");
    });

    it("should handle errors when node not found", async () => {
      const node = await storage.getNode(999);
      expect(node).toBeUndefined();
    });
  });

  describe("Edge Operations", () => {
    beforeEach(async () => {
      // Create nodes needed for edge tests
      await storage.createNode(testNode);
      await storage.createNode({ ...testNode, label: "Test Node 2" });
    });

    it("should create and retrieve an edge", async () => {
      const created = await storage.createEdge(testEdge);
      expect(created.id).toBeDefined();
      expect(created.label).toBe(testEdge.label);

      const retrieved = await storage.getEdge(created.id);
      expect(retrieved).toEqual(created);
    });

    it("should retrieve all edges", async () => {
      await storage.createEdge(testEdge);
      await storage.createEdge({ ...testEdge, label: "test_connection_2" });

      const edges = await storage.getAllEdges();
      expect(edges).toHaveLength(2);
    });
  });

  describe("Graph Operations", () => {
    it("should retrieve full graph with metrics", async () => {
      // Create test data
      await storage.createNode(testNode);
      await storage.createNode({ ...testNode, label: "Test Node 2" });
      await storage.createEdge(testEdge);

      const graph = await storage.getFullGraph();
      expect(graph).toHaveProperty("nodes");
      expect(graph).toHaveProperty("edges");
      expect(graph).toHaveProperty("metrics");
      expect(graph.nodes).toHaveLength(2);
      expect(graph.edges).toHaveLength(1);
      expect(graph.metrics).toHaveProperty("betweenness");
      expect(graph.metrics).toHaveProperty("eigenvector");
      expect(graph.metrics).toHaveProperty("degree");
    });
  });
});