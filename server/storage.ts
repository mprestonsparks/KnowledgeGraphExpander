import { drizzle } from "drizzle-orm/neon-serverless";
import { neon, neonConfig } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { type Node, type Edge, type InsertNode, type InsertEdge, type GraphData, nodes, edges } from "@shared/schema";
import { WebSocket } from "ws";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Configure neon to use WebSocket for better performance
neonConfig.webSocketConstructor = WebSocket;
// Initialize neon client with proper configuration
const sql = neon(process.env.DATABASE_URL!);

// Initialize drizzle with the neon client
const db = drizzle(sql);

// Test database connection
async function testConnection() {
  try {
    const result = await sql`SELECT 1`;
    console.log('Database connection successful:', result);
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}

// Initialize connection
testConnection().catch(console.error);

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
export { db, sql }; // Export for testing