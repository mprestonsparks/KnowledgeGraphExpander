from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
from datetime import datetime

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

class HubNode(BaseModel):
    id: int
    degree: int
    influence: float

class BridgingNode(BaseModel):
    id: int
    communities: int
    betweenness: float

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
    hubNodes: List[HubNode]
    bridgingNodes: List[BridgingNode]

class GraphEvolutionMetrics(BaseModel):
    node_growth_rate: Optional[float] = None
    edge_growth_rate: Optional[float] = None
    node_power_law_exponent: Optional[float] = None
    edge_power_law_exponent: Optional[float] = None
    enough_data: bool = False
    hours_tracked: Optional[float] = None
    snapshots_count: Optional[int] = None

class HubFormationAnalysis(BaseModel):
    node_id: str
    degree: int
    label: str
    type: str
    created_at: Optional[str] = None
    connections_count: int
    connection_sample: List[Dict[str, Any]]

class HubFormationResult(BaseModel):
    top_hubs: List[HubFormationAnalysis]
    analysis_time: str

class GraphEvolutionData(BaseModel):
    growth: GraphEvolutionMetrics
    hubFormation: HubFormationResult
    recentSnapshots: List[Dict[str, Any]]
    totalSnapshots: int

class GraphMetrics(BaseModel):
    betweenness: Dict[str, float]
    eigenvector: Dict[str, float]
    degree: Dict[str, int]
    scaleFreeness: ScaleFreeness
    evolution: Optional[GraphEvolutionMetrics] = None
    hubFormation: Optional[HubFormationResult] = None

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
    weight: float = 1.0

class FeedbackRequest(BaseModel):
    type: str
    data: Dict[str, Any]
    
class ExpansionEvaluationResult(BaseModel):
    timestamp: str
    nodes_added: int
    edges_added: int
    edges_per_new_node: float
    density_change: float
    node_type_diversity: int
    edge_label_diversity: int
    iteration: int