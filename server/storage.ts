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
      console.log('[DEBUG] Getting node:', id);
      const result = await db.select().from(nodes).where(eq(nodes.id, id)).limit(1);
      console.log('[DEBUG] Node result:', result[0]);
      return result[0];
    } catch (error) {
      console.error('[DEBUG] Error fetching node:', error);
      throw new Error(`Failed to fetch node with id ${id}`);
    }
  }

  async getAllNodes(): Promise<Node[]> {
    try {
      console.log('[DEBUG] Getting all nodes');
      const result = await db.select().from(nodes);
      console.log('[DEBUG] Found nodes:', result.length);
      return result;
    } catch (error) {
      console.error('[DEBUG] Error fetching all nodes:', error);
      throw new Error('Failed to fetch all nodes');
    }
  }

  async createNode(insertNode: InsertNode): Promise<Node> {
    try {
      console.log('[DEBUG] Creating node:', insertNode);
      const result = await db.insert(nodes).values(insertNode).returning();
      console.log('[DEBUG] Created node:', result[0]);
      return result[0];
    } catch (error) {
      console.error('[DEBUG] Error creating node:', error);
      throw new Error('Failed to create node');
    }
  }

  async getEdge(id: number): Promise<Edge | undefined> {
    try {
      console.log('[DEBUG] Getting edge:', id);
      const result = await db.select().from(edges).where(eq(edges.id, id)).limit(1);
      console.log('[DEBUG] Edge result:', result[0]);
      return result[0];
    } catch (error) {
      console.error('[DEBUG] Error fetching edge:', error);
      throw new Error(`Failed to fetch edge with id ${id}`);
    }
  }

  async getAllEdges(): Promise<Edge[]> {
    try {
      console.log('[DEBUG] Getting all edges');
      const result = await db.select().from(edges);
      console.log('[DEBUG] Found edges:', result.length);
      return result;
    } catch (error) {
      console.error('[DEBUG] Error fetching all edges:', error);
      throw new Error('Failed to fetch all edges');
    }
  }

  async createEdge(insertEdge: InsertEdge): Promise<Edge> {
    try {
      console.log('[DEBUG] Creating edge:', insertEdge);
      // Verify nodes exist before creating edge
      const sourceNode = await this.getNode(insertEdge.sourceId);
      const targetNode = await this.getNode(insertEdge.targetId);

      if (!sourceNode || !targetNode) {
        throw new Error(`Invalid edge: source node ${insertEdge.sourceId} or target node ${insertEdge.targetId} does not exist`);
      }

      const result = await db.insert(edges).values(insertEdge).returning();
      console.log('[DEBUG] Created edge:', result[0]);
      return result[0];
    } catch (error) {
      console.error('[DEBUG] Error creating edge:', error);
      throw new Error('Failed to create edge');
    }
  }

  async getFullGraph(): Promise<GraphData> {
    try {
      console.log('[DEBUG] Getting full graph');
      const [graphNodes, graphEdges] = await Promise.all([
        this.getAllNodes(),
        this.getAllEdges()
      ]);

      console.log('[DEBUG] Full graph:', {
        nodes: graphNodes.length,
        edges: graphEdges.length
      });

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
      console.error('[DEBUG] Error fetching full graph:', error);
      throw new Error('Failed to fetch full graph');
    }
  }
}

export const storage = new PostgresStorage();