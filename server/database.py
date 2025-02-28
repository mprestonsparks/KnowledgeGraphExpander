import os
import json
import asyncpg
import logging
from typing import List, Dict, Any, Optional
from asyncpg.pool import Pool
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)

# Database connection
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_UuYP8ajchEx1@ep-polished-smoke-a465m3uc.us-east-1.aws.neon.tech/neondb?sslmode=require"
)

# Global connection pool
pool: Optional[Pool] = None

async def init_db():
    """Initialize the database and create tables if needed"""
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            # Initialize the database schema
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS nodes (
                    id SERIAL PRIMARY KEY,
                    label TEXT NOT NULL,
                    type TEXT NOT NULL DEFAULT 'concept',
                    metadata JSONB DEFAULT '{}'::jsonb
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS edges (
                    id SERIAL PRIMARY KEY,
                    source_id INTEGER REFERENCES nodes(id),
                    target_id INTEGER REFERENCES nodes(id),
                    label TEXT NOT NULL DEFAULT 'related_to',
                    weight FLOAT NOT NULL DEFAULT 1.0,
                    metadata JSONB DEFAULT '{}'::jsonb
                )
            """)
            logger.info("Database schema initialized")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize database: {str(e)}", exc_info=True)
        raise

async def get_pool() -> Pool:
    """Get or create the database connection pool"""
    global pool
    try:
        if pool is None:
            logger.info("Creating new database connection pool...")
            pool = await asyncpg.create_pool(
                DATABASE_URL,
                min_size=2,
                max_size=10,
                command_timeout=60,
                max_inactive_connection_lifetime=300.0
            )
            if pool:
                logger.info("Database connection pool successfully initialized")
        return pool
    except Exception as e:
        logger.error(f"Failed to initialize database pool: {str(e)}", exc_info=True)
        if pool:
            await cleanup_pool()
        raise

@asynccontextmanager
async def get_connection():
    """Get a database connection from the pool"""
    if pool is None:
        await get_pool()
    async with pool.acquire() as connection:
        try:
            yield connection
        except Exception as e:
            logger.error(f"Database connection error: {str(e)}", exc_info=True)
            raise

async def cleanup_pool():
    """Cleanup the database connection pool"""
    global pool
    try:
        if pool:
            logger.info("Cleaning up database connection pool")
            await pool.close()
    finally:
        pool = None

async def get_node(node_id: int):
    """Get a node by ID"""
    try:
        async with get_connection() as conn:
            row = await conn.fetchrow("SELECT * FROM nodes WHERE id = $1", node_id)
            if row:
                metadata = row["metadata"] if row["metadata"] else {}
                if isinstance(metadata, str):
                    try:
                        metadata = json.loads(metadata)
                    except json.JSONDecodeError as e:
                        logger.warning(f"Failed to parse node metadata: {str(e)}")
                        metadata = {}

                return {
                    "id": row["id"],
                    "label": row["label"],
                    "type": row["type"],
                    "metadata": metadata
                }
            logger.debug(f"Node {node_id} not found")
            return None
    except Exception as e:
        logger.error(f"Error retrieving node {node_id}: {str(e)}", exc_info=True)
        raise

async def create_node(node_data):
    """Create a node"""
    try:
        async with get_connection() as conn:
            async with conn.transaction():
                metadata_json = json.dumps(node_data.get("metadata", {}))
                row = await conn.fetchrow(
                    """
                    INSERT INTO nodes (label, type, metadata)
                    VALUES ($1, $2, $3)
                    RETURNING id, label, type, metadata
                    """,
                    node_data.get("label"),
                    node_data.get("type", "concept"),
                    metadata_json
                )

                node = {
                    "id": row["id"],
                    "label": row["label"],
                    "type": row["type"],
                    "metadata": json.loads(row["metadata"]) if row["metadata"] else {}
                }
                logger.info(f"Created new node with ID {node['id']}")
                return node
    except Exception as e:
        logger.error(f"Error creating node: {str(e)}", exc_info=True)
        raise

async def create_edge(edge_data):
    """Create an edge"""
    try:
        async with get_connection() as conn:
            async with conn.transaction():
                # Check if nodes exist
                source_exists = await conn.fetchval(
                    """
                    SELECT EXISTS(
                        SELECT 1 FROM nodes
                        WHERE id = $1
                    )
                    """,
                    edge_data.get("sourceId")
                )
                target_exists = await conn.fetchval(
                    """
                    SELECT EXISTS(
                        SELECT 1 FROM nodes
                        WHERE id = $1
                    )
                    """,
                    edge_data.get("targetId")
                )

                if not source_exists or not target_exists:
                    logger.warning("Source or target node does not exist")
                    return None

                # Check if edge already exists
                edge_exists = await conn.fetchval(
                    """
                    SELECT EXISTS(
                        SELECT 1 FROM edges
                        WHERE source_id = $1 AND target_id = $2
                    )
                    """,
                    edge_data.get("sourceId"),
                    edge_data.get("targetId")
                )

                if edge_exists:
                    logger.warning("Edge already exists")
                    return None

                metadata_json = json.dumps(edge_data.get("metadata", {}))
                row = await conn.fetchrow(
                    """
                    INSERT INTO edges (source_id, target_id, label, weight, metadata)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING id, source_id, target_id, label, weight, metadata
                    """,
                    edge_data.get("sourceId"),
                    edge_data.get("targetId"),
                    edge_data.get("label", "related_to"),
                    edge_data.get("weight", 1.0),
                    metadata_json
                )

                edge = {
                    "id": row["id"],
                    "sourceId": row["source_id"],
                    "targetId": row["target_id"],
                    "label": row["label"],
                    "weight": row["weight"],
                    "metadata": json.loads(row["metadata"]) if row["metadata"] else {}
                }
                logger.info(f"Created new edge with ID {edge['id']}")
                return edge
    except Exception as e:
        logger.error(f"Error creating edge: {str(e)}", exc_info=True)
        raise

async def get_full_graph():
    """Get the full graph data"""
    try:
        logger.info("Retrieving full graph data")
        async with get_connection() as conn:
            async with conn.transaction():
                # Get all nodes
                nodes = []
                rows = await conn.fetch("SELECT * FROM nodes")
                for row in rows:
                    metadata = row["metadata"] if row["metadata"] else {}
                    if isinstance(metadata, str):
                        try:
                            metadata = json.loads(metadata)
                        except json.JSONDecodeError:
                            metadata = {}
                    nodes.append({
                        "id": row["id"],
                        "label": row["label"],
                        "type": row["type"],
                        "metadata": metadata
                    })

                # Get all edges
                edges = []
                rows = await conn.fetch("SELECT * FROM edges")
                for row in rows:
                    metadata = row["metadata"] if row["metadata"] else {}
                    if isinstance(metadata, str):
                        try:
                            metadata = json.loads(metadata)
                        except json.JSONDecodeError:
                            metadata = {}
                    edges.append({
                        "id": row["id"],
                        "sourceId": row["source_id"],
                        "targetId": row["target_id"],
                        "label": row["label"],
                        "weight": row["weight"],
                        "metadata": metadata
                    })

                logger.info(f"Retrieved graph with {len(nodes)} nodes and {len(edges)} edges")
                return {"nodes": nodes, "edges": edges}
    except Exception as e:
        logger.error(f"Error retrieving full graph: {str(e)}", exc_info=True)
        raise

async def get_all_nodes():
    """Get all nodes"""
    try:
        async with get_connection() as conn:
            rows = await conn.fetch("SELECT * FROM nodes")
            nodes = []
            for row in rows:
                metadata = row["metadata"] if row["metadata"] else {}
                if isinstance(metadata, str):
                    try:
                        metadata = json.loads(metadata)
                    except json.JSONDecodeError as e:
                        logger.warning(f"Failed to parse node metadata: {str(e)}")
                        metadata = {}

                nodes.append({
                    "id": row["id"],
                    "label": row["label"],
                    "type": row["type"],
                    "metadata": metadata
                })
            logger.debug(f"Retrieved {len(nodes)} nodes")
            return nodes
    except Exception as e:
        logger.error(f"Error retrieving all nodes: {str(e)}", exc_info=True)
        raise

async def get_edge(edge_id: int):
    """Get an edge by ID"""
    try:
        async with get_connection() as conn:
            row = await conn.fetchrow("SELECT * FROM edges WHERE id = $1", edge_id)
            if row:
                metadata = row["metadata"] if row["metadata"] else {}
                if isinstance(metadata, str):
                    try:
                        metadata = json.loads(metadata)
                    except json.JSONDecodeError as e:
                        logger.warning(f"Failed to parse edge metadata: {str(e)}")
                        metadata = {}

                return {
                    "id": row["id"],
                    "sourceId": row["source_id"],
                    "targetId": row["target_id"],
                    "label": row["label"],
                    "weight": row["weight"],
                    "metadata": metadata
                }
            logger.debug(f"Edge {edge_id} not found")
            return None
    except Exception as e:
        logger.error(f"Error retrieving edge {edge_id}: {str(e)}", exc_info=True)
        raise

async def get_all_edges():
    """Get all edges"""
    try:
        async with get_connection() as conn:
            rows = await conn.fetch("SELECT * FROM edges")
            edges = []
            for row in rows:
                metadata = row["metadata"] if row["metadata"] else {}
                if isinstance(metadata, str):
                    try:
                        metadata = json.loads(metadata)
                    except json.JSONDecodeError as e:
                        logger.warning(f"Failed to parse edge metadata: {str(e)}")
                        metadata = {}

                edges.append({
                    "id": row["id"],
                    "sourceId": row["source_id"],
                    "targetId": row["target_id"],
                    "label": row["label"],
                    "weight": row["weight"],
                    "metadata": metadata
                })
            logger.debug(f"Retrieved {len(edges)} edges")
            return edges
    except Exception as e:
        logger.error(f"Error retrieving all edges: {str(e)}", exc_info=True)
        raise