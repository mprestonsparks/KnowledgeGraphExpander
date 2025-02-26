import os
import json
import asyncpg
import logging
from typing import List, Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)

# Database connection
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_UuYP8ajchEx1@ep-polished-smoke-a465m3uc.us-east-1.aws.neon.tech/neondb?sslmode=require"
)

# Global connection pool
pool = None


async def init_db():
    """Initialize the database connection pool"""
    global pool
    pool = await asyncpg.create_pool(DATABASE_URL)
    logger.info("Database connection pool initialized")
    return pool


async def get_pool():
    """Get the database connection pool"""
    global pool
    if pool is None:
        pool = await init_db()
    return pool


async def get_node(node_id: int):
    """Get a node by ID"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM nodes WHERE id = $1", node_id)
        if row:
            metadata = row["metadata"] if row["metadata"] else {}
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except:
                    metadata = {}

            return {
                "id": row["id"],
                "label": row["label"],
                "type": row["type"],
                "metadata": metadata
            }
        return None


async def get_all_nodes():
    """Get all nodes"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM nodes")
        nodes = []
        for row in rows:
            metadata = row["metadata"] if row["metadata"] else {}
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except:
                    metadata = {}

            nodes.append({
                "id": row["id"],
                "label": row["label"],
                "type": row["type"],
                "metadata": metadata
            })
        return nodes


async def create_node(node_data):
    """Create a node"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        metadata_json = json.dumps(node_data.get("metadata", {}))
        row = await conn.fetchrow(
            "INSERT INTO nodes (label, type, metadata) VALUES ($1, $2, $3) RETURNING id, label, type, metadata",
            node_data.get("label"), node_data.get("type", "concept"),
            metadata_json)

        node = {
            "id": row["id"],
            "label": row["label"],
            "type": row["type"],
            "metadata": json.loads(row["metadata"]) if row["metadata"] else {}
        }

        return node


async def get_edge(edge_id: int):
    """Get an edge by ID"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM edges WHERE id = $1", edge_id)
        if row:
            metadata = row["metadata"] if row["metadata"] else {}
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except:
                    metadata = {}

            return {
                "id": row["id"],
                "sourceId": row["source_id"],
                "targetId": row["target_id"],
                "label": row["label"],
                "weight": row["weight"],
                "metadata": metadata
            }
        return None


async def get_all_edges():
    """Get all edges"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM edges")
        edges = []
        for row in rows:
            metadata = row["metadata"] if row["metadata"] else {}
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except:
                    metadata = {}

            edges.append({
                "id": row["id"],
                "sourceId": row["source_id"],
                "targetId": row["target_id"],
                "label": row["label"],
                "weight": row["weight"],
                "metadata": metadata
            })
        return edges


async def create_edge(edge_data):
    """Create an edge"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Check if nodes exist
        source_exists = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM nodes WHERE id = $1)",
            edge_data.get("sourceId"))
        target_exists = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM nodes WHERE id = $1)",
            edge_data.get("targetId"))

        if not source_exists or not target_exists:
            return None

        # Check if edge already exists
        edge_exists = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM edges WHERE source_id = $1 AND target_id = $2)",
            edge_data.get("sourceId"), edge_data.get("targetId"))

        if edge_exists:
            return None

        metadata_json = json.dumps(edge_data.get("metadata", {}))
        row = await conn.fetchrow(
            "INSERT INTO edges (source_id, target_id, label, weight, metadata) VALUES ($1, $2, $3, $4, $5) RETURNING id, source_id, target_id, label, weight, metadata",
            edge_data.get("sourceId"), edge_data.get("targetId"),
            edge_data.get("label", "related_to"), edge_data.get("weight", 1),
            metadata_json)

        edge = {
            "id": row["id"],
            "sourceId": row["source_id"],
            "targetId": row["target_id"],
            "label": row["label"],
            "weight": row["weight"],
            "metadata": json.loads(row["metadata"]) if row["metadata"] else {}
        }

        return edge


async def get_full_graph():
    """Get the full graph data"""
    nodes = await get_all_nodes()
    edges = await get_all_edges()

    return {"nodes": nodes, "edges": edges}
