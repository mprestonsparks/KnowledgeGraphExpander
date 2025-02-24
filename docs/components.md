# Frontend Components

## Graph Visualization Components

### GraphViewer
The main component for rendering the knowledge graph visualization.

#### Props
```typescript
interface GraphViewerProps {
  data: GraphData & { clusters?: ClusterResult[] };
}
```

#### Usage
```tsx
import { GraphViewer } from '@/components/graph/GraphViewer';

function GraphPage() {
  const { data } = useQuery({ queryKey: ['/api/graph'] });
  return <GraphViewer data={data} />;
}
```

#### Features
- Interactive graph visualization
- Semantic cluster coloring
- Node and edge styling
- Automatic layout
- Zoom and pan controls

### ControlPanel
Control panel for graph operations.

#### Features
- Graph expansion input
- Cluster recalculation
- Node reconnection
- Real-time feedback

#### Usage
```tsx
import { ControlPanel } from '@/components/graph/ControlPanel';

function GraphControls() {
  return <ControlPanel />;
}
```

## Styling System

### Theme Configuration
The application uses a custom theme system built on top of Tailwind CSS:

```json
{
  "primary": "#4f46e5",
  "variant": "professional",
  "appearance": "system",
  "radius": 0.5
}
```

### Component Styles
- Uses CSS-in-JS with `tailwind-merge`
- Responsive design patterns
- Consistent styling across components

## State Management

### Query Hooks
```typescript
// Graph queries
const { data: graphData } = useQuery({
  queryKey: ['/api/graph'],
  queryFn: getQueryFn()
});

// Mutations
const expandMutation = useMutation({
  mutationFn: expandGraph,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/graph'] });
  }
});
```

## WebSocket Integration
- Real-time graph updates
- Cluster state synchronization
- Connection management

## Performance Optimizations
- Efficient rendering with React.memo
- Debounced user inputs
- Optimized graph layouts
- Lazy loading for large datasets
