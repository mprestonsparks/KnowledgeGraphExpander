import os
import json
import logging
import networkx as nx
from typing import Dict, List, Any, Optional
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

# OpenAI client
openai_client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

async def expand_graph(prompt: str, current_graph: nx.Graph):
    """Expand the graph based on a prompt"""
    # Get existing nodes and edges
    existing_nodes = []
    for node_id in current_graph.nodes():
        node_data = current_graph.nodes[node_id]
        existing_nodes.append({
            "id": int(node_id),
            "label": node_data.get("label", f"Node {node_id}"),
            "type": node_data.get("type", "concept"),
            "metadata": node_data.get("metadata", {})
        })

    existing_edges = []
    for source, target, data in current_graph.edges(data=True):
        existing_edges.append({
            "source": int(source),
            "target": int(target),
            "label": data.get("label", "related_to"),
            "weight": data.get("weight", 1)
        })

    logger.info(f'Current graph state: {len(existing_nodes)} nodes, {len(existing_edges)} edges')

    try:
        # Create system message for the model
        system_message = """You are a knowledge graph reasoning system. When expanding the graph, follow these rules:

1. Every new node MUST have at least one connection to either:
   - An existing node in the graph
   - Another new node being added in this iteration

2. First, provide your reasoning about how to expand the graph:
<|thinking|>
[Step-by-step reasoning about potential new concepts and relationships]
</|thinking|>

1. Then, extract a local graph that maintains connectivity. Return the result as JSON:
{
  "reasoning": string, // Your <|thinking|> block
  "nodes": [{ 
    "label": string,
    "type": string,
    "metadata": { description: string }
  }],
  "edges": [{ 
    "sourceId": number,
    "targetId": number,
    "label": string,
    "weight": number
  }],
  "nextQuestion": string // A follow-up question based on the new nodes/edges
}

IMPORTANT: 
- Each node must have at least one edge connecting it
- Edges must form valid connections between nodes
- Focus on quality over quantity - suggest only a few highly relevant nodes and edges"""

        # Create user message
        user_message = f"""Current graph state:
Nodes: {json.dumps(existing_nodes, indent=2)}
Edges: {json.dumps(existing_edges, indent=2)}

Prompt for expansion: {prompt}"""

        # Call the OpenAI API
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ],
            response_format={"type": "json_object"}
        )

        # Parse the response
        if not response.choices or not response.choices[0].message.content:
            raise Exception('No content in OpenAI response')

        result = json.loads(response.choices[0].message.content)

        # Validate the response
        if not result.get("nodes") or not result.get("edges"):
            logger.warning('Invalid response format from OpenAI')
            return {"nodes": [], "edges": []}

        # Log the reasoning process
        if result.get("reasoning"):
            logger.info(f'Reasoning output: {result["reasoning"][:200]}...')

        logger.info(f'Generated next question: {result.get("nextQuestion", "")}')

        return result
    except Exception as e:
        logger.error(f'Failed to expand graph: {str(e)}')
        return {"nodes": [], "edges": []}

async def suggest_relationships(current_graph: nx.Graph):
    """Suggest relationships between nodes in the graph"""
    # Get all nodes and their metadata
    nodes = []
    for node_id in current_graph.nodes():
        node_data = current_graph.nodes[node_id]
        nodes.append({
            "id": int(node_id),
            "label": node_data.get("label", f"Node {node_id}"),
            "type": node_data.get("type", "concept"),
            "metadata": node_data.get("metadata", {})
        })

    # Get existing relationships for context
    existing_edges = []
    for source, target, data in current_graph.edges(data=True):
        existing_edges.append({
            "source": int(source),
            "target": int(target),
            "label": data.get("label", "related_to"),
            "weight": data.get("weight", 1)
        })

    logger.info(f'Current nodes: {len(nodes)}, current edges: {len(existing_edges)}')

    if len(nodes) < 2:
        logger.info('Not enough nodes for suggestions')
        return []

    try:
        # Create system message for the model
        system_message = """You are a knowledge graph relationship expert. Analyze the current nodes and edges, then suggest potential new relationships between existing nodes that don't already have direct connections. For each suggestion:
- Choose nodes that would benefit from being connected
- Provide a specific, descriptive label for the relationship
- Assign a confidence score based on semantic relevance
- Include a brief explanation of the suggested connection
Format as JSON array: [{ "sourceId": number, "targetId": number, "label": string, "confidence": number, "explanation": string }]"""

        # Create user message
        user_message = f"""Current graph state:
Nodes: {json.dumps(nodes, indent=2)}
Existing connections: {json.dumps(existing_edges, indent=2)}

Suggest 2-3 new relationships between nodes that don't already have direct connections."""

        # Call the OpenAI API
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ],
            response_format={"type": "json_object"}
        )

        # Parse the response
        if not response.choices or not response.choices[0].message.content:
            logger.error('No content in OpenAI response')
            return []

        content = response.choices[0].message.content
        parsed = json.loads(content)

        # Handle different response formats
        result = parsed if isinstance(parsed, list) else parsed.get("suggestions", [])

        logger.info(f'Parsed suggestions: {len(result)} suggestions')

        # Validate and filter suggestions
        valid_suggestions = []
        for suggestion in result:
            # Check if valid
            is_valid = (
                any(n["id"] == suggestion["sourceId"] for n in nodes) and
                any(n["id"] == suggestion["targetId"] for n in nodes) and
                not any(
                    (e["source"] == suggestion["sourceId"] and e["target"] == suggestion["targetId"]) or
                    (e["source"] == suggestion["targetId"] and e["target"] == suggestion["sourceId"])
                    for e in existing_edges
                )
            )

            if not is_valid:
                logger.info(f'Filtered out invalid suggestion: {suggestion}')
                continue

            valid_suggestions.append({
                "sourceId": suggestion["sourceId"],
                "targetId": suggestion["targetId"],
                "label": suggestion["label"],
                "confidence": min(1, max(0, float(suggestion["confidence"]))),
                "explanation": suggestion["explanation"]
            })

        logger.info(f'Final valid suggestions: {len(valid_suggestions)}')
        return valid_suggestions
    except Exception as e:
        logger.error(f'Error getting relationship suggestions: {str(e)}')
        return []