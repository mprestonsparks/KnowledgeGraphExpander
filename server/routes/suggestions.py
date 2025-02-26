from fastapi import APIRouter, HTTPException
import logging
from typing import List
from ..models.schemas import RelationshipSuggestion, ApplySuggestionRequest
from ..graph_manager import graph_manager

router = APIRouter(prefix="/api/graph/suggestions", tags=["suggestions"])
logger = logging.getLogger(__name__)


@router.get("", response_model=List[RelationshipSuggestion])
async def get_suggestions():
    """Get relationship suggestions"""
    try:
        return await graph_manager.get_suggestions()
    except Exception as e:
        logger.error(f"Error getting suggestions: {str(e)}")
        raise HTTPException(status_code=500,
                            detail=f"Failed to get suggestions: {str(e)}")


@router.post("/apply", response_model=dict)
async def apply_suggestion(suggestion: ApplySuggestionRequest):
    """Apply a relationship suggestion"""
    try:
        edge = await graph_manager.apply_suggestion(suggestion)
        if not edge:
            raise HTTPException(
                status_code=400,
                detail=
                "Could not add edge - it may already exist or the nodes don't exist"
            )
        return {"success": True, "edge": edge}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error applying suggestion: {str(e)}")
        raise HTTPException(status_code=500,
                            detail=f"Failed to apply suggestion: {str(e)}")
