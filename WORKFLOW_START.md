# Start Application Workflow Documentation

## Overview
The "Start application" workflow is responsible for building and running the Knowledge Graph System, which consists of a React frontend and FastAPI backend.

## Workflow Steps

### 1. Frontend Build Process
The workflow first handles the frontend setup:
```bash
cd frontend && npm install && npm run build
```
- Installs Node.js dependencies
- Builds the React application using Vite
- Output is generated in `frontend/dist/`

### 2. Backend Server Startup
After frontend build completes, the workflow starts the Python backend:
```bash
python main.py
```
- Initializes FastAPI server
- Serves both the API endpoints and the built frontend static files
- Uses uvicorn with auto-reload enabled
- Runs on port 5000 (accessible externally on port 80)

## Configuration Details

### Port Configuration
- Frontend dev server (when running separately): Port 3000
- Backend API: Port 5000 (mapped to 80 for external access)
- WebSocket connections: Port 5000
- Additional debug port: 8080

### Environment Variables
The following environment variables are automatically configured:
- `PYTHONPATH="."`
- Database connection string (via `DATABASE_URL`)

### Workflow Features
- Automatic restart on file changes
- Concurrent frontend/backend development support
- Static file serving from `frontend/dist`
- Integrated database connection management

## Troubleshooting
If the application doesn't start:
1. Check if frontend build completed successfully in `frontend/dist/`
2. Verify Python dependencies are installed
3. Check console logs for any startup errors
4. Ensure database connection is available

## Development Notes
- The workflow is configured in the `.replit` file
- Frontend changes require rebuilding for production
- Backend changes trigger automatic reload via uvicorn
- Access the application via the provided Replit URL
- The run button is configured to execute this workflow automatically