// Types for the knowledge graph
export interface Node {
  id: number;
  label: string;
  type: string; // concept, entity, process, or attribute
  metadata?: {
    description?: string;
    imageUrl?: string;
    imageDescription?: string;
    documentContext?: string;
    semanticContext?: {
      theme?: string;
      confidence?: number;
      reasoning?: string;
    };
  };
}

export interface Edge {
  id: number;
  sourceId: number;
  targetId: number;
  label: string;
  weight: number;
  metadata?: {
    confidence?: number;
    reasoning?: string;
    validatedAt?: string;
  };
}

// Graph analysis types
export interface GraphMetrics {
  betweenness: Record<string, number>;
  eigenvector: Record<string, number>;
  degree: Record<string, number>;
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

// Cluster types
export interface ClusterMetadata {
  centroidNode?: string;
  semanticTheme: string;
  coherenceScore: number;
}

export interface ClusterResult {
  clusterId: number;
  nodes: string[];
  metadata: ClusterMetadata;
}

// Complete graph data structure
export interface GraphData {
  nodes: Node[];
  edges: Edge[];
  metrics?: GraphMetrics;
  clusters?: ClusterResult[];
}

// Request types
export interface ExpandGraphRequest {
  prompt: string;
  maxIterations?: number;
}

export interface ContentAnalysisRequest {
  text: string;
  images?: Array<{
    data: string;
    type: string;
  }>;
}