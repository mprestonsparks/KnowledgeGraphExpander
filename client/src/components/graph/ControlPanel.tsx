import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { expandGraph, reconnectNodes, reapplyClustering } from "@/lib/graph";
import { queryClient } from "@/lib/queryClient";

export function ControlPanel() {
  const [prompt, setPrompt] = useState("");

  const expandMutation = useMutation({
    mutationFn: expandGraph,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/graph"] });
      setPrompt("");
    }
  });

  const reconnectMutation = useMutation({
    mutationFn: reconnectNodes,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/graph"] });
    }
  });

  const clusterMutation = useMutation({
    mutationFn: reapplyClustering,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/graph"] });
    }
  });

  return (
    <Card className="w-full">
      <CardHeader>
        <h2 className="text-xl font-semibold">Graph Control</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter prompt to expand graph..."
            className="flex-1"
            disabled={expandMutation.isPending}
          />
          <Button 
            onClick={() => expandMutation.mutate(prompt)}
            disabled={!prompt || expandMutation.isPending}
          >
            {expandMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Expand"
            )}
          </Button>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => clusterMutation.mutate()}
            disabled={clusterMutation.isPending}
          >
            {clusterMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Reapply Clustering"
            )}
          </Button>
          <Button
            variant="secondary"
            onClick={() => reconnectMutation.mutate()}
            disabled={reconnectMutation.isPending}
          >
            {reconnectMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Reconnect Disconnected Nodes"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}