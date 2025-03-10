import { type GraphData } from "@shared/schema";

interface MetricsPanelProps {
  data: GraphData;
}

export function MetricsPanel({ data }: MetricsPanelProps) {
  // Handle case when metrics might be undefined
  if (!data.metrics) {
    return (
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-xl font-semibold">Graph Metrics</h2>
        <p className="text-gray-500 mt-2">No metrics available yet.</p>
      </div>
    );
  }

  const getTopNodes = (metric: Record<string, number>, count: number = 5) => {
    return Object.entries(metric)
      .sort(([, a], [, b]) => b - a)
      .slice(0, count)
      .map(([id, value]) => ({
        node: data.nodes.find(n => n.id === parseInt(id)),
        value: parseFloat(value.toFixed(3))
      }));
  };

  return (
    <div className="bg-white p-4 rounded shadow w-full">
      <h2 className="text-xl font-semibold mb-4">Graph Metrics</h2>
      <div className="space-y-8">
        {/* Scale-free Network Properties */}
        <div>
          <h3 className="text-lg font-medium mb-2">Scale-free Network Properties</h3>
          <div className="space-y-2">
            <div className="px-2 py-1 bg-gray-100 rounded">
              <span className="font-medium">Power Law Exponent: </span>
              <span className="text-gray-600">
                {data.metrics.scaleFreeness.powerLawExponent.toFixed(3)}
              </span>
            </div>
            <div className="px-2 py-1 bg-gray-100 rounded">
              <span className="font-medium">Fit Quality (R²): </span>
              <span className="text-gray-600">
                {data.metrics.scaleFreeness.fitQuality.toFixed(3)}
              </span>
            </div>
          </div>
        </div>

        {/* Hub Nodes */}
        <div>
          <h3 className="text-lg font-medium mb-2">Hub Nodes</h3>
          <ul className="space-y-2">
            {data.metrics.scaleFreeness.hubNodes.map(hub => {
              const node = data.nodes.find(n => n.id === hub.id);
              return (
                <li key={hub.id} className="flex justify-between items-center text-sm px-2 py-1 bg-gray-100 rounded">
                  <span className="font-medium">{node?.label || `Node ${hub.id}`}</span>
                  <div className="flex gap-4">
                    <span className="text-gray-600">Degree: {hub.degree}</span>
                    <span className="text-gray-600">Influence: {hub.influence.toFixed(3)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Bridging Nodes */}
        <div>
          <h3 className="text-lg font-medium mb-2">Bridging Nodes</h3>
          <ul className="space-y-2">
            {data.metrics.scaleFreeness.bridgingNodes.map(bridge => {
              const node = data.nodes.find(n => n.id === bridge.id);
              return (
                <li key={bridge.id} className="flex justify-between items-center text-sm px-2 py-1 bg-gray-100 rounded">
                  <span className="font-medium">{node?.label || `Node ${bridge.id}`}</span>
                  <div className="flex gap-4">
                    <span className="text-gray-600">Communities: {bridge.communities}</span>
                    <span className="text-gray-600">Betweenness: {bridge.betweenness.toFixed(3)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Top nodes by metrics */}
        <div>
          <h3 className="text-lg font-medium mb-2">Top Nodes by Centrality</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="font-medium mb-2">Betweenness</h4>
              <ul className="space-y-1">
                {getTopNodes(data.metrics.betweenness).map(({ node, value }) => (
                  <li key={node?.id} className="flex justify-between text-sm px-2 py-1 bg-gray-100 rounded">
                    <span>{node?.label || 'Unknown'}</span>
                    <span className="text-gray-600">{value}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Eigenvector</h4>
              <ul className="space-y-1">
                {getTopNodes(data.metrics.eigenvector).map(({ node, value }) => (
                  <li key={node?.id} className="flex justify-between text-sm px-2 py-1 bg-gray-100 rounded">
                    <span>{node?.label || 'Unknown'}</span>
                    <span className="text-gray-600">{value}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Degree</h4>
              <ul className="space-y-1">
                {getTopNodes(data.metrics.degree).map(({ node, value }) => (
                  <li key={node?.id} className="flex justify-between text-sm px-2 py-1 bg-gray-100 rounded">
                    <span>{node?.label || 'Unknown'}</span>
                    <span className="text-gray-600">{value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}