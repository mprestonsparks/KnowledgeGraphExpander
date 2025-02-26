import React from "react";
import { useQuery } from "@tanstack/react-query";

export default function App() {
  const { data, isLoading } = useQuery({
    queryKey: ["healthCheck"],
    queryFn: async () => {
      const response = await fetch("/api/health");
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-4">Knowledge Graph System</h1>
        <p className="text-gray-600">
          Backend Status: {data?.status || "Not connected"}
        </p>
      </div>
    </div>
  );
}
