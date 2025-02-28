import pytest
import asyncio
import logging
from server.graph_manager import GraphManager
from server.models.schemas import Node, Edge

# Configure logging for tests
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@pytest.fixture
def graph_manager():
    """Create a fresh graph manager instance for each test."""
    return GraphManager()

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.mark.asyncio
async def test_graph_initialization(graph_manager):
    """Test graph manager initialization."""
    try:
        success = await graph_manager.initialize()
        assert success is True
        assert graph_manager.graph is not None
        logger.info("Graph initialization test passed")
    except Exception as e:
        logger.error(f"Graph initialization test failed: {str(e)}")
        raise

@pytest.mark.asyncio
async def test_graph_operations(graph_manager):
    """Test basic graph operations."""
    try:
        # Initialize graph
        await graph_manager.initialize()
        
        # Test graph expansion
        test_prompt = "Create a test knowledge graph about testing"
        result = await graph_manager.expand(test_prompt, max_iterations=2)
        
        assert result is not None
        assert "nodes" in result
        assert "edges" in result
        assert len(result["nodes"]) > 0
        
        # Test metrics calculation
        metrics = await graph_manager.calculate_metrics()
        assert metrics is not None
        assert "betweenness" in metrics
        assert "eigenvector" in metrics
        assert "degree" in metrics
        
        logger.info("Graph operations test passed")
    except Exception as e:
        logger.error(f"Graph operations test failed: {str(e)}")
        raise

@pytest.mark.asyncio
async def test_clustering(graph_manager):
    """Test graph clustering operations."""
    try:
        await graph_manager.initialize()
        
        # Add test nodes and edges for clustering
        test_nodes = [
            {"label": "Node A", "type": "concept"},
            {"label": "Node B", "type": "concept"},
            {"label": "Node C", "type": "concept"}
        ]
        
        # Create nodes and edges
        for node in test_nodes:
            created = await graph_manager.create_node(node)
            assert created is not None
        
        # Create some test edges
        edge_data = {
            "sourceId": 1,
            "targetId": 2,
            "label": "related_to",
            "weight": 1.0
        }
        created_edge = await graph_manager.create_edge(edge_data)
        assert created_edge is not None
        
        # Test clustering
        clusters = await graph_manager.recalculate_clusters()
        assert clusters is not None
        assert "clusters" in clusters
        
        logger.info("Clustering test passed")
    except Exception as e:
        logger.error(f"Clustering test failed: {str(e)}")
        raise

@pytest.mark.asyncio
async def test_disconnected_nodes(graph_manager):
    """Test handling of disconnected nodes."""
    try:
        await graph_manager.initialize()
        
        # Create disconnected node
        disconnected = await graph_manager.create_node({
            "label": "Disconnected Node",
            "type": "concept"
        })
        assert disconnected is not None
        
        # Test reconnection
        result = await graph_manager.reconnect_disconnected_nodes()
        assert result is not None
        
        # Verify reconnection
        graph_data = await graph_manager.get_graph_data()
        disconnected_count = graph_manager.count_disconnected_nodes()
        assert disconnected_count == 0
        
        logger.info("Disconnected nodes test passed")
    except Exception as e:
        logger.error(f"Disconnected nodes test failed: {str(e)}")
        raise

@pytest.mark.asyncio
async def test_content_analysis(graph_manager):
    """Test content analysis and semantic expansion."""
    try:
        await graph_manager.initialize()
        
        test_content = {
            "text": "Test content for semantic analysis",
            "images": []
        }
        
        result = await graph_manager.analyze_content(test_content)
        assert result is not None
        assert "nodes" in result
        assert "edges" in result
        
        logger.info("Content analysis test passed")
    except Exception as e:
        logger.error(f"Content analysis test failed: {str(e)}")
        raise
