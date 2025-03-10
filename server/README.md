# Knowledge Graph Expander Backend

This directory contains the Python FastAPI backend implementation of the Knowledge Graph Expander system.

## Architecture

The backend implements core algorithms and features for agentic deep graph reasoning as proposed by Buehler (2025), including:

- Multi-agent collaborative reasoning system
- Temporal evolution tracking
- Feedback loop mechanism
- Advanced graph merging
- Self-organization capabilities

## Key Components

### Core Graph Management
- **graph_manager.py**: Central management of the knowledge graph with NetworkX
- **graph_evolution.py**: Implements temporal tracking and evolution analysis
- **semantic_clustering.py**: Handles clustering and community detection
- **semantic_analysis.py**: Extracts knowledge structures from content

### Multi-Agent System
- **openai_client.py**: Implements the multi-agent reasoning system
  - Explorer agent: Identifies new concepts
  - Critic agent: Evaluates quality and relevance
  - Connector agent: Creates meaningful connections
  - Integrator agent: Synthesizes the final result

### API and Routes
- **app.py**: FastAPI application entry point
- **routes/**: API endpoint definitions
  - **graph.py**: Graph manipulation endpoints
  - **suggestions.py**: Connection suggestion endpoints
  - **websocket.py**: Real-time updates via WebSocket

### Database Integration
- **database.py**: Database connection and operations
- **models/**: Pydantic and database schema definitions

## Key Features

### Multi-Agent Reasoning Pipeline

The system uses a collaborative multi-agent approach to expand the knowledge graph:

1. **Explorer** identifies potential new concepts and relationships
2. **Critic** evaluates and filters proposals based on quality
3. **Connector** identifies how new knowledge connects to existing structures
4. **Integrator** synthesizes the final knowledge representation

### Temporal Evolution Tracking

The system tracks how the graph evolves over time:

- Records node and edge creation timestamps
- Takes snapshots of the graph state
- Analyzes growth rates and pattern emergence
- Monitors hub formation and structural changes

### Feedback Loop Mechanism

Implements an iterative refinement mechanism using the R_{i+1}=f_{eval}(R_i,F_i) formula:

- Evaluates expansion quality with multiple metrics
- Generates improvement prompts based on evaluations
- Refines future expansion strategies

### Advanced Graph Merging

Intelligent merging of new knowledge with existing structures:

- Semantic similarity detection for node merging
- Conflict resolution for edge properties
- Merge history for traceability

### Self-Organization Capabilities

Enables the graph to dynamically organize itself:

- Scale-free network property emergence
- Hub and bridge node formation
- Intelligent reconnection of disconnected nodes

## API Endpoints

The backend exposes several RESTful endpoints:

- `GET /api/graph`: Get the current graph data
- `POST /api/graph/expand`: Expand graph with a prompt
- `POST /api/graph/analyze`: Analyze content to extract knowledge
- `POST /api/graph/cluster`: Recalculate semantic clusters
- `POST /api/graph/reconnect`: Reconnect disconnected nodes
- `GET /api/graph/evolution`: Get temporal evolution metrics
- `POST /api/graph/feedback`: Add user feedback

## Dependencies

- **FastAPI**: Modern, fast web framework
- **NetworkX**: Graph theory library
- **OpenAI API**: For multi-agent reasoning
- **Anthropic API**: For multimodal content analysis
- **PostgreSQL**: Persistent storage
- **Pandas/NumPy**: Data analysis for graph metrics

## Development

1. Create a virtual environment
2. Install dependencies from requirements.txt
3. Set up environment variables with API keys
4. Run the server: `uvicorn app:app --reload`