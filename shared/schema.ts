import { pgTable, text, serial, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Node represents a vertex in the knowledge graph
export const nodes = pgTable("nodes", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  type: text("type").notNull(),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
});

// Edge represents a connection between nodes
export const edges = pgTable("edges", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").notNull(),
  targetId: integer("target_id").notNull(),
  label: text("label").notNull(),
  weight: integer("weight").notNull().default(1),
});

export const insertNodeSchema = createInsertSchema(nodes).pick({
  label: true,
  type: true,
  metadata: true,
});

export const insertEdgeSchema = createInsertSchema(edges).pick({
  sourceId: true,
  targetId: true,
  label: true,
  weight: true,
});

export type Node = typeof nodes.$inferSelect;
export type Edge = typeof edges.$inferSelect;
export type InsertNode = z.infer<typeof insertNodeSchema>;
export type InsertEdge = z.infer<typeof insertEdgeSchema>;

// New types for semantic clustering
export interface ClusterMetadata {
  centroidNode: string;
  semanticTheme: string;
  coherenceScore: number;
  multimodalContext?: {
    imageUrl?: string;
    imageDescription?: string;
    documentContext?: string;
  };
}

export interface ClusterResult {
  clusterId: number;
  nodes: string[];
  metadata: ClusterMetadata;
}

// Scale-free network analysis types
export interface HubNode {
  id: number;
  degree: number;
  influence: number;
}

export interface BridgingNode {
  id: number;
  communities: number;
  betweenness: number;
}

export interface ScaleFreeness {
  powerLawExponent: number;
  fitQuality: number;
  hubNodes: HubNode[];
  bridgingNodes: BridgingNode[];
}

// Relationship suggestion types
export interface RelationshipSuggestion {
  sourceId: number;
  targetId: number;
  label: string;
  confidence: number;
  explanation: string;
}

export type GraphData = {
  nodes: Node[];
  edges: Edge[];
  metrics: {
    betweenness: Record<number, number>;
    eigenvector: Record<number, number>;
    degree: Record<number, number>;
    scaleFreeness: ScaleFreeness;
  };
  clusters?: ClusterResult[];
  suggestions?: RelationshipSuggestion[];
};