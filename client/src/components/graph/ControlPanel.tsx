import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { expandGraph } from "@/lib/graph";
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

  return (
    <Card className="w-full">
      <CardHeader>
        <h2 className="text-xl font-semibold">Graph Control</h2>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}