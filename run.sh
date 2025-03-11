#!/bin/bash
# Script to run the Knowledge Graph Expander application using Docker

# Exit immediately if a command exits with a non-zero status
set -e

# Display colorful welcome message
echo -e "\033[1;34m======================================\033[0m"
echo -e "\033[1;32mKnowledge Graph Expander\033[0m"
echo -e "\033[1;34m======================================\033[0m"

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo -e "\033[1;31mError: Docker is required but not found.\033[0m"
    echo -e "Please install Docker before running this script."
    echo -e "Visit https://docs.docker.com/get-docker/ for installation instructions."
    exit 1
fi

# Determine which docker compose command to use
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo -e "\033[1;31mError: Neither docker-compose nor docker compose is available.\033[0m"
    exit 1
fi

# Check for .env file and create if doesn't exist
if [ ! -f .env ]; then
    echo -e "\033[1;33mNotice: .env file not found. Creating from .env.example\033[0m"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "\033[1;33mPlease edit the .env file to add your API keys.\033[0m"
    else
        echo -e "\033[1;31mError: .env.example file not found.\033[0m"
        exit 1
    fi
fi

# Parse command line arguments
PERSIST_DB=false
BUILD=false
DEV_MODE=false
CUSTOM_PORT=""

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --persist-db) PERSIST_DB=true ;;
        --build) BUILD=true ;;
        --dev) DEV_MODE=true ;;
        --port=*) CUSTOM_PORT="${1#*=}" ;;
        --help) 
            echo "Usage: ./run.sh [options]"
            echo ""
            echo "Options:"
            echo "  --persist-db    Persist database data between runs"
            echo "  --build         Force rebuild of Docker images"
            echo "  --dev           Run in development mode with hot reloading"
            echo "  --port=PORT     Specify custom port (default: 8000)"
            echo "  --help          Show this help message"
            exit 0
            ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Function to check if a port is in use
port_in_use() {
    if command -v nc &> /dev/null; then
        nc -z localhost "$1" &> /dev/null
        return $?
    elif command -v lsof &> /dev/null; then
        lsof -i:"$1" &> /dev/null
        return $?
    else
        (echo > /dev/tcp/localhost/"$1") &> /dev/null
        return $?
    fi
}

# Function to find an available port starting from a base port
find_available_port() {
    local port="$1"
    local max_attempts=20
    local attempt=0
    
    while [ "$attempt" -lt "$max_attempts" ]; do
        if ! port_in_use "$port"; then
            echo "$port"
            return 0
        fi
        port=$((port + 1))
        attempt=$((attempt + 1))
    done
    
    echo -e "\033[1;31mError: Could not find an available port after $max_attempts attempts.\033[0m"
    exit 1
}

# Set default port if not provided
DEFAULT_PORT=8000
HOST_PORT=${CUSTOM_PORT:-8000}

# Check if the specified port is available, if not find an available one
if port_in_use "$HOST_PORT"; then
    echo -e "\033[1;33mPort $HOST_PORT is already in use. Finding an available port...\033[0m"
    HOST_PORT=$(find_available_port "$HOST_PORT")
    echo -e "\033[1;32mUsing port $HOST_PORT\033[0m"
fi

# Create a new docker-compose-custom.yml file for our custom configuration
cat > docker-compose-custom.yml << EOL
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: knowledge-graph-api
    restart: unless-stopped
    ports:
      - "${HOST_PORT}:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/knowledgegraph
      - PORT=8000
      # API keys are loaded from .env file
    volumes:
      # Mount for development (enabled for hot reloading)
      - ./server:/app/server
      - ./shared:/app/shared
      - ./knowledge_explorer.html:/app/knowledge_explorer.html:ro
      # For .env file
      - ./.env:/app/.env:ro
    depends_on:
      - db
    networks:
      - knowledge-graph-network

  db:
    image: postgres:14-alpine
    container_name: knowledge-graph-db
    restart: unless-stopped
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=knowledgegraph
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - knowledge-graph-network

networks:
  knowledge-graph-network:
    driver: bridge

volumes:
  postgres_data:
    # Set to 'true' to persist data, 'false' to discard on container down
    external: $([ "$PERSIST_DB" = "true" ] && echo "true" || echo "false")
EOL

# Function to clean up on exit
cleanup() {
    echo -e "\033[1;34mCleaning up...\033[0m"
    if [ -f docker-compose-custom.yml ]; then
        rm -f docker-compose-custom.yml
    fi
}

# Register cleanup function
trap cleanup EXIT

# Stop any existing containers
echo -e "\033[1;34mStopping any existing containers...\033[0m"
$DOCKER_COMPOSE -f docker-compose-custom.yml down 2>/dev/null || true

# Build if necessary
if [ "$BUILD" = true ]; then
    echo -e "\033[1;34mBuilding Docker containers...\033[0m"
    $DOCKER_COMPOSE -f docker-compose-custom.yml build
fi

# Run the application
if [ "$DEV_MODE" = true ]; then
    echo -e "\033[1;34mStarting application in development mode...\033[0m"
    
    # Start the database first
    $DOCKER_COMPOSE -f docker-compose-custom.yml up -d db
    
    # Wait for the database to be ready
    echo -e "\033[1;34mWaiting for database to be ready...\033[0m"
    max_attempts=30
    attempt=0
    while [ "$attempt" -lt "$max_attempts" ]; do
        if $DOCKER_COMPOSE -f docker-compose-custom.yml exec db pg_isready -U postgres -h localhost > /dev/null 2>&1; then
            echo -e "\033[1;32mDatabase is ready.\033[0m"
            break
        fi
        echo -e "\033[1;33mWaiting for database (attempt $((attempt+1))/$max_attempts)...\033[0m"
        sleep 1
        attempt=$((attempt + 1))
    done
    
    if [ "$attempt" -eq "$max_attempts" ]; then
        echo -e "\033[1;31mDatabase failed to become ready within $max_attempts seconds.\033[0m"
        $DOCKER_COMPOSE -f docker-compose-custom.yml down
        exit 1
    fi
    
    # Start API in development mode
    echo -e "\033[1;34mStarting API in development mode\033[0m"
    echo -e "\033[1;32m➡️ The Knowledge Graph Explorer is available at: http://localhost:$HOST_PORT/explorer\033[0m"
    echo -e "\033[1;32m➡️ The API docs are available at: http://localhost:$HOST_PORT/api/docs\033[0m"
    $DOCKER_COMPOSE -f docker-compose-custom.yml run --service-ports api dev
else
    echo -e "\033[1;34mStarting application...\033[0m"
    if ! $DOCKER_COMPOSE -f docker-compose-custom.yml up -d; then
        echo -e "\033[1;31mFailed to start containers. Please check the logs above for details.\033[0m"
        exit 1
    fi
    
    # Wait for services to be ready
    echo -e "\033[1;34mWaiting for services to be ready...\033[0m"
    sleep 5
    
    # Show application info and logs
    echo -e "\033[1;34mApplication is running!\033[0m"
    echo -e "\033[1;32m➡️ The Knowledge Graph Explorer is available at: http://localhost:$HOST_PORT/explorer\033[0m"
    echo -e "\033[1;32m➡️ The API docs are available at: http://localhost:$HOST_PORT/api/docs\033[0m"
    echo -e "\033[1;34mShowing logs (press Ctrl+C to exit logs but keep the application running):\033[0m"
    $DOCKER_COMPOSE -f docker-compose-custom.yml logs -f api
fi