import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Loader2, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface RelationshipSuggestion {
  sourceId: number;
  targetId: number;
  label: string;
  confidence: number;
  explanation: string;
}

async function getSuggestions(): Promise<RelationshipSuggestion[]> {
  const response = await apiRequest("GET", "/api/graph/suggestions");
  return response.json();
}

async function applySuggestion(suggestion: {
  sourceId: number;
  targetId: number;
  label: string;
}) {
  const response = await apiRequest("POST", "/api/graph/suggestions/apply", {
    ...suggestion,
    weight: 1,
  });
  return response.json();
}

export function SuggestionsPanel() {
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: suggestions = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/graph/suggestions"],
    queryFn: getSuggestions,
  });

  const applyMutation = useMutation({
    mutationFn: applySuggestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/graph"] });
      toast({
        title: "Suggestion applied",
        description: "The relationship has been added to the graph.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to apply the suggestion.",
        variant: "destructive",
      });
    },
  });

  const refreshSuggestions = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <h2 className="text-lg font-semibold">Suggested Relationships</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={refreshSuggestions}
          disabled={isLoading || isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No suggestions available. Try refreshing.
          </p>
        ) : (
          <div className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <div
                key={`${suggestion.sourceId}-${suggestion.targetId}-${index}`}
                className="p-3 rounded-lg bg-muted/50 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {suggestion.label}{" "}
                      <span className="text-muted-foreground">
                        ({(suggestion.confidence * 100).toFixed(1)}%)
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {suggestion.explanation}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => applyMutation.mutate(suggestion)}
                    disabled={applyMutation.isPending}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}