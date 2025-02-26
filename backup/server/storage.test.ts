import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { storage } from "./storage";
import { type InsertNode, type InsertEdge } from "@shared/schema";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { WebSocket } from "ws";

describe("Storage", () => {
  beforeAll(async () => {
    // Check if database URL is available
    if (!process.env.DATABASE_URL) {
      console.warn("DATABASE_URL not found, skipping database tests");
      return;
    }

    // Ensure database is ready
    try {
      neonConfig.webSocketConstructor = WebSocket;
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const db = drizzle(pool);
      await db.execute(sql`SELECT 1`);
    } catch (error) {
      console.error("Database connection error:", error);
      throw new Error("Database connection failed: " + (error as Error).message);
    }
  });

  beforeEach(async () => {
    if (!process.env.DATABASE_URL) {
      return;
    }

    // Clear the test database before each test
    try {
      neonConfig.webSocketConstructor = WebSocket;
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const db = drizzle(pool);
      await db.execute(sql`TRUNCATE nodes, edges RESTART IDENTITY CASCADE`);
    } catch (error) {
      console.error("Failed to reset test database:", error);
    }
  });

  const testNode: InsertNode = {
    label: "Test Node",
    type: "test",
    metadata: {
      description: "Test description",
      semanticContext: {
        theme: "test theme",
        confidence: 0.9,
        reasoning: "test reasoning"
      }
    }
  };

  const testEdge: InsertEdge = {
    sourceId: 1,
    targetId: 2,
    label: "test_connection",
    weight: 1,
    metadata: {
      confidence: 0.8,
      reasoning: "test edge reasoning",
      validatedAt: new Date().toISOString()
    }
  };

  describe("Node Operations", () => {
    it("should create and retrieve a node with metadata", async () => {
      if (!process.env.DATABASE_URL) {
        console.log("Skipping test: no database connection");
        return;
      }

      const created = await storage.createNode(testNode);
      expect(created.id).toBeDefined();
      expect(created.label).toBe(testNode.label);
      expect(created.metadata).toEqual(testNode.metadata);

      const retrieved = await storage.getNode(created.id);
      expect(retrieved).toEqual(created);
    });

    it("should retrieve all nodes with metadata", async () => {
      if (!process.env.DATABASE_URL) {
        console.log("Skipping test: no database connection");
        return;
      }

      await storage.createNode(testNode);
      await storage.createNode({ ...testNode, label: "Test Node 2" });

      const nodes = await storage.getAllNodes();
      expect(nodes).toHaveLength(2);
      expect(nodes[0].label).toBe("Test Node");
      expect(nodes[0].metadata).toEqual(testNode.metadata);
      expect(nodes[1].label).toBe("Test Node 2");
    });

    it("should handle errors when node not found", async () => {
      if (!process.env.DATABASE_URL) {
        console.log("Skipping test: no database connection");
        return;
      }

      const node = await storage.getNode(999);
      expect(node).toBeUndefined();
    });
  });

  describe("Edge Operations", () => {
    beforeEach(async () => {
      if (!process.env.DATABASE_URL) {
        return;
      }

      // Create nodes needed for edge tests
      await storage.createNode(testNode);
      await storage.createNode({ ...testNode, label: "Test Node 2" });
    });

    it("should create and retrieve an edge with metadata", async () => {
      if (!process.env.DATABASE_URL) {
        console.log("Skipping test: no database connection");
        return;
      }

      const created = await storage.createEdge(testEdge);
      expect(created.id).toBeDefined();
      expect(created.label).toBe(testEdge.label);
      expect(created.metadata).toEqual(testEdge.metadata);

      const retrieved = await storage.getEdge(created.id);
      expect(retrieved).toEqual(created);
    });

    it("should retrieve all edges with metadata", async () => {
      if (!process.env.DATABASE_URL) {
        console.log("Skipping test: no database connection");
        return;
      }

      await storage.createEdge(testEdge);
      await storage.createEdge({ ...testEdge, label: "test_connection_2" });

      const edges = await storage.getAllEdges();
      expect(edges).toHaveLength(2);
      expect(edges[0].metadata).toEqual(testEdge.metadata);
    });
  });

  describe("Graph Operations", () => {
    it("should retrieve full graph with metadata", async () => {
      if (!process.env.DATABASE_URL) {
        console.log("Skipping test: no database connection");
        return;
      }
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
      expect(graph.nodes[0].metadata).toEqual(testNode.metadata);
      expect(graph.edges[0].metadata).toEqual(testEdge.metadata);
    });
  });
});