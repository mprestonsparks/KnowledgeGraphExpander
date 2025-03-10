# Shared Types and Utilities

This directory contains shared TypeScript type definitions and utilities used by both the frontend and backend of the Knowledge Graph Expander system.

## Overview

Shared types ensure consistency between the frontend and backend, reducing type errors and improving developer experience. The shared directory includes:

- TypeScript interfaces for data structures
- Shared constants and configuration
- Common utility functions

## Key Files

### `schema.ts`

Contains TypeScript interfaces for data structures used throughout the application:

- `Node`: Graph node structure with properties
- `Edge`: Graph edge structure with relationship data
- `GraphData`: Complete graph data structure
- `ClusterResult`: Semantic clustering results
- `GraphMetrics`: Analytics and metrics data structures
- `EvolutionMetrics`: Temporal evolution tracking metrics

### Usage in Frontend

```typescript
import { Node, Edge, GraphData } from '../shared/schema';

// Type-safe graph data
const processGraphData = (data: GraphData) => {
  const nodes: Node[] = data.nodes;
  const edges: Edge[] = data.edges;
  // ...
};
```

### Usage in Backend

The backend uses Pydantic models that match these TypeScript interfaces, ensuring type consistency across the stack.

## Benefits

1. **Type Safety**: Consistent types between frontend and backend
2. **Reduced Duplication**: Define types once, use everywhere
3. **Single Source of Truth**: One canonical definition for shared structures
4. **API Consistency**: Ensures API requests and responses match expected formats

## Adding New Shared Types

When adding new shared types:

1. Define the TypeScript interface in the appropriate file
2. Ensure the backend Pydantic models match the new types
3. Update any affected API endpoints or components

## Directory Structure

```
/shared
├── schema.ts        # Data structure definitions
└── README.md        # This documentation file
```

## Notes

- Keep this directory minimal and focused on truly shared types
- Avoid putting business logic in shared files
- Backend will use Pydantic models that match these TypeScript interfaces