"""Test semantic analysis API endpoints."""
import pytest
from fastapi.testclient import TestClient
import logging
import base64

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Sample base64 image (1x1 transparent PNG)
SAMPLE_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=='

@pytest.mark.asyncio
async def test_analyze_content_validation(test_client):
    """Test content analysis input validation."""
    try:
        # Test case 1: Missing text field
        invalid_request = {
            "images": []
        }
        response = test_client.post("/api/graph/analyze", json=invalid_request)
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data
        assert any("text" in error["msg"] for error in data["detail"])
        logger.info("Missing text field validation passed")

        # Test case 2: Invalid image data
        invalid_image_request = {
            "text": "Test content",
            "images": [{
                "data": "invalid-base64!",
                "type": "image/png"
            }]
        }
        response = test_client.post("/api/graph/analyze", json=invalid_image_request)
        assert response.status_code == 400
        assert "Invalid image data format" in response.json()["detail"]
        logger.info("Invalid image data validation passed")

        # Test case 3: Invalid image format (missing type)
        invalid_format_request = {
            "text": "Test content",
            "images": [{
                "data": SAMPLE_IMAGE_BASE64
            }]
        }
        response = test_client.post("/api/graph/analyze", json=invalid_format_request)
        assert response.status_code == 400
        assert "Invalid image format" in response.json()["detail"]
        logger.info("Invalid image format validation passed")

        # Test case 4: Text too long
        long_text_request = {
            "text": "A" * 60000,
            "images": []
        }
        response = test_client.post("/api/graph/analyze", json=long_text_request)
        assert response.status_code == 400
        assert "exceeds maximum length" in response.json()["detail"]
        logger.info("Text length validation passed")

        # Test case 5: Successful request with image
        valid_request = {
            "text": "Test content with image",
            "images": [{
                "data": SAMPLE_IMAGE_BASE64,
                "type": "image/png"
            }]
        }
        response = test_client.post("/api/graph/analyze", json=valid_request)
        assert response.status_code == 200
        data = response.json()
        assert "nodes" in data
        assert "edges" in data
        assert isinstance(data["nodes"], list)
        assert isinstance(data["edges"], list)
        logger.info("Valid request with image passed")

        logger.info("All content analysis validation tests passed")
    except Exception as e:
        logger.error(f"Content analysis validation test failed: {str(e)}", exc_info=True)
        raise

@pytest.mark.asyncio
async def test_analyze_content_error_handling(test_client):
    """Test content analysis error handling."""
    try:
        # Test case 1: Missing API key scenario (requires temporarily unsetting the key)
        import os
        original_key = os.environ.get("ANTHROPIC_API_KEY")
        os.environ["ANTHROPIC_API_KEY"] = ""

        response = test_client.post("/api/graph/analyze", json={
            "text": "Test content",
            "images": []
        })
        assert response.status_code == 500
        assert "API key not configured" in response.json()["detail"]
        logger.info("API key validation passed")

        # Restore API key
        if original_key:
            os.environ["ANTHROPIC_API_KEY"] = original_key

        # Test case 2: Invalid HTTP method
        response = test_client.put("/api/graph/analyze", json={
            "text": "Test content",
            "images": []
        })
        assert response.status_code == 405
        logger.info("HTTP method validation passed")

        logger.info("All error handling tests passed")
    except Exception as e:
        logger.error(f"Error handling test failed: {str(e)}", exc_info=True)
        raise
