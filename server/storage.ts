import { drizzle } from "drizzle-orm/neon-serverless";
import { eq } from "drizzle-orm";
import { type Node, type Edge, type InsertNode, type InsertEdge, type GraphData, nodes, edges } from "@shared/schema";
import { db } from "./db";

export interface IStorage {
  // Node operations
  getNode(id: number): Promise<Node | undefined>;
  getAllNodes(): Promise<Node[]>;
  createNode(node: InsertNode): Promise<Node>;

  // Edge operations
  getEdge(id: number): Promise<Edge | undefined>;
  getAllEdges(): Promise<Edge[]>;
  createEdge(edge: InsertEdge): Promise<Edge>;

  // Graph operations
  getFullGraph(): Promise<GraphData>;
}

class PostgresStorage implements IStorage {
  async getNode(id: number): Promise<Node | undefined> {
    try {
      const result = await db.select().from(nodes).where(eq(nodes.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error('Error fetching node:', error);
      throw new Error(`Failed to fetch node with id ${id}`);
    }
  }

  async getAllNodes(): Promise<Node[]> {
    try {
      return await db.select().from(nodes);
    } catch (error) {
      console.error('Error fetching all nodes:', error);
      throw new Error('Failed to fetch all nodes');
    }
  }

  async createNode(insertNode: InsertNode): Promise<Node> {
    try {
      const result = await db.insert(nodes).values(insertNode).returning();
      return result[0];
    } catch (error) {
      console.error('Error creating node:', error);
      throw new Error('Failed to create node');
    }
  }

  async getEdge(id: number): Promise<Edge | undefined> {
    try {
      const result = await db.select().from(edges).where(eq(edges.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error('Error fetching edge:', error);
      throw new Error(`Failed to fetch edge with id ${id}`);
    }
  }

  async getAllEdges(): Promise<Edge[]> {
    try {
      return await db.select().from(edges);
    } catch (error) {
      console.error('Error fetching all edges:', error);
      throw new Error('Failed to fetch all edges');
    }
  }

  async createEdge(insertEdge: InsertEdge): Promise<Edge> {
    try {
      const result = await db.insert(edges).values(insertEdge).returning();
      return result[0];
    } catch (error) {
      console.error('Error creating edge:', error);
      throw new Error('Failed to create edge');
    }
  }

  async getFullGraph(): Promise<GraphData> {
    try {
      const [graphNodes, graphEdges] = await Promise.all([
        this.getAllNodes(),
        this.getAllEdges()
      ]);

      return {
        nodes: graphNodes,
        edges: graphEdges,
        metrics: {
          betweenness: {},
          eigenvector: {},
          degree: {},
        }
      };
    } catch (error) {
      console.error('Error fetching full graph:', error);
      throw new Error('Failed to fetch full graph');
    }
  }
}

export const storage = new PostgresStorage();