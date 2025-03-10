# API Routes

This directory contains the FastAPI route definitions for the Knowledge Graph Expander system.

## Overview

The routes are organized by functional area and provide RESTful API endpoints for interacting with the graph system. Each route file groups related endpoints together, making the API structure intuitive and maintainable.

## Route Files

### `graph.py`

Core graph manipulation endpoints:

- `GET /api/graph`: Retrieve the complete graph data with metrics and clustering
- `POST /api/graph/expand`: Expand the graph using the multi-agent reasoning system
- `POST /api/graph/analyze`: Analyze content to extract knowledge graph elements
- `POST /api/graph/cluster`: Recalculate semantic clusters
- `POST /api/graph/reconnect`: Reconnect disconnected nodes with intelligent linking
- `GET /api/graph/evolution`: Get metrics about graph evolution over time
- `POST /api/graph/feedback`: Submit feedback for the feedback loop mechanism

### `suggestions.py`

Endpoints for relationship suggestions:

- `GET /api/suggestions`: Get AI-generated relationship suggestions
- `POST /api/suggestions/apply`: Apply a suggested relationship

### `websocket.py`

WebSocket endpoint for real-time updates:

- `WebSocket /api/ws`: Establishes a WebSocket connection for real-time graph updates

## API Implementation

Each route follows a consistent pattern:

1. **Route definition** with appropriate HTTP method and path
2. **Pydantic model validation** for request data
3. **Service layer interaction** with the graph manager
4. **Response formatting** with appropriate status codes
5. **Error handling** with descriptive error messages

## Example Route Implementation

```python
@router.post("/expand", response_model=GraphData)
async def expand_graph(request: ExpandGraphRequest):
    """Expand the graph based on a prompt"""
    try:
        logger.info(f"Received graph expansion request with prompt: {request.prompt}")
        data = await graph_manager.expand(request.prompt, request.maxIterations)
        logger.info(f"Graph expanded successfully: {len(data.get('nodes', []))} nodes, {len(data.get('edges', []))} edges")
        return data
    except Exception as e:
        logger.error(f"Error expanding graph: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={"message": "Failed to expand graph", "error": str(e)}
        )
```

## Middleware and Dependencies

The routes use FastAPI's dependency injection system for common operations:

- Authentication (when implemented)
- Request validation
- Cross-origin resource sharing (CORS)
- Logging

## Error Handling

Errors are handled consistently across all routes:

- Input validation errors return 400 status codes
- Internal errors return 500 status codes
- Not found conditions return 404 status codes
- All error responses include a descriptive message

## API Documentation

FastAPI automatically generates OpenAPI documentation for all routes.

- Swagger UI: `/docs`
- ReDoc: `/redoc`

The API documentation includes:
- Endpoint descriptions
- Request/response schemas
- Example requests
- Authentication requirements

## Adding New Routes

When adding new routes:

1. Determine if the endpoint fits in an existing route file or needs a new one
2. Define appropriate request/response models in `/models/schemas.py`
3. Implement the route with proper validation and error handling
4. Add the router to `app.py` if it's a new route file
5. Test the endpoint thoroughly