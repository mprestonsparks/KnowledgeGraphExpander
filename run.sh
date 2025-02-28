#!/bin/bash
# Start the FastAPI backend and frontend development server
HOST="0.0.0.0"
BACKEND_PORT="3000"

# Kill any existing processes on the backend port
fuser -k $BACKEND_PORT/tcp 2>/dev/null || true

# Export necessary environment variables
export PYTHONPATH="."
export PORT="$BACKEND_PORT"

echo "Starting FastAPI backend..."
python main.py &
pid_backend=$!

# Wait for backend to start and verify it's running
echo "Waiting for backend to start..."
for i in {1..10}; do
  if curl -s http://$HOST:$BACKEND_PORT/health > /dev/null; then
    echo "Backend started successfully"
    break
  fi
  if [ $i -eq 10 ]; then
    echo "Backend failed to start"
    exit 1
  fi
  sleep 1
done

echo "Starting frontend development server..."
cd frontend && npm install && npm run dev -- --host $HOST &
pid_frontend=$!

# Wait for both processes
wait $pid_backend $pid_frontend