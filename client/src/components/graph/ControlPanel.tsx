import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { expandGraph, reconnectNodes, reapplyClustering } from "@/lib/graph";
import { queryClient } from "@/lib/queryClient";

export function ControlPanel() {
  const [input, setInput] = useState("");

  // Combined mutation for both expand and analyze
  const graphMutation = useMutation({
    mutationFn: async (content: string) => {
      // If input is short, treat as expansion prompt
      // If longer, treat as semantic analysis content
      const isAnalysis = content.split(" ").length > 10;

      if (isAnalysis) {
        const response = await fetch("/api/graph/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      } else {
        return expandGraph(content);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/graph"] });
      setInput("");
    },
    onError: (error) => {
      console.error("Failed to process input:", error);
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

  const isLongInput = input.split(" ").length > 10;
  const actionLabel = isLongInput ? "Analyze Content" : "Expand Graph";

  return (
    <Card className="w-full">
      <CardHeader>
        <h2 className="text-xl font-semibold">Graph Control</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            placeholder={isLongInput ? 
              "Enter text content to analyze..." : 
              "Enter a prompt to expand the graph..."
            }
            className="min-h-[100px] resize-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={graphMutation.isPending}
          />
          <Button
            className="w-full"
            onClick={() => graphMutation.mutate(input)}
            disabled={!input || graphMutation.isPending}
          >
            {graphMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              actionLabel
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
              "Reconnect Nodes"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}