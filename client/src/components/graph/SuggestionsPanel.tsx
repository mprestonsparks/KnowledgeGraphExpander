import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
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

  const { data: suggestions = [], isLoading } = useQuery({
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
      await queryClient.invalidateQueries({ queryKey: ["/api/graph/suggestions"] });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <h2 className="text-lg font-semibold">Suggested Relationships</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshSuggestions}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Refresh"
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center">
            No suggestions available.
          </p>
        ) : (
          suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.sourceId}-${suggestion.targetId}-${index}`}
              className="space-y-2 p-3 rounded-lg bg-muted/50"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
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
                  onClick={() => applyMutation.mutate(suggestion)}
                  disabled={applyMutation.isPending}
                >
                  {applyMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Apply"
                  )}
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
