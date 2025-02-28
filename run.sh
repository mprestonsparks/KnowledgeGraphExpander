#!/bin/bash
# Start the FastAPI backend and frontend development server
HOST="0.0.0.0"
PORT="3000"

# Export environment variables for the frontend
export VITE_API_URL="http://localhost:${PORT}"

echo "Installing frontend dependencies..."
cd frontend 
npm install
npm run build
cd ..

echo "Starting FastAPI backend..."
python -m uvicorn main:app --host $HOST --port $PORT --reload &
pid_backend=$!

# Wait for backend to start
sleep 2

echo "Starting frontend development server..."
cd frontend && npm run dev -- --host $HOST &
pid_frontend=$!

# Wait for both processes
wait $pid_backend $pid_frontend