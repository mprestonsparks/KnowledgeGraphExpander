"""FastAPI application setup with GraphQL and REST endpoints."""
import os
import logging
import sys
import pathlib
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from starlette.responses import JSONResponse
from typing import List, Dict, Any
from pydantic import BaseModel
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure logging with more detailed format
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

# Log API key availability (without showing the actual keys)
if os.environ.get('ANTHROPIC_API_KEY'):
    logger.info("ANTHROPIC_API_KEY is available")
else:
    logger.warning("ANTHROPIC_API_KEY is not set - some features may not work")

if os.environ.get('OPENAI_API_KEY'):
    logger.info("OPENAI_API_KEY is available")
else:
    logger.warning("OPENAI_API_KEY is not set - some features may not work")

# Import routes and dependencies
from server.routes import graph, suggestions, websocket
from server.database import init_db, cleanup_pool
from server.graph_manager import graph_manager
from server.debug_routes import router as debug_router

class ContentAnalysisRequest(BaseModel):
    """Request model for content analysis."""
    text: str
    images: List[Dict[str, str]] = []

class ErrorResponse(BaseModel):
    """Standard error response model."""
    detail: str

# Knowledge Explorer HTML - embedded directly in the code
KNOWLEDGE_EXPLORER_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Knowledge Graph Explorer</title>
    <!-- Add D3.js library for graph visualization -->
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        :root {
            --primary: #2563eb;
            --primary-dark: #1d4ed8;
            --secondary: #4f46e5;
            --success: #10b981;
            --error: #ef4444;
            --warning: #f59e0b;
            --background: #f9fafb;
            --text: #1f2937;
            --border: #e5e7eb;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            background-color: var(--background);
            color: var(--text);
            line-height: 1.5;
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }

        header {
            margin-bottom: 2rem;
            border-bottom: 1px solid var(--border);
            padding-bottom: 1rem;
        }

        h1, h2, h3 {
            margin-bottom: 1rem;
            color: var(--primary-dark);
        }

        .flex {
            display: flex;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(12, 1fr);
            gap: 1rem;
        }

        .col-span-6 {
            grid-column: span 6;
        }

        .col-span-12 {
            grid-column: span 12;
        }

        @media (max-width: 768px) {
            .col-span-6 {
                grid-column: span 12;
            }
            .grid {
                grid-template-columns: 1fr;
            }
        }

        .card {
            background-color: white;
            border-radius: 0.5rem;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            padding: 1.5rem;
            margin-bottom: 1.5rem;
        }

        textarea, input[type="text"] {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid var(--border);
            border-radius: 0.375rem;
            margin-bottom: 1rem;
            font-family: inherit;
            font-size: 1rem;
        }

        textarea {
            min-height: 150px;
            resize: vertical;
        }

        button {
            background-color: var(--primary);
            color: white;
            border: none;
            padding: 0.75rem 1.25rem;
            border-radius: 0.375rem;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.15s ease-in-out;
        }

        button:hover {
            background-color: var(--primary-dark);
        }

        .button-group {
            display: flex;
            gap: 0.75rem;
            margin-bottom: 1rem;
        }

        .button-secondary {
            background-color: var(--secondary);
        }

        .button-success {
            background-color: var(--success);
        }

        .button-warning {
            background-color: var(--warning);
        }

        #statusMessage {
            padding: 1rem;
            margin-top: 1rem;
            border-radius: 0.375rem;
            display: none;
        }

        .status-success {
            background-color: rgba(16, 185, 129, 0.1);
            border: 1px solid var(--success);
            color: var(--success);
            display: block !important;
        }

        .status-error {
            background-color: rgba(239, 68, 68, 0.1);
            border: 1px solid var(--error);
            color: var(--error);
            display: block !important;
        }

        .graph-container {
            width: 100%;
            height: 400px;
            border: 1px solid var(--border);
            border-radius: 0.5rem;
            margin-bottom: 1.5rem;
            overflow: hidden;
        }

        #graphVisualization {
            width: 100%;
            height: 100%;
        }

        .json-output {
            background-color: #f8f9fa;
            padding: 1rem;
            border-radius: 0.375rem;
            overflow: auto;
            font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
            font-size: 0.875rem;
            line-height: 1.4;
            max-height: 300px;
        }

        .tag {
            display: inline-block;
            background-color: rgba(79, 70, 229, 0.1);
            color: var(--secondary);
            border-radius: 0.375rem;
            padding: 0.25rem 0.5rem;
            margin-right: 0.5rem;
            margin-bottom: 0.5rem;
            font-size: 0.875rem;
        }

        .websocket-status {
            display: inline-block;
            padding: 0.25rem 0.5rem;
            border-radius: 0.375rem;
            font-size: 0.875rem;
            margin-bottom: 1rem;
        }

        .ws-connected {
            background-color: rgba(16, 185, 129, 0.1);
            color: var(--success);
        }

        .ws-disconnected {
            background-color: rgba(239, 68, 68, 0.1);
            color: var(--error);
        }

        .tabs {
            display: flex;
            border-bottom: 1px solid var(--border);
            margin-bottom: 1.5rem;
        }
        
        /* API Key Settings Styles */
        .api-key-input {
            font-family: monospace;
            letter-spacing: 0.1em;
        }
        
        .key-status {
            margin-top: 0.5rem;
            margin-bottom: 1rem;
            font-size: 0.875rem;
        }
        
        .key-valid {
            color: var(--success);
        }
        
        .key-invalid {
            color: var(--error);
        }
        
        /* Graph visualization styles */
        .node {
            fill: #4f46e5;
            stroke: #fff;
            stroke-width: 2px;
        }
        
        .node-label {
            font-size: 12px;
            text-anchor: middle;
            pointer-events: none;
        }
        
        .link {
            stroke: #999;
            stroke-opacity: 0.6;
            stroke-width: 1px;
        }
        
        .link-label {
            font-size: 10px;
            text-anchor: middle;
            pointer-events: none;
            background: white;
            padding: 2px;
        }

        .tab {
            padding: 0.75rem 1.5rem;
            cursor: pointer;
            border-bottom: 2px solid transparent;
        }

        .tab.active {
            border-bottom: 2px solid var(--primary);
            color: var(--primary);
            font-weight: 600;
        }

        .tab:hover {
            color: var(--primary);
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
        }
    </style>
