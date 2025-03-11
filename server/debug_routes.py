"""Debug routes for troubleshooting the Knowledge Graph application."""
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import HTMLResponse, FileResponse
import logging
import sys
import traceback
import pathlib
from typing import Dict, Any

router = APIRouter(tags=["debug"])
logger = logging.getLogger(__name__)

# Make sure our logs go to stdout
handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
logger.addHandler(handler)
logger.setLevel(logging.DEBUG)

# Serve the knowledge explorer HTML interface
@router.get("/explorer", response_class=HTMLResponse)
async def knowledge_explorer():
    """Serve the Knowledge Explorer HTML interface."""
    try:
        logger.info("Serving Knowledge Explorer HTML interface")
        project_root = pathlib.Path(__file__).parent.parent
        explorer_path = project_root / "knowledge_explorer.html"
        
        if explorer_path.exists():
            return FileResponse(explorer_path)
        else:
            logger.error(f"Knowledge Explorer HTML file not found at {explorer_path}")
            return HTMLResponse("<h1>Error: Knowledge Explorer file not found</h1>")
    except Exception as e:
        logger.error(f"Error serving Knowledge Explorer: {str(e)}", exc_info=True)
        return HTMLResponse(f"<h1>Error</h1><p>{str(e)}</p>")

# Add a debug WebSocket endpoint that accepts any connection and echoes messages
@router.websocket("/api/debug/ws-debug")
async def websocket_debug_endpoint(websocket: WebSocket):
    """Debug WebSocket endpoint that echoes messages back to the client."""
    try:
        logger.info("Debug WebSocket connection requested")
        logger.info(f"WebSocket client host: {websocket.client.host}, port: {websocket.client.port}")
        await websocket.accept()
        logger.info("Debug WebSocket connection accepted")
        
        # Send a test message immediately after accepting
        await websocket.send_text("Connected to debug WebSocket!")
        logger.info("Sent initial test message")
        
        while True:
            logger.info("Waiting for message...")
            data = await websocket.receive_text()
            logger.info(f"Debug WebSocket received: {data}")
            await websocket.send_text(f"You sent: {data}")
    except WebSocketDisconnect as wd:
        logger.info(f"Debug WebSocket disconnected: {wd}")
    except Exception as e:
        logger.error(f"Debug WebSocket error: {str(e)}")
        traceback.print_exc()
        logger.error(traceback.format_exc())

@router.get("/api/debug/graph-data")
async def debug_graph_data():
    """Debug endpoint that returns minimal graph data for testing frontend connectivity."""
    try:
        logger.info("Received request to debug graph data endpoint")
        # Return minimal graph data that matches the expected structure
        return {
            "nodes": [
                {"id": 1, "label": "Debug Node 1", "type": "concept", "metadata": {}},
                {"id": 2, "label": "Debug Node 2", "type": "concept", "metadata": {}}
            ],
            "edges": [
                {"id": 1, "sourceId": 1, "targetId": 2, "label": "debug_connection", "weight": 1, "metadata": {}}
            ],
            "clusters": [],
            "metrics": {}
        }
    except Exception as e:
        logger.error(f"Error in debug endpoint: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={"message": "Debug endpoint error", "error": str(e)}
        )
