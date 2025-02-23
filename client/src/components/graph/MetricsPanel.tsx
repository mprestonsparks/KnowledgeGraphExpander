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