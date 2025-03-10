# Server Models

This directory contains the Pydantic models used throughout the backend of the Knowledge Graph Expander system.

## Overview

Pydantic models provide several benefits:
- Type validation for request/response data
- Automatic conversion between JSON and Python objects
- Self-documenting API with OpenAPI schema generation
- Consistent data structures across the application

## Key Models

### Graph Data Models

The core models for graph data structures:

- `Node`: Represents a graph node with label, type, and metadata
- `Edge`: Represents a relationship between nodes with label and weight
- `ClusterResult`: Represents a semantic cluster of related nodes
- `GraphData`: Complete graph data including nodes, edges, and metrics

### Analytics Models

Models for graph metrics and analytics:

- `HubNode`: Represents an influential node with high centrality
- `BridgingNode`: Represents a node connecting different communities
- `ScaleFreeness`: Measures of scale-free network properties
- `GraphMetrics`: Collection of graph analytics metrics

### Evolution Models

Models related to temporal graph evolution:

- `GraphEvolutionMetrics`: Growth rates and temporal metrics
- `HubFormationAnalysis`: Analysis of hub node formation over time
- `HubFormationResult`: Results of hub node analysis
- `GraphEvolutionData`: Complete evolution tracking data

### Request/Response Models

Models for API requests and responses:

- `ExpandGraphRequest`: Parameters for graph expansion
- `ContentAnalysisRequest`: Parameters for content analysis
- `FeedbackRequest`: User feedback for the feedback loop
- `ExpansionEvaluationResult`: Evaluation metrics for an expansion

## Usage

Models are used throughout the application:

1. **API Endpoint Validation**:
```python
@router.post("/expand", response_model=GraphData)
async def expand_graph(request: ExpandGraphRequest):
    # Input automatically validated
    # ...
```

2. **Database Operations**:
```python
async def create_node(node_data: dict) -> Optional[Dict]:
    node = Node(**node_data)  # Validation happens here
    # ...
```

3. **Response Formatting**:
```python
# Response automatically formatted according to model
return GraphData(nodes=nodes, edges=edges, metrics=metrics)
```

## Core File: `schemas.py`

The `schemas.py` file contains all the Pydantic models used in the application. These models match the TypeScript interfaces defined in the `/shared` directory, ensuring type consistency across the stack.

## Example Model

```python
class Node(BaseModel):
    id: int
    label: str
    type: str
    metadata: Optional[Dict[str, Any]] = {}
```

## Extending Models

When adding new models:

1. Define the Pydantic model in `schemas.py`
2. Update corresponding TypeScript interfaces if needed
3. Use the model for request/response validation in API routes