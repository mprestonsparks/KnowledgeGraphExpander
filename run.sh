#!/bin/bash
# Build frontend and start backend server
cd frontend && npm install && npm run build && cd .. && uvicorn server.app:app --host 0.0.0.0 --port 5000 --reload