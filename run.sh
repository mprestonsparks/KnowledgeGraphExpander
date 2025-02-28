#!/bin/bash
# Start the FastAPI backend and frontend development server
HOST="0.0.0.0"
BACKEND_PORT="5000"

echo "Installing frontend dependencies..."
cd frontend 
npm install
npm run build
cd ..

echo "Starting FastAPI backend..."
uvicorn server.app:app --host $HOST --port $BACKEND_PORT --reload &
pid_backend=$!

# Wait for backend to start
sleep 2

echo "Starting frontend development server..."
cd frontend && npm run dev -- --host $HOST &
pid_frontend=$!

# Wait for both processes
wait $pid_backend $pid_frontend