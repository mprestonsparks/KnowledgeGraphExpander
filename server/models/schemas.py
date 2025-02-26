    from pydantic import BaseModel, Field
    from typing import Dict, List, Optional, Any, Union

    class Node(BaseModel):
        id: int
        label: str
        type: str
        metadata: Optional[Dict[str, Any]] = {}

    class InsertNode(BaseModel):
        id: Optional[int] = None
        label: str
        type: str = "concept"
        metadata: Optional[Dict[str, Any]] = {}

    class Edge(BaseModel):
        id: Optional[int] = None
        sourceId: int
        targetId: int
        label: str = "related_to"
        weight: int = 1
        metadata: Optional[Dict[str, Any]] = {}

    class InsertEdge(BaseModel):
        id: Optional[int] = None
        sourceId: int
        targetId: int
        label: str = "related_to"
        weight: int = 1
        metadata: Optional[Dict[str, Any]] = {}

    class HubNode(BaseModel):
        id: int
        degree: int
        influence: float

    class BridgingNode(BaseModel):
        id: int
        communities: int
        betweenness: float

    class ScaleFreeness(BaseModel):
        powerLawExponent: float
        fitQuality: float
        hubNodes: List[HubNode]
        bridgingNodes: List[BridgingNode]

    class GraphMetrics(BaseModel):
        betweenness: Dict[int, float]
        eigenvector: Dict[int, float]
        degree: Dict[int, int]
        scaleFreeness: ScaleFreeness

    class ClusterMetadata(BaseModel):
        centroidNode: Optional[str] = None
        semanticTheme: str
        coherenceScore: float

    class ClusterResult(BaseModel):
        clusterId: int
        nodes: List[str]
        metadata: ClusterMetadata

    class GraphData(BaseModel):
        nodes: List[Node]
        edges: List[Edge]
        metrics: Optional[GraphMetrics] = None
        clusters: Optional[List[ClusterResult]] = None

    class GraphExpansionResult(BaseModel):
        nodes: List[InsertNode]
        edges: List[InsertEdge]
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