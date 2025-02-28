import os
import logging
import json
import base64
from typing import Dict, List, Any, Optional, Union
from anthropic import AsyncAnthropic

logger = logging.getLogger(__name__)

# Anthropic client
anthropic_client = AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

def is_valid_base64(str_val: str) -> bool:
    """Check if a string is valid base64"""
    if not str_val:
        return False

    # Check for valid base64 characters only
    if not all(
            c in
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
            for c in str_val):
        return False

    # Check length is multiple of 4
    if len(str_val) % 4 != 0:
        return False

    try:
        base64.b64decode(str_val)
        return True
    except:
        return False

async def analyze_content(content: Dict[str, Any], existing_nodes: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """Analyze content and extract knowledge graph elements"""
    if existing_nodes is None:
        existing_nodes = []

    try:
        # Validate image data if present
        if content.get("images"):
            for image in content["images"]:
                if not is_valid_base64(image.get("data", "")):
                    raise ValueError('Invalid image data format')

        # Prepare system prompt
        system_prompt = """You are a semantic analysis expert. Analyze the following content and extract knowledge graph elements.

Important: Your response must be valid JSON in this exact format:
{
  "nodes": [{ 
    "label": string, 
    "type": string, 
    "metadata": { 
      "description": string,
      "imageUrl"?: string,
      "imageDescription"?: string,
      "documentContext"?: string
    } 
  }],
  "edges": [{ "sourceId": number, "targetId": number, "label": string, "weight": number }],
  "reasoning": string
}

Rules:
1. Node types should be one of: "concept", "entity", "process", "attribute"
2. Edge labels should describe meaningful relationships
3. Edge weights should be between 0 and 1
4. Include semantic reasoning about why these connections were made
5. For image nodes, include descriptions and visual context
6. Response must be pure JSON - no explanation text before or after"""

        # Prepare user message
        user_message = {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": f"""Existing nodes:
{json.dumps(existing_nodes, indent=2)}

Content to analyze:
{content.get("text", "")}"""
                }
            ]
        }

        # Add images if present
        if content.get("images"):
            for image in content["images"]:
                user_message["content"].append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": image.get("type", "image/jpeg"),
                        "data": image["data"]
                    }
                })

        # Call the Anthropic API
        response = await anthropic_client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1024,
            system=system_prompt,
            messages=[user_message]
        )

        # Parse the response
        response_text = response.content[0].text
        parsed_response = json.loads(response_text)

        # Add IDs to new nodes starting after the last existing node ID
        last_node_id = max([0] + [n.get("id", 0) for n in existing_nodes])
        nodes_with_ids = []

        for i, node in enumerate(parsed_response.get("nodes", [])):
            node_with_id = dict(node)
            node_with_id["id"] = last_node_id + i + 1
            nodes_with_ids.append(node_with_id)

        result = {
            "nodes": nodes_with_ids,
            "edges": parsed_response.get("edges", []),
            "reasoning": parsed_response.get("reasoning", "")
        }

        logger.info(f"Analysis complete with {len(result['nodes'])} nodes and {len(result['edges'])} edges")
        return result

    except Exception as e:
        logger.error(f'Semantic analysis failed: {str(e)}', exc_info=True)
        raise

async def validate_relationships(source_node: Dict[str, Any], target_nodes: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Validate relationships between nodes"""
    if not source_node:
        raise ValueError("Invalid source node")
    if not isinstance(target_nodes, list):
        raise ValueError("Invalid target nodes")

    try:
        # Prepare system prompt
        system_prompt = """You are a semantic relationship validator. Analyze the connections between the source node and target nodes.

Important: Your response must be valid JSON in this exact format:
{
  "confidenceScores": { [nodeId: number]: number },
  "reasoning": string
}

Rules:
1. Each confidence score should be between 0 and 1
2. Higher scores indicate stronger semantic relationships
3. Include reasoning about relationship validity
4. Response must be pure JSON - no explanation text before or after"""

        # Prepare user message
        user_message = f"""
Source Node:
{json.dumps(source_node, indent=2)}

Target Nodes:
{json.dumps(target_nodes, indent=2)}

Analyze the semantic coherence and validity of relationships between the source node and each target node.
"""

        # Call the Anthropic API
        response = await anthropic_client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1024,
            system=system_prompt,
            messages=[{
                "role": "user",
                "content": user_message
            }]
        )

        # Parse the response
        response_text = response.content[0].text
        parsed_response = json.loads(response_text)

        return {
            "confidenceScores": parsed_response.get("confidenceScores", {}),
            "reasoning": parsed_response.get("reasoning", "")
        }
    except Exception as e:
        logger.error(f'Failed to validate relationships: {str(e)}', exc_info=True)
        raise