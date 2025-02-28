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
        assert len(result["nodes"]) >= 0

        # Test metrics calculation
        result = await graph_manager.get_graph_data()
        assert result is not None
        assert "metrics" in result
        assert "betweenness" in result["metrics"]
        assert "eigenvector" in result["metrics"]
        assert "degree" in result["metrics"]

        logger.info("Graph operations test passed")
    except Exception as e:
        logger.error(f"Graph operations test failed: {str(e)}")
        raise

@pytest.mark.asyncio
async def test_clustering(graph_manager):
    """Test graph clustering operations."""
    try:
        await graph_manager.initialize()

        # Add test nodes for clustering
        test_nodes = [
            {"label": "Node A", "type": "concept"},
            {"label": "Node B", "type": "concept"},
            {"label": "Node C", "type": "concept"}
        ]

        # Create nodes
        created_nodes = []
        for node in test_nodes:
            node = await create_node(node)
            if node:
                created_nodes.append(node)
                graph_manager.graph.add_node(str(node["id"]), **node)

        # Create some test edges if we have nodes
        if len(created_nodes) >= 2:
            edge_data = {
                "sourceId": created_nodes[0]["id"],
                "targetId": created_nodes[1]["id"],
                "label": "related_to",
                "weight": 1.0
            }
            edge = await create_edge(edge_data)
            if edge:
                source_id = str(edge["sourceId"])
                target_id = str(edge["targetId"])
                graph_manager.graph.add_edge(source_id, target_id, **edge)

        # Test clustering
        result = await graph_manager.get_graph_data()
        assert result is not None
        assert "clusters" in result

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
        node_data = {"label": "Disconnected Node", "type": "concept"}
        node = await create_node(node_data)
        if node:
            graph_manager.graph.add_node(str(node["id"]), **node)

        # Test reconnection
        result = await graph_manager.reconnect_disconnected_nodes()
        assert result is not None

        # Verify reconnection
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

async def create_node(node_data):
    # Placeholder - Replace with actual implementation
    # This function should create a node and return its data, including an 'id'
    # Example:  return {"id": 1, "label": node_data["label"], "type": node_data["type"]}
    pass

async def create_edge(edge_data):
    # Placeholder - Replace with actual implementation
    # This function should create an edge and return its data, including sourceId and targetId
    pass