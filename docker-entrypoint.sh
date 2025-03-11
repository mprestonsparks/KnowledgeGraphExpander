#!/bin/bash
set -e

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    echo "Loading environment variables from .env file"
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check required API keys
if [ -z "$OPENAI_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "Warning: Neither OPENAI_API_KEY nor ANTHROPIC_API_KEY is set!"
    echo "At least one API key is required for full functionality."
fi

# Wait for database to be ready
echo "Waiting for database..."
timeout=60
counter=0
until pg_isready -h db -p 5432 -U postgres || [ $counter -eq $timeout ]; do
    echo "Waiting for database connection ($counter/$timeout)..."
    sleep 1
    counter=$((counter+1))
done

if [ $counter -eq $timeout ]; then
    echo "Error: Failed to connect to database within $timeout seconds."
    exit 1
fi

echo "Database connection established"

# Initialize database
echo "Initializing database..."
python -c "import asyncio; from server.database import init_db; asyncio.run(init_db())"

# Command handling
case "$1" in
    api)
        echo "Starting Knowledge Graph API server..."
        exec uvicorn server.app:app --host 0.0.0.0 --port ${PORT:-8000}
        ;;
    dev)
        echo "Starting API server in development mode with hot reload..."
        exec uvicorn server.app:app --host 0.0.0.0 --port ${PORT:-8000} --reload
        ;;
    test)
        echo "Running tests..."
        exec pytest tests/
        ;;
    *)
        echo "Unknown command: $1"
        echo "Available commands: api, dev, test"
        exit 1
        ;;
esac