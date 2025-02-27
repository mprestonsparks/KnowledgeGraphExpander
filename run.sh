#!/bin/bash
# Start the FastAPI backend
python main.py &
# Wait for backend to start
sleep 2
# Start the frontend dev server
cd frontend && npm run dev
