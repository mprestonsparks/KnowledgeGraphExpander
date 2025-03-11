# Agentic Deep Graph Reasoning Knowledge Network

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- OpenAI API key (or Anthropic API key)

### Installation & Running

1. **Clone and run with one command:**
   ```bash
   git clone https://github.com/mprestonsparks/KnowledgeGraphExpander.git
   cd KnowledgeGraphExpander
   ./run.sh
   ```

2. **Access the application:**
   - Knowledge Explorer UI: http://localhost:8000/explorer
   - API Documentation: http://localhost:8000/api/docs

3. **Configure API keys** through the Settings tab in the Knowledge Explorer UI

4. **Stop the application** when finished:
   ```bash
   ./stop.sh
   ```

For more options:
```bash
./run.sh --help
```

## 🌟 Overview
A self-organizing knowledge graph system that implements Buehler's (2025) agentic deep graph reasoning architecture. The system builds dynamic, evolving knowledge graphs using multi-agent collaborative reasoning, temporal evolution tracking, and advanced self-organization capabilities as described in the original research.

## 🧠 Key Features

### Multi-Agent Collaborative Reasoning
- **Explorer Agent**: Identifies new concepts and relationships
- **Critic Agent**: Evaluates quality and relevance of proposals
- **Connector Agent**: Creates meaningful connections between concepts
- **Integrator Agent**: Synthesizes final knowledge structures

### Self-Organizing Knowledge Structure
- Automatic emergence of scale-free properties
- Hierarchical clustering with modularity detection
- Hub and bridge node formation without predefined ontologies
- Continuous growth without saturation

### Temporal Evolution Tracking
- Monitors graph growth over time
- Tracks hub formation and evolution
- Records historical snapshots for analysis
- Analyzes power law exponents and other network metrics

### Advanced Graph Merging
- Semantic similarity detection for node merging
- Conflict resolution for edge properties
- Maintains merge history for traceability
- Intelligent reconnection of disconnected nodes

### Feedback Loop Mechanism
- Implements Buehler's (2025) R_{i+1}=f_{eval}(R_i,F_i) formula
- Evaluates expansion quality with multiple metrics
- Generates improvement prompts based on evaluations
- Refines expansion strategies over time

## 📊 System Architecture

### Frontend (React + TypeScript)
- Interactive graph visualization with D3.js
- Real-time updates via WebSockets
- Analytics dashboard for metrics
- Content analysis input tools
- In-browser API key configuration

### Backend (Python + FastAPI)
- Graph management and analysis (NetworkX)
- Semantic clustering with advanced algorithms
- Multi-agent reasoning system
- PostgreSQL for persistent storage

### AI Integration
- OpenAI API for semantic analysis and reasoning
- Claude API for multimodal content analysis
- Structured reasoning with thinking state extraction
- Knowledge extraction pipeline

## 🚀 Getting Started

### Prerequisites
- Docker and Docker Compose
- OpenAI API key
- Anthropic API key (optional, for multimodal analysis)

### Quick Start with Docker

1. Clone the repository
   ```bash
   git clone https://github.com/mprestonsparks/KnowledgeGraphExpander.git
   cd KnowledgeGraphExpander
   ```

2. Set up environment variables
   - Create a `.env` file in the root directory or use the provided `.env.example`:
   ```bash
   cp .env.example .env
   ```
   - Edit the `.env` file to add your API keys

3. Run the application
   ```bash
   ./run.sh
   ```
   
   This script will:
   - Check for Docker and Docker Compose
   - Build the Docker images (if needed)
   - Start the application containers
   - Automatically find an available port (default: 8000)
   - The application will be available at http://localhost:[PORT]
   
   Note: If the default port is in use, the script will automatically find the next available port.
   
   Once the application is running, you can access:
   
   - **Knowledge Graph Explorer**: http://localhost:[PORT]/explorer
     (A user-friendly interface for working with the knowledge graph)
   
   - **API Documentation**: http://localhost:[PORT]/api/docs
     (Interactive Swagger UI for testing the API directly)

### Command-line Options

The `run.sh` script supports several options:

```bash
./run.sh [options]

Options:
  --persist-db    Persist database data between runs
  --build         Force rebuild of Docker images
  --dev           Run in development mode with hot reloading
  --port=PORT     Specify custom port (default: 8000)
  --help          Show this help message
```

To stop the application:

```bash
./stop.sh

Options:
  --clean    Remove all data (including database volume)
  --force    Force removal of containers even if they're running
  --help     Show this help message
```

### Manual Docker Commands

If you prefer to use Docker commands directly:

1. Build the Docker images:
   ```bash
   docker-compose build
   ```

2. Start the services:
   ```bash
   docker-compose up -d
   ```

3. Stop the services:
   ```bash
   docker-compose down
   ```
   
4. Remove all data:
   ```bash
   docker-compose down -v
   ```

## Advanced Usage

### Development Mode

For local development with hot reloading:

```bash
./run.sh --dev
```

This mounts your local code directories into the container for live code changes.

### Database Persistence

To persist the database data between container restarts:

```bash
./run.sh --persist-db
```

## 📚 Documentation

For more detailed documentation:
- [Architecture Overview](docs/architecture.md)
- [API Reference](docs/api-reference.md)
- [Component Details](docs/components.md)
- [Setup Guide](docs/setup.md)
- [Troubleshooting](docs/troubleshooting.md)
- [User Guide](docs/user-guide.md)

## 🧪 Directory Structure

- **`/server`**: Python backend with FastAPI
  - `/models`: Database schema definitions
  - `/routes`: API endpoints
  - `/utils`: Utility functions
- **`/frontend`**: React frontend application
  - `/src/components`: React components
  - `/src/hooks`: Custom React hooks
  - `/src/lib`: Frontend utility libraries
- **`/docs`**: Project documentation
- **`/tests`**: Test suite
- **`/shared`**: Shared type definitions

## 📊 Research Implementation

This project implements the key algorithms and architecture from Buehler's research on agentic deep graph reasoning and self-organizing knowledge networks (Buehler, 2025).

The implementation focuses on the recursive expansion framework, emergent properties of scale-free networks, and the combination of multiple specialized agents for knowledge discovery as described in Buehler's work.

## 🤝 Contributing
Contributions are welcome! Please see our [contributing guidelines](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License:

```
MIT License

Copyright (c) 2025 M. Preston Sparks

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

See the [LICENSE](LICENSE) file for details.

## 👥 Author
M. Preston Sparks ([@mprestonsparks](https://github.com/mprestonsparks))

## 🙏 Acknowledgments
- Built using advanced graph theory principles
- Implements research from Buehler (2025) on agentic deep graph reasoning
- Powered by state-of-the-art language models

## 📚 Citation

This project implements the theoretical framework described in:

```
Buehler, J. (2025). Agentic Deep Graph Reasoning Yields Self-Organizing Knowledge Networks. 
arXiv:2502.14958 [cs.AI]
```