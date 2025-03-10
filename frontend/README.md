# Knowledge Graph Expander Frontend

This directory contains the React/TypeScript frontend application for the Knowledge Graph Expander system.

## Overview

The frontend provides an interactive visualization and interface for the knowledge graph, featuring:

- Interactive graph visualization with Cytoscape.js
- Real-time updates via WebSockets
- Analytics dashboard for graph metrics
- Content analysis submission tools
- Expansion controls and feedback mechanisms

## Key Components

### Visualization
- **GraphViewer**: Core visualization component using Cytoscape.js
- **ControlPanel**: Controls for graph manipulation and visualization settings
- **MetricsPanel**: Displays metrics and analytics
- **SuggestionsPanel**: Shows AI-generated relationship suggestions

### User Input
- **SemanticAnalysisForm**: For submitting text and images for analysis
- **ExpansionControls**: Interface for expanding the graph with prompts

### State Management
- **React Query**: For API data fetching and caching
- **WebSocket**: Real-time communication with the backend

### UI Components
- **Shadcn UI**: Core UI components
- **React Router**: Navigation
- **TailwindCSS**: Styling

## Directory Structure

```
/frontend
├── public/              # Static assets
├── src/
│   ├── components/      # React components
│   │   ├── graph/       # Graph visualization components
│   │   └── ui/          # Reusable UI components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility libraries
│   ├── pages/           # Page components
│   └── types/           # TypeScript type definitions
├── index.html           # HTML entry point
└── package.json         # Dependencies and scripts
```

## Key Features

### Interactive Graph Visualization

- Force-directed layout for intuitive exploration
- Zoom, pan, and node selection
- Visual clustering with color coding
- Highlight connections and related nodes
- Node and edge details on hover/click

### Real-time Updates

- WebSocket connection for live graph updates
- Animated transitions for new nodes and edges
- Progress indicators for long-running processes

### Analytics Dashboard

- Centrality metrics visualization
- Hub and bridge node identification
- Temporal evolution charts
- Scale-free property analysis

### Content Analysis

- Text input for knowledge extraction
- Image upload for multimodal analysis (integrates with Claude API)
- Structured data visualization
- Extraction preview and confirmation

### Expansion Controls

- Prompt-based graph expansion
- Feedback mechanisms for refinement
- History of expansion attempts
- Recommendations for further exploration

## Development

### Prerequisites

- Node.js 16+
- npm or yarn

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

### API Integration

The frontend communicates with the backend via:

- RESTful API calls for most operations
- WebSocket connection for real-time updates

### Testing

Run tests with:
```bash
npm test
```

Component tests are located in `src/components/__tests__/`