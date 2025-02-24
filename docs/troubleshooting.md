# Troubleshooting Guide

## Common Issues and Solutions

### Graph Visualization

#### Colors Not Displaying
**Problem**: Cluster colors are not visible or disappear after loading.
**Solution**:
1. Check browser console for errors
2. Verify cluster data in API response
3. Clear browser cache
4. Ensure proper style application

**Code Check**:
```typescript
// Verify cluster data
console.log('Cluster data:', graph.clusters);

// Check style application
cy.nodes('.clustered').forEach(node => {
  console.log('Node styles:', {
    id: node.id(),
    color: node.data('clusterColor'),
    classes: node.classes()
  });
});
```

#### Layout Issues
**Problem**: Nodes overlap or layout is chaotic.
**Solution**:
1. Adjust layout parameters
2. Increase node spacing
3. Reduce animation speed

### API and Data

#### Failed Graph Expansion
**Problem**: Graph expansion not working.
**Solution**:
1. Check API key validity
2. Verify request format
3. Review server logs
4. Check rate limits

#### Database Connectivity
**Problem**: Database connection errors.
**Solution**:
1. Verify DATABASE_URL
2. Check database status
3. Review connection pool settings
4. Check server logs

### Performance

#### Slow Graph Rendering
**Problem**: Graph becomes slow with many nodes.
**Solution**:
1. Implement pagination
2. Use lazy loading
3. Optimize layout calculations
4. Reduce unnecessary redraws

#### Memory Issues
**Problem**: Browser memory usage grows over time.
**Solution**:
1. Clear unused elements
2. Implement garbage collection
3. Monitor memory usage
4. Reset graph periodically

## Diagnostic Tools

### Frontend Debugging
```typescript
// Add to GraphViewer component
useEffect(() => {
  console.log('Graph state:', {
    nodes: data.nodes.length,
    edges: data.edges.length,
    clusters: data.clusters?.length
  });
}, [data]);
```

### Backend Logging
```typescript
// Add to graph_manager.ts
console.log('Graph operation:', {
  operation: 'expand',
  nodesAdded: newNodes.length,
  edgesAdded: newEdges.length,
  currentSize: this.graph.size
});
```

## Error Messages

### Common Error Codes
- `ERR_CLUSTER_001`: Clustering calculation failed
- `ERR_GRAPH_001`: Graph expansion error
- `ERR_DB_001`: Database connection error
- `ERR_WS_001`: WebSocket connection failed

## Support Resources
- System Logs
- API Documentation
- Component Documentation
- Database Schema
