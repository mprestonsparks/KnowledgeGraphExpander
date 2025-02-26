import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { type GraphData } from "@shared/schema";

interface MetricsPanelProps {
  data: GraphData;
}

export function MetricsPanel({ data }: MetricsPanelProps) {
  const getTopNodes = (metric: Record<number, number>, count: number = 5) => {
    return Object.entries(metric)
      .sort(([, a], [, b]) => b - a)
      .slice(0, count)
      .map(([id, value]) => ({
        node: data.nodes.find(n => n.id === parseInt(id)),
        value: parseFloat(value.toFixed(3))
      }));
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <h2 className="text-2xl font-semibold">Graph Metrics</h2>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Scale-free Network Properties */}
        <div>
          <h3 className="text-lg font-medium mb-4">Scale-free Network Properties</h3>
          <div className="space-y-3">
            <div className="px-2 py-1 bg-muted/50 rounded">
              <span className="font-medium">Power Law Exponent: </span>
              <span className="text-muted-foreground">
                {data.metrics.scaleFreeness.powerLawExponent.toFixed(3)}
              </span>
            </div>
            <div className="px-2 py-1 bg-muted/50 rounded">
              <span className="font-medium">Fit Quality (R²): </span>
              <span className="text-muted-foreground">
                {data.metrics.scaleFreeness.fitQuality.toFixed(3)}
              </span>
            </div>
          </div>
        </div>

        {/* Hub Nodes */}
        <div>
          <h3 className="text-lg font-medium mb-4">Hub Nodes</h3>
          <ul className="space-y-3">
            {data.metrics.scaleFreeness.hubNodes.map(hub => {
              const node = data.nodes.find(n => n.id === hub.id);
              return (
                <li key={hub.id} className="flex justify-between items-center text-sm px-2 py-1 bg-muted/50 rounded">
                  <span className="font-medium">{node?.label}</span>
                  <div className="flex gap-4">
                    <span className="text-muted-foreground">Degree: {hub.degree}</span>
                    <span className="text-muted-foreground">Influence: {hub.influence.toFixed(3)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Bridging Nodes */}
        <div>
          <h3 className="text-lg font-medium mb-4">Bridging Nodes</h3>
          <ul className="space-y-3">
            {data.metrics.scaleFreeness.bridgingNodes.map(bridge => {
              const node = data.nodes.find(n => n.id === bridge.id);
              return (
                <li key={bridge.id} className="flex justify-between items-center text-sm px-2 py-1 bg-muted/50 rounded">
                  <span className="font-medium">{node?.label}</span>
                  <div className="flex gap-4">
                    <span className="text-muted-foreground">Communities: {bridge.communities}</span>
                    <span className="text-muted-foreground">Betweenness: {bridge.betweenness.toFixed(3)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Centrality Metrics */}
        <div>
          <h3 className="text-lg font-medium mb-4">Top Nodes by Betweenness</h3>
          <ul className="space-y-3">
            {getTopNodes(data.metrics.betweenness).map(({ node, value }) => (
              <li key={node?.id} className="flex justify-between items-center text-sm px-2 py-1 bg-muted/50 rounded">
                <span className="font-medium">{node?.label}</span>
                <span className="text-muted-foreground">{value}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-4">Top Nodes by Eigenvector</h3>
          <ul className="space-y-3">
            {getTopNodes(data.metrics.eigenvector).map(({ node, value }) => (
              <li key={node?.id} className="flex justify-between items-center text-sm px-2 py-1 bg-muted/50 rounded">
                <span className="font-medium">{node?.label}</span>
                <span className="text-muted-foreground">{value}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-4">Top Nodes by Degree</h3>
          <ul className="space-y-3">
            {getTopNodes(data.metrics.degree).map(({ node, value }) => (
              <li key={node?.id} className="flex justify-between items-center text-sm px-2 py-1 bg-muted/50 rounded">
                <span className="font-medium">{node?.label}</span>
                <span className="text-muted-foreground">{value}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}