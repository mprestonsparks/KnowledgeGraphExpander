import { type Node, type Edge, type InsertNode, type InsertEdge, type GraphData } from "@shared/schema";

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

export class MemStorage implements IStorage {
  private nodes: Map<number, Node>;
  private edges: Map<number, Edge>;
  private nodeId: number;
  private edgeId: number;

  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
    this.nodeId = 1;
    this.edgeId = 1;
  }

  async getNode(id: number): Promise<Node | undefined> {
    return this.nodes.get(id);
  }

  async getAllNodes(): Promise<Node[]> {
    return Array.from(this.nodes.values());
  }

  async createNode(insertNode: InsertNode): Promise<Node> {
    const id = this.nodeId++;
    const node: Node = { 
      id, 
      ...insertNode,
      metadata: insertNode.metadata || null
    };
    this.nodes.set(id, node);
    return node;
  }

  async getEdge(id: number): Promise<Edge | undefined> {
    return this.edges.get(id);
  }

  async getAllEdges(): Promise<Edge[]> {
    return Array.from(this.edges.values());
  }

  async createEdge(insertEdge: InsertEdge): Promise<Edge> {
    const id = this.edgeId++;
    const edge: Edge = { 
      id, 
      ...insertEdge,
      weight: insertEdge.weight || 1
    };
    this.edges.set(id, edge);
    return edge;
  }

  async getFullGraph(): Promise<GraphData> {
    return {
      nodes: await this.getAllNodes(),
      edges: await this.getAllEdges(),
      metrics: {
        betweenness: {},
        eigenvector: {},
        degree: {},
      }
    };
  }
}

export const storage = new MemStorage();