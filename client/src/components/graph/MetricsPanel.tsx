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
        value: value.toFixed(3)
      }));
  };

  return (
    <Card className="w-full">
      <CardHeader className="text-lg font-semibold">
        Graph Metrics
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-sm font-medium mb-2">Top Nodes by Betweenness</h3>
          <ul className="space-y-1">
            {getTopNodes(data.metrics.betweenness).map(({ node, value }) => (
              <li key={node?.id} className="text-sm">
                {node?.label} ({value})
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-medium mb-2">Top Nodes by Eigenvector</h3>
          <ul className="space-y-1">
            {getTopNodes(data.metrics.eigenvector).map(({ node, value }) => (
              <li key={node?.id} className="text-sm">
                {node?.label} ({value})
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-medium mb-2">Top Nodes by Degree</h3>
          <ul className="space-y-1">
            {getTopNodes(data.metrics.degree).map(({ node, value }) => (
              <li key={node?.id} className="text-sm">
                {node?.label} ({value})
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
