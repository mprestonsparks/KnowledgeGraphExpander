import { pgTable, text, serial, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Node represents a vertex in the knowledge graph
export const nodes = pgTable("nodes", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  type: text("type").notNull(), // concept, entity, process, or attribute
  metadata: jsonb("metadata").$type<{
    description?: string;
    imageUrl?: string;
    imageDescription?: string;
    documentContext?: string;
    semanticContext?: {
      theme?: string;
      confidence?: number;
      reasoning?: string;
    };
  }>(),
});

// Edge represents a connection between nodes
export const edges = pgTable("edges", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").notNull(),
  targetId: integer("target_id").notNull(),
  label: text("label").notNull(),
  weight: integer("weight").notNull().default(1),
  metadata: jsonb("metadata").$type<{
    confidence?: number;
    reasoning?: string;
    validatedAt?: string;
  }>(),
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
  metadata: true,
});

export type Node = typeof nodes.$inferSelect;
export type Edge = typeof edges.$inferSelect;
export type InsertNode = z.infer<typeof insertNodeSchema>;
export type InsertEdge = z.infer<typeof insertEdgeSchema>;

// Graph analysis types
export interface GraphMetrics {
  betweenness: Record<number, number>;
  eigenvector: Record<number, number>;
  degree: Record<number, number>;
  scaleFreeness: {
    powerLawExponent: number;
    fitQuality: number;
    hubNodes: Array<{
      id: number;
      degree: number;
      influence: number;
    }>;
    bridgingNodes: Array<{
      id: number;
      communities: number;
      betweenness: number;
    }>;
  };
}

// Complete graph data structure
export interface GraphData {
  nodes: Node[];
  edges: Edge[];
  metrics: GraphMetrics;
}