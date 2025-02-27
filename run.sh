#!/bin/bash
# Start the FastAPI backend
python main.py &
pid_backend=$!

# Wait for backend to start
sleep 2

# Start the frontend dev server
cd frontend && npm run dev &
pid_frontend=$!

# Wait for both processes
wait $pid_backend $pid_frontend