#!/bin/bash
# Build frontend and start backend server

# Exit immediately if a command exits with a non-zero status
set -e

# Activate virtual environment
if [ -d ".venv" ]; then
  echo "Activating virtual environment..."
  source .venv/bin/activate
else
  echo "Creating virtual environment..."
  python3 -m venv .venv
  source .venv/bin/activate
  echo "Installing dependencies..."
  pip install -r requirements.txt
fi

# Export environment variables
export PYTHONPATH=$PYTHONPATH:$(pwd)

# Build frontend
echo "Building frontend..."
cd frontend && npm install && npm run build && cd ..

# Create dotenv loader file to ensure API keys are loaded properly
cat > ./server/load_env.py << EOL
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Print available API keys (without showing actual values)
if os.environ.get('ANTHROPIC_API_KEY'):
    print("ANTHROPIC_API_KEY is set")
else:
    print("Warning: ANTHROPIC_API_KEY is not set")

if os.environ.get('OPENAI_API_KEY'):
    print("OPENAI_API_KEY is set")
else:
    print("Warning: OPENAI_API_KEY is not set")
EOL

# Test API key loading
echo "Testing environment variables..."
python ./server/load_env.py

# Start the FastAPI server
echo "Starting FastAPI server..."
uvicorn server.app:app --host 0.0.0.0 --port 8000 --reload