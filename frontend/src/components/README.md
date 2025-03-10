# Frontend Components

This directory contains the React components for the Knowledge Graph Expander system's frontend.

## Overview

The components are organized by functionality and follow a modular design approach. Key features include:

- Interactive graph visualization with Cytoscape.js
- Analytics and metrics display panels
- Content analysis submission forms
- Real-time updates with WebSocket integration
- Responsive design with Tailwind CSS

## Directory Structure

```
/components
├── GraphVisualizer.tsx            # Main graph visualization wrapper
├── SemanticAnalysisForm.tsx       # Content analysis submission form
├── graph/                         # Graph visualization components
│   ├── ControlPanel.tsx           # Graph manipulation controls
│   ├── GraphViewer.tsx            # Core Cytoscape visualization
│   ├── MetricsPanel.tsx           # Analytics and metrics display
│   └── SuggestionsPanel.tsx       # AI-generated suggestions panel
├── ui/                            # Reusable UI components
│   ├── button.tsx                 # Button component
│   ├── card.tsx                   # Card component
│   ├── dialog.tsx                 # Dialog/modal component
│   └── ...                        # Other UI components
└── __tests__/                     # Component tests
```

## Key Components

### Graph Visualization

#### `GraphViewer.tsx`

The core graph visualization component built on Cytoscape.js:

- Force-directed layout for intuitive graph exploration
- Pan, zoom, and selection capabilities
- Visual styling for nodes and edges based on data
- Animation for graph changes and updates
- Event handling for user interactions

#### `ControlPanel.tsx`

Controls for manipulating the graph view:

- Layout selection options
- Filtering capabilities
- Zoom controls
- Node search functionality
- Display mode toggles

#### `MetricsPanel.tsx`

Displays graph analytics and metrics:

- Centrality measures
- Hub and bridge node identification
- Cluster analysis
- Scale-free property metrics
- Temporal evolution statistics

#### `SuggestionsPanel.tsx`

Shows AI-generated relationship suggestions:

- Suggested new connections
- Confidence scores
- Apply/reject options
- Explanations for suggestions

### Content Analysis

#### `SemanticAnalysisForm.tsx`

Form for submitting content for analysis:

- Text input for processing
- Image upload for multimodal analysis
- Analysis options configuration
- Submission and reset controls

## UI Components

The `/ui` directory contains reusable UI components built with Shadcn UI and Tailwind CSS:

- Form controls
- Layout components
- Feedback elements
- Navigation components
- Modal dialogs

## Component Design Principles

The components follow these design principles:

1. **Modularity**: Components have clear, focused responsibilities
2. **Composability**: Components can be combined in various ways
3. **Reusability**: Common patterns are extracted into reusable components
4. **Accessibility**: Components meet WCAG standards
5. **Testability**: Components are designed for easy testing

## State Management

Components manage state using:

- React Query for server state
- React Context for shared application state
- Component state for local UI state
- Custom hooks for reusable state logic

## Adding New Components

When adding new components:

1. Determine the appropriate location based on functionality
2. Create a properly typed TypeScript component
3. Use existing UI components when possible
4. Add appropriate documentation
5. Include tests in the `__tests__` directory

## Testing

Components are tested using React Testing Library:

- Unit tests for individual behavior
- Integration tests for component interactions
- Snapshot tests for UI consistency

Run tests with:
```bash
npm test
```