</head>
<body>
    <header>
        <h1>Knowledge Graph Explorer</h1>
        <p>Agentic Deep Graph Reasoning System</p>
        <div id="websocketStatus" class="websocket-status ws-disconnected">WebSocket: Disconnected</div>
    </header>

    <div class="tabs">
        <div class="tab active" data-tab="text-analysis">Text Analysis</div>
        <div class="tab" data-tab="node-editor">Node Editor</div>
        <div class="tab" data-tab="graph-view">Graph View</div>
        <div class="tab" data-tab="advanced">Advanced</div>
        <div class="tab" data-tab="settings">Settings</div>
    </div>

    <div id="text-analysis" class="tab-content active">
        <div class="card">
            <h2>Text Content Analysis</h2>
            <p>Enter text to analyze and extract knowledge graph nodes and relationships:</p>
            <textarea id="contentText" placeholder="Enter text to analyze... For example: 'Artificial Intelligence is a branch of computer science that focuses on creating intelligent machines. Machine Learning is a subset of AI that enables systems to learn from data.'"></textarea>
            <button id="analyzeButton" class="button-primary">Analyze Content</button>
            <div id="analysisStatusMessage" class="status-message"></div>
        </div>

        <div class="grid">
            <div class="col-span-6">
                <div class="card">
                    <h3>Extracted Entities</h3>
                    <div id="extractedEntities"></div>
                </div>
            </div>
            <div class="col-span-6">
                <div class="card">
                    <h3>Relationships</h3>
                    <div id="extractedRelationships"></div>
                </div>
            </div>
        </div>
    </div>

    <div id="node-editor" class="tab-content">
        <div class="grid">
            <div class="col-span-6">
                <div class="card">
                    <h3>Create Node</h3>
                    <input type="text" id="nodeLabel" placeholder="Node Label (e.g., 'Artificial Intelligence')">
                    <input type="text" id="nodeType" placeholder="Node Type (e.g., 'concept', 'technology')">
                    <button id="createNodeButton">Create Node</button>
                </div>
            </div>
            <div class="col-span-6">
                <div class="card">
                    <h3>Create Relationship</h3>
                    <input type="text" id="sourceNodeId" placeholder="Source Node ID">
                    <input type="text" id="relationshipLabel" placeholder="Relationship Label (e.g., 'is_a', 'part_of')">
                    <input type="text" id="targetNodeId" placeholder="Target Node ID">
                    <button id="createRelationshipButton">Create Relationship</button>
                </div>
            </div>
        </div>
    </div>

    <div id="graph-view" class="tab-content">
        <div class="card">
            <h2>Graph Visualization</h2>
            <div class="button-group">
                <button id="refreshGraphButton">Refresh Graph</button>
                <button id="expandGraphButton" class="button-secondary">Auto-Expand Graph</button>
            </div>
            <div class="graph-container">
                <div id="graphVisualization">
                    <!-- Graph visualization will be rendered here -->
                    <p style="padding: 20px; text-align: center;">Loading graph visualization...</p>
                </div>
            </div>
        </div>
    </div>

    <div id="advanced" class="tab-content">
        <div class="card">
            <h2>Advanced Operations</h2>
            <div class="button-group">
                <button id="clusterGraphButton">Run Clustering</button>
                <button id="exportGraphButton">Export Graph</button>
                <button id="runSuggestionButton" class="button-secondary">Generate Suggestions</button>
            </div>
            <h3>API Response</h3>
            <pre id="apiResponse" class="json-output">// API responses will appear here</pre>
        </div>
    </div>

    <div id="settings" class="tab-content">
        <div class="card">
            <h2>API Settings</h2>
            <p>Configure API keys for the knowledge graph services. Keys are stored securely in environment variables.</p>
            
            <div class="grid">
                <div class="col-span-6">
                    <h3>OpenAI API Key</h3>
                    <input type="password" id="openaiApiKey" placeholder="OpenAI API Key" class="api-key-input">
                    <div class="key-status" id="openaiKeyStatus"></div>
                </div>
                <div class="col-span-6">
                    <h3>Anthropic API Key</h3>
                    <input type="password" id="anthropicApiKey" placeholder="Anthropic API Key" class="api-key-input">
                    <div class="key-status" id="anthropicKeyStatus"></div>
                </div>
            </div>
            <div class="button-group" style="margin-top: 1rem;">
                <button id="saveApiKeysButton" class="button-success">Save API Keys</button>
                <button id="checkApiKeysButton">Check API Keys</button>
            </div>
            <div id="apiKeyStatusMessage" style="margin-top: 1rem;"></div>
            
            <div class="card" style="margin-top: 1.5rem; background-color: rgba(245, 158, 11, 0.1);">
                <h3>API Key Security Notes</h3>
                <ul style="list-style-type: disc; margin-left: 1.5rem;">
                    <li>API keys are stored in environment variables on the server</li>
                    <li>Keys are never exposed in client-side code or stored in browser storage</li>
                    <li>For production, set keys through Docker environment variables or .env files</li>
                    <li>If running this app in a shared environment, ensure proper access controls</li>
                </ul>
            </div>
        </div>
    </div>

    <script>
        // Configuration
        const API_BASE_URL = window.location.origin;
        const WS_BASE_URL = window.location.origin.replace(/^http/, 'ws');
        let socket = null;
        let graphData = { nodes: [], edges: [] };

        // DOM Elements
        const elements = {
            tabs: document.querySelectorAll('.tab'),
            tabContents: document.querySelectorAll('.tab-content'),
            websocketStatus: document.getElementById('websocketStatus'),
            contentText: document.getElementById('contentText'),
            analyzeButton: document.getElementById('analyzeButton'),
            extractedEntities: document.getElementById('extractedEntities'),
            extractedRelationships: document.getElementById('extractedRelationships'),
            nodeLabel: document.getElementById('nodeLabel'),
            nodeType: document.getElementById('nodeType'),
            createNodeButton: document.getElementById('createNodeButton'),
            sourceNodeId: document.getElementById('sourceNodeId'),
            relationshipLabel: document.getElementById('relationshipLabel'),
            targetNodeId: document.getElementById('targetNodeId'),
            createRelationshipButton: document.getElementById('createRelationshipButton'),
            refreshGraphButton: document.getElementById('refreshGraphButton'),
            expandGraphButton: document.getElementById('expandGraphButton'),
            clusterGraphButton: document.getElementById('clusterGraphButton'),
            exportGraphButton: document.getElementById('exportGraphButton'),
            runSuggestionButton: document.getElementById('runSuggestionButton'),
            apiResponse: document.getElementById('apiResponse'),
            analysisStatusMessage: document.getElementById('analysisStatusMessage'),
            // Settings elements
            openaiApiKey: document.getElementById('openaiApiKey'),
            anthropicApiKey: document.getElementById('anthropicApiKey'),
            openaiKeyStatus: document.getElementById('openaiKeyStatus'),
            anthropicKeyStatus: document.getElementById('anthropicKeyStatus'),
            saveApiKeysButton: document.getElementById('saveApiKeysButton'),
            checkApiKeysButton: document.getElementById('checkApiKeysButton'),
            apiKeyStatusMessage: document.getElementById('apiKeyStatusMessage')
        };

        // Tab navigation
        elements.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.getAttribute('data-tab');
                
                // Set active tab
                elements.tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Set active tab content
                elements.tabContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.id === tabId) {
                        content.classList.add('active');
                    }
                });

                // If graph tab, refresh graph
                if (tabId === 'graph-view') {
                    fetchGraphData();
                }
            });
        });

        // WebSocket Connection
        function setupWebSocket() {
            try {
                socket = new WebSocket(`${WS_BASE_URL}/api/ws`);
                
                socket.onopen = () => {
                    console.log("WebSocket connection established");
                    elements.websocketStatus.textContent = "WebSocket: Connected";
                    elements.websocketStatus.classList.remove('ws-disconnected');
                    elements.websocketStatus.classList.add('ws-connected');
                };
                
                socket.onmessage = (event) => {
                    try {
                        // Check if it's a welcome message (non-JSON)
                        if (event.data.startsWith("Connected")) {
                            console.log("WebSocket connection established: " + event.data);
                            return;
                        }
                        
                        // Try to parse as JSON
                        const data = JSON.parse(event.data);
                        console.log("WebSocket message received:", data);
                        
                        if (data.type === 'graph_update') {
                            fetchGraphData();
                            showStatusMessage("Graph updated successfully", "success");
                        } else if (data.type === 'analysis_complete') {
                            showStatusMessage("Analysis complete", "success");
                            fetchGraphData();
                        }
                        
                        // Update API response area
                        elements.apiResponse.textContent = JSON.stringify(data, null, 2);
                    } catch (error) {
                        console.log("Received non-JSON message:", event.data);
                    }
                };
                
                socket.onclose = () => {
                    console.log("WebSocket connection closed");
                    elements.websocketStatus.textContent = "WebSocket: Disconnected";
                    elements.websocketStatus.classList.remove('ws-connected');
                    elements.websocketStatus.classList.add('ws-disconnected');
                    
                    // Attempt to reconnect after delay
                    setTimeout(setupWebSocket, 3000);
                };
                
                socket.onerror = (error) => {
                    console.error("WebSocket error:", error);
                    elements.websocketStatus.textContent = "WebSocket: Error";
                    elements.websocketStatus.classList.remove('ws-connected');
                    elements.websocketStatus.classList.add('ws-disconnected');
                };
            } catch (error) {
                console.error("WebSocket setup error:", error);
            }
        }

        // API Functions
        async function fetchGraphData() {
            try {
                const response = await fetch(`${API_BASE_URL}/api/graph`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                
                // Prepare the edges for D3.js
                // D3 expects edges with source/target as references or ids
                data.edges = data.edges.map(edge => ({
                    ...edge,
                    // Make sure these are understood by D3
                    source: edge.sourceId,
                    target: edge.targetId,
                    // Additional metadata for visualization
                    value: edge.weight || 1
                }));
                
                graphData = data;
                
                // Update UI elements
                renderGraphData();
                updateNodesList();
                
                return data;
            } catch (error) {
                console.error("Error fetching graph data:", error);
                elements.apiResponse.textContent = `Error: ${error.message}`;
            }
        }

        async function analyzeContent(text) {
            try {
                showAnalysisStatus("Analyzing content...", "processing");
                const response = await fetch(`${API_BASE_URL}/api/graph/analyze`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ text }),
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                elements.apiResponse.textContent = JSON.stringify(data, null, 2);
                
                showAnalysisStatus("Analysis complete!", "success");
                
                // Display extracted entities and relationships
                if (data.entities) {
                    elements.extractedEntities.innerHTML = data.entities.map(entity => 
                        `<div class="tag">${entity.label} (${entity.type})</div>`
                    ).join('');
                }
                
                if (data.relationships) {
                    elements.extractedRelationships.innerHTML = data.relationships.map(rel => 
                        `<div class="tag">${rel.source} ${rel.label} ${rel.target}</div>`
                    ).join('');
                }
                
                // Fetch updated graph data
                fetchGraphData();
                
                return data;
            } catch (error) {
                console.error("Error analyzing content:", error);
                elements.apiResponse.textContent = `Error: ${error.message}`;
                showAnalysisStatus(`Error: ${error.message}`, "error");
            }
        }

        async function createNode(nodeData) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/graph/nodes`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(nodeData),
                });
                
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                elements.apiResponse.textContent = JSON.stringify(data, null, 2);
                
                // Fetch updated graph data
                fetchGraphData();
                
                showStatusMessage("Node created successfully", "success");
                return data;
            } catch (error) {
                console.error("Error creating node:", error);
                elements.apiResponse.textContent = `Error: ${error.message}`;
                showStatusMessage(`Error: ${error.message}`, "error");
            }
        }

        async function createRelationship(relationshipData) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/graph/edges`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(relationshipData),
                });
                
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                elements.apiResponse.textContent = JSON.stringify(data, null, 2);
                
                // Fetch updated graph data
                fetchGraphData();
                
                showStatusMessage("Relationship created successfully", "success");
                return data;
            } catch (error) {
                console.error("Error creating relationship:", error);
                elements.apiResponse.textContent = `Error: ${error.message}`;
                showStatusMessage(`Error: ${error.message}`, "error");
            }
        }

        async function expandGraph() {
            try {
                const response = await fetch(`${API_BASE_URL}/api/graph/expand`, {
                    method: 'POST',
                });
                
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                elements.apiResponse.textContent = JSON.stringify(data, null, 2);
                
                showStatusMessage("Graph expansion initiated", "success");
                return data;
            } catch (error) {
                console.error("Error expanding graph:", error);
                elements.apiResponse.textContent = `Error: ${error.message}`;
                showStatusMessage(`Error: ${error.message}`, "error");
            }
        }

        async function generateSuggestions() {
            try {
                const response = await fetch(`${API_BASE_URL}/api/graph/suggestions`, {
                    method: 'GET',
                });
                
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                elements.apiResponse.textContent = JSON.stringify(data, null, 2);
                
                showStatusMessage("Suggestions generated successfully", "success");
                return data;
            } catch (error) {
                console.error("Error generating suggestions:", error);
                elements.apiResponse.textContent = `Error: ${error.message}`;
                showStatusMessage(`Error: ${error.message}`, "error");
            }
        }

        async function exportGraph() {
            try {
                const data = await fetchGraphData();
                const jsonString = JSON.stringify(data, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = `knowledge-graph-export-${new Date().toISOString().slice(0, 10)}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                showStatusMessage("Graph exported successfully", "success");
            } catch (error) {
                console.error("Error exporting graph:", error);
                showStatusMessage(`Error: ${error.message}`, "error");
            }
        }

        // UI Helper Functions
        function renderGraphData() {
            const graphDiv = document.getElementById('graphVisualization');
            
            // Clear previous visualization
            graphDiv.innerHTML = '';
            
            if (!graphData.nodes || !graphData.edges || graphData.nodes.length === 0) {
                graphDiv.innerHTML = `<p style="padding: 20px; text-align: center;">No graph data available. Add some nodes and edges first.</p>`;
                return;
            }
            
            // Set up the D3.js visualization
            const width = graphDiv.clientWidth;
            const height = 400;
            
            // Create SVG container
            const svg = d3.select(graphDiv)
                .append("svg")
                .attr("width", width)
                .attr("height", height)
                .attr("viewBox", [0, 0, width, height])
                .attr("style", "max-width: 100%; height: auto;");
            
            // Create a group for zoom/pan
            const g = svg.append("g");
            
            // Add zoom behavior
            const zoom = d3.zoom()
                .scaleExtent([0.1, 4])
                .on("zoom", (event) => {
                    g.attr("transform", event.transform);
                });
            
            svg.call(zoom);
            
            // Create the simulation
            const simulation = d3.forceSimulation(graphData.nodes)
                .force("link", d3.forceLink(graphData.edges)
                    .id(d => d.id)
                    .distance(100))
                .force("charge", d3.forceManyBody().strength(-200))
                .force("center", d3.forceCenter(width / 2, height / 2))
                .force("collide", d3.forceCollide(30));
            
            // Draw edges first (so they're behind nodes)
            const link = g.append("g")
                .selectAll("line")
                .data(graphData.edges)
                .enter()
                .append("line")
                .attr("class", "link");
            
            // Add edge labels
            const edgeLabels = g.append("g")
                .selectAll("text")
                .data(graphData.edges)
                .enter()
                .append("text")
                .attr("class", "link-label")
                .text(d => d.label);
            
            // Draw nodes
            const nodeRadius = 20;
            const node = g.append("g")
                .selectAll("circle")
                .data(graphData.nodes)
                .enter()
                .append("circle")
                .attr("class", "node")
                .attr("r", nodeRadius)
                .attr("fill", d => {
                    // Color nodes by type
                    switch(d.type) {
                        case 'concept': return '#4f46e5'; // purple
                        case 'person': return '#ef4444';  // red
                        case 'organization': return '#f59e0b'; // yellow
                        case 'location': return '#10b981'; // green
                        default: return '#3b82f6'; // blue
                    }
                });
            
            // Add node labels
            const nodeLabels = g.append("g")
                .selectAll("text")
                .data(graphData.nodes)
                .enter()
                .append("text")
                .attr("class", "node-label")
                .attr("dy", "0.35em")
                .text(d => d.label);
            
            // Add hover effects
            node.on("mouseover", function(event, d) {
                d3.select(this).attr("stroke", "#000").attr("stroke-width", 2);
            }).on("mouseout", function() {
                d3.select(this).attr("stroke", "#fff").attr("stroke-width", 1);
            });
            
            // Add drag behavior to nodes
            node.call(d3.drag()
                .on("start", dragStarted)
                .on("drag", dragged)
                .on("end", dragEnded));
            
            // Update positions on simulation tick
            simulation.on("tick", () => {
                link
                    .attr("x1", d => d.source.x)
                    .attr("y1", d => d.source.y)
                    .attr("x2", d => d.target.x)
                    .attr("y2", d => d.target.y);
                
                edgeLabels
                    .attr("x", d => (d.source.x + d.target.x) / 2)
                    .attr("y", d => (d.source.y + d.target.y) / 2);
                
                node
                    .attr("cx", d => d.x = Math.max(nodeRadius, Math.min(width - nodeRadius, d.x)))
                    .attr("cy", d => d.y = Math.max(nodeRadius, Math.min(height - nodeRadius, d.y)));
                
                nodeLabels
                    .attr("x", d => d.x)
                    .attr("y", d => d.y);
            });
            
            // Drag functions
            function dragStarted(event) {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                event.subject.fx = event.subject.x;
                event.subject.fy = event.subject.y;
            }
            
            function dragged(event) {
                event.subject.fx = event.x;
                event.subject.fy = event.y;
            }
            
            function dragEnded(event) {
                if (!event.active) simulation.alphaTarget(0);
                event.subject.fx = null;
                event.subject.fy = null;
            }
            
            // Apply a gentle initial force to spread out nodes
            simulation.alpha(0.3).restart();
        }

        function updateNodesList() {
            // This would be expanded in a real application
            console.log("Nodes list updated:", graphData.nodes);
        }

        function showStatusMessage(message, type) {
            const statusElement = document.createElement('div');
            statusElement.id = 'tempStatusMessage';
            statusElement.className = type === 'success' ? 'status-success' : 'status-error';
            statusElement.style.padding = '1rem';
            statusElement.style.marginTop = '1rem';
            statusElement.style.borderRadius = '0.375rem';
            statusElement.textContent = message;
            
            // Remove any existing status messages
            const existingStatus = document.getElementById('tempStatusMessage');
            if (existingStatus) {
                existingStatus.remove();
            }
            
            // Add the new status message
            document.body.appendChild(statusElement);
            
            // Remove after 5 seconds
            setTimeout(() => {
                const tempStatus = document.getElementById('tempStatusMessage');
                if (tempStatus) {
                    tempStatus.remove();
                }
            }, 5000);
        }

        function showAnalysisStatus(message, type) {
            const statusElement = elements.analysisStatusMessage;
            statusElement.textContent = message;
            statusElement.className = 'status-message';
            
            if (type === 'success') {
                statusElement.classList.add('status-success');
            } else if (type === 'error') {
                statusElement.classList.add('status-error');
            } else {
                statusElement.style.display = 'block';
                statusElement.style.backgroundColor = 'rgba(79, 70, 229, 0.1)';
                statusElement.style.border = '1px solid var(--secondary)';
                statusElement.style.color = 'var(--secondary)';
            }
            
            // For processing or error, we leave it visible
            if (type === 'success') {
                // Remove success messages after 5 seconds
                setTimeout(() => {
                    statusElement.textContent = '';
                    statusElement.className = 'status-message';
                    statusElement.style.display = 'none';
                }, 5000);
            }
        }

        // Event Listeners
        elements.analyzeButton.addEventListener('click', () => {
            const text = elements.contentText.value.trim();
            if (text.length > 0) {
                analyzeContent(text);
            } else {
                showStatusMessage("Please enter text to analyze", "error");
            }
        });

        elements.createNodeButton.addEventListener('click', () => {
            const label = elements.nodeLabel.value.trim();
            const type = elements.nodeType.value.trim() || 'concept';
            
            if (label.length > 0) {
                createNode({ label, type });
                // Clear input fields
                elements.nodeLabel.value = '';
                elements.nodeType.value = '';
            } else {
                showStatusMessage("Please enter a node label", "error");
            }
        });

        elements.createRelationshipButton.addEventListener('click', () => {
            const sourceId = parseInt(elements.sourceNodeId.value.trim());
            const targetId = parseInt(elements.targetNodeId.value.trim());
            const label = elements.relationshipLabel.value.trim() || 'related_to';
            
            if (!isNaN(sourceId) && !isNaN(targetId)) {
                createRelationship({ 
                    sourceId, 
                    targetId, 
                    label
                });
                // Clear input fields
                elements.sourceNodeId.value = '';
                elements.targetNodeId.value = '';
                elements.relationshipLabel.value = '';
            } else {
                showStatusMessage("Please enter valid source and target node IDs", "error");
            }
        });

        elements.refreshGraphButton.addEventListener('click', () => {
            fetchGraphData();
        });

        elements.expandGraphButton.addEventListener('click', () => {
            expandGraph();
        });

        elements.clusterGraphButton.addEventListener('click', () => {
            showStatusMessage("Clustering functionality is part of the full application", "success");
        });

        elements.exportGraphButton.addEventListener('click', () => {
            exportGraph();
        });

        elements.runSuggestionButton.addEventListener('click', () => {
            generateSuggestions();
        });

        // Settings API key management
        elements.saveApiKeysButton.addEventListener('click', async () => {
            const openaiKey = elements.openaiApiKey.value.trim();
            const anthropicKey = elements.anthropicApiKey.value.trim();
            
            if (!openaiKey && !anthropicKey) {
                showSettingsStatusMessage("Please provide at least one API key", "error");
                return;
            }
            
            try {
                const response = await fetch(`${API_BASE_URL}/api/settings/keys`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        openai_api_key: openaiKey || null,
                        anthropic_api_key: anthropicKey || null
                    }),
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                showSettingsStatusMessage("API keys saved successfully", "success");
                checkApiKeyStatus();
            } catch (error) {
                console.error("Error saving API keys:", error);
                showSettingsStatusMessage(`Error: ${error.message}`, "error");
            }
        });
        
        elements.checkApiKeysButton.addEventListener('click', () => {
            checkApiKeyStatus();
        });
        
        async function checkApiKeyStatus() {
            try {
                const response = await fetch(`${API_BASE_URL}/api/health`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                
                const data = await response.json();
                
                // Update OpenAI key status
                if (data.openai_api) {
                    elements.openaiKeyStatus.textContent = "✅ OpenAI API key is valid";
                    elements.openaiKeyStatus.className = "key-status key-valid";
                } else {
                    elements.openaiKeyStatus.textContent = "❌ No OpenAI API key configured";
                    elements.openaiKeyStatus.className = "key-status key-invalid";
                }
                
                // Update Anthropic key status
                if (data.anthropic_api) {
                    elements.anthropicKeyStatus.textContent = "✅ Anthropic API key is valid";
                    elements.anthropicKeyStatus.className = "key-status key-valid";
                } else {
                    elements.anthropicKeyStatus.textContent = "❌ No Anthropic API key configured";
                    elements.anthropicKeyStatus.className = "key-status key-invalid";
                }
                
                showSettingsStatusMessage("API key status updated", "success");
            } catch (error) {
                console.error("Error checking API keys:", error);
                showSettingsStatusMessage(`Error: ${error.message}`, "error");
            }
        }
        
        function showSettingsStatusMessage(message, type) {
            const statusElement = elements.apiKeyStatusMessage;
            statusElement.textContent = message;
            statusElement.className = type === 'success' ? 'status-success' : 'status-error';
            
            // Clear the message after 5 seconds for success messages
            if (type === 'success') {
                setTimeout(() => {
                    statusElement.textContent = '';
                    statusElement.className = '';
                }, 5000);
            }
        }

        // Initialize application
        document.addEventListener('DOMContentLoaded', () => {
            setupWebSocket();
            fetchGraphData();
            checkApiKeyStatus();
        });
    </script>
</body>
</html>
"""

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    try:
        logger.info("Starting FastAPI application...")
        logger.info("Initializing database...")
        await init_db()
        logger.info("Database initialization complete")

        logger.info("Initializing graph manager...")
        await graph_manager.initialize()
        logger.info("Graph manager initialization complete")

        yield
    except Exception as e:
        logger.error(f"Startup error: {str(e)}", exc_info=True)
        raise
    finally:
        logger.info("Cleaning up resources...")
        await cleanup_pool()
        logger.info("Cleanup complete")

app = FastAPI(
    title="Knowledge Graph API",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors."""
    errors = []
    for error in exc.errors():
        if error["type"] == "missing":
            if "text" in str(error["loc"]):
                errors.append({
                    "loc": error["loc"],
                    "msg": "text field is required",
                    "type": "value_error.missing"
                })
            else:
                errors.append(error)
        else:
            errors.append(error)

    logger.error(f"Validation error: {errors}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": errors}
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions."""
    logger.error(f"HTTP error: {exc.status_code} - {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions."""
    logger.error(f"Unhandled error: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

# Define the main explorer route first to ensure it has priority
@app.get("/explorer", response_class=HTMLResponse, include_in_schema=False)
async def serve_explorer():
    """Serve the Knowledge Explorer HTML interface directly from memory."""
    logger.info("Serving Knowledge Explorer from embedded HTML")
    return HTMLResponse(content=KNOWLEDGE_EXPLORER_HTML)

# Include API routers
app.include_router(graph.router, prefix="/api")
app.include_router(suggestions.router, prefix="/api")
app.include_router(websocket.router, prefix="/api")
logger.info(f"WebSocket router included with prefix: /api (full path: /api/ws)")
app.include_router(debug_router)

# Add root redirect to explorer
@app.get("/", include_in_schema=False)
async def root_redirect():
    """Redirect root URL to Knowledge Explorer."""
    logger.info("Root URL accessed, redirecting to Knowledge Explorer")
    return RedirectResponse(url="/explorer")

# Define API endpoints
@app.get("/api")
async def root():
    """Root endpoint that provides API information"""
    logger.info("Handling request to API root endpoint")
    return {
        "message": "Knowledge Graph API Server",
        "version": "1.0",
        "endpoints": {
            "/api": "This information",
            "/api/health": "Health check",
            "/api/graph": "Graph data and operations",
            "/api/graph/analyze": "Content analysis endpoint",
            "/api/graph/suggestions": "Graph relationship suggestions",
            "/api/ws": "WebSocket endpoint for real-time updates"
        }
    }

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    logger.info("Handling health check request")
    return {
        "status": "healthy",
        "anthropic_api": bool(os.environ.get('ANTHROPIC_API_KEY')),
        "openai_api": bool(os.environ.get('OPENAI_API_KEY'))
    }

class ApiKeyUpdateRequest(BaseModel):
    """Request model for API key updates."""
    openai_api_key: str = None
    anthropic_api_key: str = None

@app.post("/api/settings/keys")
async def update_api_keys(request: ApiKeyUpdateRequest):
    """Update API keys in the environment variables."""
    try:
        logger.info("Handling API key update request")
        
        # Check if either key is provided
        if not request.openai_api_key and not request.anthropic_api_key:
            raise HTTPException(
                status_code=400,
                detail="At least one API key must be provided"
            )
        
        # Update environment variables
        env_file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
        env_vars = {}
        
        # Read existing .env file if it exists
        if os.path.exists(env_file_path):
            with open(env_file_path, 'r') as f:
                for line in f:
                    if '=' in line and not line.startswith('#'):
                        key, value = line.strip().split('=', 1)
                        env_vars[key] = value
        
        # Update with new values
        if request.openai_api_key:
            env_vars['OPENAI_API_KEY'] = request.openai_api_key
            os.environ['OPENAI_API_KEY'] = request.openai_api_key
        
        if request.anthropic_api_key:
            env_vars['ANTHROPIC_API_KEY'] = request.anthropic_api_key
            os.environ['ANTHROPIC_API_KEY'] = request.anthropic_api_key
        
        # Write back to .env file
        with open(env_file_path, 'w') as f:
            for key, value in env_vars.items():
                f.write(f"{key}={value}\n")
        
        logger.info("API keys updated successfully")
        return {"message": "API keys updated successfully"}
    except HTTPException as http_ex:
        logger.error(f"HTTP error in update_api_keys: {http_ex.detail}")
        raise
    except Exception as e:
        logger.error(f"Error in update_api_keys: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.post("/api/graph/analyze")
async def analyze_content_endpoint(request: ContentAnalysisRequest):
    """Content analysis endpoint."""
    try:
        from server.semantic_analysis import analyze_content
        # Check either Anthropic or OpenAI key is available
        if not os.getenv("ANTHROPIC_API_KEY") and not os.getenv("OPENAI_API_KEY"):
            raise HTTPException(
                status_code=400,
                detail="No API keys configured. Set either ANTHROPIC_API_KEY or OPENAI_API_KEY"
            )
        # Use model_dump() for Pydantic v2 compatibility instead of dict()
        if hasattr(request, "model_dump"):
            request_data = request.model_dump()
        else:
            request_data = request.dict()
            
        result = await analyze_content(request_data)
        return result
    except HTTPException as http_ex:
        logger.error(f"HTTP error in analyze_content: {http_ex.detail}")
        raise
    except Exception as e:
        logger.error(f"Error in analyze_content: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

# WebSocket connections store
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("Client connected")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info("Client disconnected")

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

    async def broadcast_json(self, data):
        for connection in self.active_connections:
            await connection.send_json(data)

manager = ConnectionManager()

# WebSocket endpoint moved to routes/websocket.py

# Mount static files last to avoid conflicts with API routes
# Check if frontend/dist exists before mounting
dist_path = pathlib.Path(__file__).parent.parent / "frontend" / "dist"
if dist_path.exists():
    app.mount("/app", StaticFiles(directory=str(dist_path), html=True), name="frontend")
    logger.info(f"Mounted frontend static files from {dist_path} at /app")
else:
    logger.warning("Frontend build directory not found. Static files will not be served.")