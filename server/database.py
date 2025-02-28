import os
import json
import asyncpg
import logging
import asyncio
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
        await close_existing_pool()  # Ensure clean state
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
        await cleanup_pool()
        raise

async def close_existing_pool():
    """Close existing pool if it exists"""
    global pool
    if pool:
        await cleanup_pool()

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
                loop=asyncio.get_running_loop(),  # Use current event loop
                init=init_connection,
                server_settings={
                    'application_name': 'knowledge_graph',  # For connection tracking
                    'statement_timeout': '60s'  # Global statement timeout
                }
            )
            if pool:
                logger.info("Database connection pool successfully initialized")
        return pool
    except Exception as e:
        logger.error(f"Failed to initialize database pool: {str(e)}", exc_info=True)
        if pool:
            await cleanup_pool()
        raise

async def init_connection(conn: asyncpg.Connection):
    """Initialize connection defaults"""
    await conn.set_type_codec(
        'jsonb',
        encoder=json.dumps,
        decoder=json.loads,
        schema='pg_catalog'
    )

@asynccontextmanager
async def get_connection():
    """Get a database connection from the pool with error handling"""
    if pool is None:
        await get_pool()
    try:
        async with pool.acquire() as connection:
            async with connection.transaction():
                yield connection
    except Exception as e:
        logger.error(f"Database connection error: {str(e)}", exc_info=True)
        raise

async def cleanup_pool():
    """Cleanup the database connection pool"""
    global pool
    try:
        if pool:
            # Log active connections before cleanup
            if hasattr(pool, '_holders'):
                active = len([h for h in pool._holders if h._con and not h._con.is_closed()])
                logger.info(f"Cleaning up pool with {active} active connections")
            logger.info("Closing all database connections")
            await pool.close()
    finally:
        pool = None
        logger.info("Pool cleanup completed")

async def get_node(node_id: int):
    """Get a node by ID"""
    try:
        async with get_connection() as conn:
            row = await conn.fetchrow("SELECT * FROM nodes WHERE id = $1", node_id)
            if row:
                return {
                    "id": row["id"],
                    "label": row["label"],
                    "type": row["type"],
                    "metadata": row["metadata"] or {}
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
            row = await conn.fetchrow(
                """
                INSERT INTO nodes (label, type, metadata)
                VALUES ($1, $2, $3)
                RETURNING id, label, type, metadata
                """,
                node_data.get("label"),
                node_data.get("type", "concept"),
                node_data.get("metadata", {})
            )

            node = {
                "id": row["id"],
                "label": row["label"],
                "type": row["type"],
                "metadata": row["metadata"] or {}
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
            # Check if nodes exist
            source_exists = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM nodes WHERE id = $1)",
                edge_data.get("sourceId")
            )
            target_exists = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM nodes WHERE id = $1)",
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
                edge_data.get("metadata", {})
            )

            edge = {
                "id": row["id"],
                "sourceId": row["source_id"],
                "targetId": row["target_id"],
                "label": row["label"],
                "weight": row["weight"],
                "metadata": row["metadata"] or {}
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
            # Get all nodes
            nodes = []
            rows = await conn.fetch("SELECT * FROM nodes")
            for row in rows:
                nodes.append({
                    "id": row["id"],
                    "label": row["label"],
                    "type": row["type"],
                    "metadata": row["metadata"] or {}
                })

            # Get all edges
            edges = []
            rows = await conn.fetch("SELECT * FROM edges")
            for row in rows:
                edges.append({
                    "id": row["id"],
                    "sourceId": row["source_id"],
                    "targetId": row["target_id"],
                    "label": row["label"],
                    "weight": row["weight"],
                    "metadata": row["metadata"] or {}
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
                nodes.append({
                    "id": row["id"],
                    "label": row["label"],
                    "type": row["type"],
                    "metadata": row["metadata"] or {}
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
                return {
                    "id": row["id"],
                    "sourceId": row["source_id"],
                    "targetId": row["target_id"],
                    "label": row["label"],
                    "weight": row["weight"],
                    "metadata": row["metadata"] or {}
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
                edges.append({
                    "id": row["id"],
                    "sourceId": row["source_id"],
                    "targetId": row["target_id"],
                    "label": row["label"],
                    "weight": row["weight"],
                    "metadata": row["metadata"] or {}
                })
            logger.debug(f"Retrieved {len(edges)} edges")
            return edges
    except Exception as e:
        logger.error(f"Error retrieving all edges: {str(e)}", exc_info=True)
        raise