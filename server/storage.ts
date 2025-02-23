import { drizzle } from "drizzle-orm/neon-serverless";
import { neon } from "@neondatabase/serverless";
import { type Node, type Edge, type InsertNode, type InsertEdge, type GraphData, nodes, edges } from "@shared/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

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
    const result = await db.select().from(nodes).where({ id }).limit(1);
    return result[0];
  }

  async getAllNodes(): Promise<Node[]> {
    return db.select().from(nodes);
  }

  async createNode(insertNode: InsertNode): Promise<Node> {
    const result = await db.insert(nodes).values(insertNode).returning();
    return result[0];
  }

  async getEdge(id: number): Promise<Edge | undefined> {
    const result = await db.select().from(edges).where({ id }).limit(1);
    return result[0];
  }

  async getAllEdges(): Promise<Edge[]> {
    return db.select().from(edges);
  }

  async createEdge(insertEdge: InsertEdge): Promise<Edge> {
    const result = await db.insert(edges).values(insertEdge).returning();
    return result[0];
  }

  async getFullGraph(): Promise<GraphData> {
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
  }
}

export const storage = new PostgresStorage();