# Setup Guide

## Prerequisites
- Docker and Docker Compose
- OpenAI API key for semantic analysis
- Anthropic API key (optional, for multimodal analysis)

## Environment Variables
Create a `.env` file in the root directory with the following variables:

```env
# API Keys (at least one is required)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Database Configuration (not needed with Docker setup)
# DATABASE_URL is automatically configured in docker-compose.yml

# Server Configuration
PORT=8000  # FastAPI's conventional development port
```

## Docker Installation (Recommended)

1. **Clone the Repository**
```bash
git clone <repository-url>
cd knowledge-graph-expander
```

2. **Quick Start**
```bash
./run.sh
```

This single command will:
- Set up the Docker environment
- Initialize the database
- Build the frontend
- Start the backend server
- Automatically find an available port (default: 8080)
- Make the application available at http://localhost:[PORT]

Note: If port 8080 is in use, the script will automatically find the next available port.

### Knowledge Explorer Interface

The application includes a user-friendly web interface for exploring and managing the knowledge graph:

- **URL**: http://localhost:[PORT]/explorer
- **Features**:
  - Text analysis for automatic node and relationship extraction
  - Manual node and relationship creation
  - Graph visualization and exploration
  - Advanced graph operations (export, suggestions, etc.)

3. **Options and Flags**

```bash
# Start with database persistence
./run.sh --persist-db

# Force rebuild of Docker images
./run.sh --build

# Run in development mode with hot reloading
./run.sh --dev

# Run with a specific port
./run.sh --port=3000

# Stop the application
./stop.sh

# Stop and remove all data
./stop.sh --clean

# Force stop and clean up resources
./stop.sh --force
```

## Manual Installation (Without Docker)

If you prefer to run without Docker:

1. **Clone the Repository**
```bash
git clone <repository-url>
cd knowledge-graph-expander
```

2. **Install Python Dependencies**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. **Install Frontend Dependencies**
```bash
cd frontend
npm install
npm run build
cd ..
```

4. **Set up PostgreSQL**
- Install PostgreSQL
- Create a database
- Update DATABASE_URL in your .env file

5. **Run the Server**
```bash
uvicorn server.app:app --host 0.0.0.0 --port 8000 --reload
```

## Database Configuration

The database schema is automatically created when the application starts. The schema includes:

- **Nodes**: Core entities in the knowledge graph
- **Edges**: Relationships between nodes

```sql
CREATE TABLE IF NOT EXISTS nodes (
    id SERIAL PRIMARY KEY,
    label TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'concept',
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS edges (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES nodes(id),
    target_id INTEGER REFERENCES nodes(id),
    label TEXT NOT NULL DEFAULT 'related_to',
    weight FLOAT NOT NULL DEFAULT 1.0,
    metadata JSONB DEFAULT '{}'::jsonb
);
```

## Development Mode

For active development with hot reloading:

```bash
./run.sh --dev
```

This will:
- Mount your local code directories into the container
- Enable hot reloading for both frontend and backend
- Show live logs in the console

## Deployment

The application is designed to be deployed in various environments:

### Docker-based Deployment

1. Configure your environment variables in `.env`
2. Run `./run.sh --persist-db` to ensure data persistence
3. The application will be available on port 8080

### Cloud Deployment

For cloud environments like Heroku, Railway, or DigitalOcean:

1. Use the Dockerfile for container-based deployments
2. Configure database URL and API keys as environment variables
3. Ensure the port is properly exposed and mapped

## Troubleshooting

### Common Issues

1. **Docker Issues**
   - Ensure Docker and Docker Compose are installed and running
   - Check logs with `docker-compose logs`
   - The script automatically handles port conflicts by finding an available port
   - You can manually specify a port with `--port=PORT` (e.g., `--port=3000`)

2. **API Keys**
   - Verify at least one of OPENAI_API_KEY or ANTHROPIC_API_KEY is set
   - Check for proper API key format
   - Monitor API usage and rate limits

3. **Database Issues**
   - If using external database, check connection string
   - Verify database user has appropriate permissions
   - Review database logs for errors

4. **Frontend Issues**
   - Clear browser cache
   - Check browser console for errors
   - Verify WebSocket connection status

## Monitoring and Logs

- **Docker Logs**: `docker-compose logs -f api`
- **Database Monitoring**: Connect to PostgreSQL with psql or a GUI tool
- **API Metrics**: Available at `/api/health` endpoint