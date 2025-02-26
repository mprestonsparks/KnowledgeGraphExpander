from fastapi.testclient import TestClient
from app import app
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

client = TestClient(app)

def test_graph_analysis():
    # Test data: simple graph with 3 nodes and 2 edges
    test_data = {
        "nodes": [
            {"id": 1, "label": "A", "type": "concept", "metadata": {}},
            {"id": 2, "label": "B", "type": "concept", "metadata": {}},
            {"id": 3, "label": "C", "type": "concept", "metadata": {}}
        ],
        "edges": [
            {"sourceId": 1, "targetId": 2, "label": "connects", "weight": 1, "metadata": {}},
            {"sourceId": 2, "targetId": 3, "label": "connects", "weight": 1, "metadata": {}}
        ]
    }

    logger.info("Testing graph analysis endpoint")
    response = client.post("/api/graph/analyze", json=test_data)
    assert response.status_code == 200
    
    metrics = response.json()
    logger.info(f"Received metrics: {metrics}")
    
    # Verify metric structure
    assert "betweenness" in metrics
    assert "eigenvector" in metrics
    assert "degree" in metrics
    assert "scaleFreeness" in metrics
    
    # Basic metric validation
    assert metrics["degree"][str(2)] == 2  # Middle node should have degree 2
    assert metrics["degree"][str(1)] == 1  # End nodes should have degree 1
    assert metrics["degree"][str(3)] == 1
    
    # Check scale-freeness properties
    scale_free = metrics["scaleFreeness"]
    assert "powerLawExponent" in scale_free
    assert "fitQuality" in scale_free
    assert "hubNodes" in scale_free
    assert "bridgingNodes" in scale_free

def test_health_check():
    logger.info("Testing health check endpoint")
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

if __name__ == "__main__":
    logger.info("Starting FastAPI endpoint tests")
    test_health_check()
    test_graph_analysis()
    logger.info("All tests passed successfully")
