from fastapi import APIRouter, HTTPException
import logging
from typing import Dict, List, Optional
from ..models.schemas import GraphData, GraphMetrics, ExpandGraphRequest, ContentAnalysisRequest
from ..database import get_full_graph
from ..graph_manager import graph_manager
from ..utils.graph_utils import create_networkx_graph, calculate_metrics

router = APIRouter(prefix="/api/graph", tags=["graph"])
logger = logging.getLogger(__name__)

@router.get("", response_model=GraphData)
async def get_graph_data():
    """Get the current graph data"""
    try:
        logger.info("Received request for graph data")
        data = await graph_manager.get_graph_data()
        logger.info(f"Retrieved graph data: {len(data.get('nodes', []))} nodes, {len(data.get('edges', []))} edges")
        return data
    except Exception as e:
        logger.error(f"Error getting graph data: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get graph data: {str(e)}")

@router.post("/expand", response_model=GraphData)
async def expand_graph(request: ExpandGraphRequest):
    """Expand the graph based on a prompt"""
    try:
        logger.info(f"Received graph expansion request with prompt: {request.prompt}")
        data = await graph_manager.expand(request.prompt, request.maxIterations)
        logger.info(f"Graph expanded successfully: {len(data.get('nodes', []))} nodes, {len(data.get('edges', []))} edges")
        return data
    except Exception as e:
        logger.error(f"Error expanding graph: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to expand graph: {str(e)}")

@router.post("/analyze", response_model=GraphMetrics)
async def analyze_graph(graph_data: GraphData):
    """Analyze a graph and return its metrics"""
    try:
        logger.info(f"Received graph analysis request: {len(graph_data.nodes)} nodes, {len(graph_data.edges)} edges")
        G = create_networkx_graph(graph_data)
        metrics = calculate_metrics(G)
        logger.info("Graph analysis completed successfully")
        return metrics
    except Exception as e:
        logger.error(f"Error during graph analysis: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze-content", response_model=GraphData)
async def analyze_content(request: ContentAnalysisRequest):
    """Analyze content and update the graph"""
    try:
        logger.info("Received content analysis request")
        data = await graph_manager.analyze_content(request.dict())
        logger.info("Content analysis completed successfully")
        return data
    except Exception as e:
        logger.error(f"Error analyzing content: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to analyze content: {str(e)}")

@router.post("/reconnect", response_model=GraphData)
async def reconnect_nodes():
    """Reconnect disconnected nodes"""
    try:
        logger.info("Received request to reconnect nodes")
        data = await graph_manager.reconnect_disconnected_nodes()
        logger.info("Node reconnection completed successfully")
        return data
    except Exception as e:
        logger.error(f"Error reconnecting nodes: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to reconnect nodes: {str(e)}")

@router.post("/cluster", response_model=GraphData)
async def reapply_clustering():
    """Reapply clustering to the graph"""
    try:
        logger.info("Received request to reapply clustering")
        data = await graph_manager.recalculate_clusters()
        logger.info("Clustering recalculation completed successfully")
        return data
    except Exception as e:
        logger.error(f"Error recalculating clusters: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to recalculate clusters: {str(e)}")