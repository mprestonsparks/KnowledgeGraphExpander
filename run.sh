#!/bin/bash
# Start the FastAPI backend
HOST="0.0.0.0"
PORT="3000"

# Export environment variables for the frontend
export VITE_API_URL="http://localhost:${PORT}"

# Start the FastAPI backend
python main.py &
pid_backend=$!

# Wait for backend to start
sleep 2

# Start the frontend dev server
cd frontend && npm run dev -- --host $HOST &
pid_frontend=$!

# Wait for both processes
wait $pid_backend $pid_frontend