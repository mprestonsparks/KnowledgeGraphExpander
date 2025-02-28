from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any

class Node(BaseModel):
    id: int
    label: str
    type: str
    metadata: Optional[Dict[str, Any]] = {}

class Edge(BaseModel):
    id: Optional[int] = None
    sourceId: int
    targetId: int
    label: str = "related_to"
    weight: float = 1.0
    metadata: Optional[Dict[str, Any]] = {}

class ClusterMetadata(BaseModel):
    centroidNode: Optional[str] = None
    semanticTheme: str
    coherenceScore: float

class ClusterResult(BaseModel):
    clusterId: int
    nodes: List[str]
    metadata: ClusterMetadata

class ScaleFreeness(BaseModel):
    powerLawExponent: float
    fitQuality: float
    hubNodes: List[Dict[str, Any]]
    bridgingNodes: List[Dict[str, Any]]

class GraphMetrics(BaseModel):
    betweenness: Dict[str, float]
    eigenvector: Dict[str, float]
    degree: Dict[str, int]
    scaleFreeness: ScaleFreeness

class GraphData(BaseModel):
    nodes: List[Node]
    edges: List[Edge]
    metrics: Optional[GraphMetrics] = None
    clusters: Optional[List[ClusterResult]] = None

class GraphExpansionResult(BaseModel):
    nodes: List[Node]
    edges: List[Edge]
    reasoning: Optional[str] = None
    nextQuestion: Optional[str] = None

class ExpandGraphRequest(BaseModel):
    prompt: str
    maxIterations: int = 10

class ContentAnalysisRequest(BaseModel):
    text: str
    images: Optional[List[Dict[str, str]]] = None

class RelationshipSuggestion(BaseModel):
    sourceId: int
    targetId: int
    label: str
    confidence: float
    explanation: str

class ApplySuggestionRequest(BaseModel):
    sourceId: int
    targetId: int
    label: str
    weight: int = 1