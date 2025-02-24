# API Reference

## Endpoints

### Graph Operations

#### GET /api/graph
Retrieves the current state of the knowledge graph.

**Response**
```typescript
{
  nodes: Node[];
  edges: Edge[];
  metrics: {
    betweenness: Record<number, number>;
    eigenvector: Record<number, number>;
    degree: Record<number, number>;
  };
  clusters: ClusterResult[];
}
```

#### POST /api/graph/expand
Expands the graph based on a provided prompt.

**Request Body**
```typescript
{
  prompt: string;
}
```

**Response**: Same as GET /api/graph

#### POST /api/graph/cluster
Recalculates semantic clusters for the current graph.

**Response**: Same as GET /api/graph

#### POST /api/graph/reconnect
Attempts to reconnect disconnected nodes.

**Response**: Same as GET /api/graph

### WebSocket API

#### Connection
```javascript
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = `${protocol}//${window.location.host}/ws`;
const socket = new WebSocket(wsUrl);
```

#### Message Types
1. **Graph Update**
   ```typescript
   {
     type: 'graph_update';
     data: GraphData;
   }
   ```

2. **Cluster Update**
   ```typescript
   {
     type: 'cluster_update';
     data: ClusterResult[];
   }
   ```

## Error Handling
All API endpoints return standard HTTP status codes:
- 200: Success
- 400: Bad Request
- 401: Unauthorized
- 500: Server Error

Error responses include a message field:
```json
{
  "error": "Error description"
}
```

## Rate Limiting
- 100 requests per minute per IP
- WebSocket connections limited to 1 per client

## Examples

### Expanding the Graph
```typescript
const response = await fetch('/api/graph/expand', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    prompt: 'Expand knowledge about artificial intelligence'
  })
});

const updatedGraph = await response.json();
```

### WebSocket Usage
```typescript
socket.onmessage = (event) => {
  const update = JSON.parse(event.data);
  if (update.type === 'graph_update') {
    updateGraphVisualization(update.data);
  }
};
```
