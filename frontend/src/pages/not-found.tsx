import React from "react";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="w-full max-w-md mx-4 rounded-xl border border-border bg-card p-6">
        <div className="flex mb-4 gap-2">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <h1 className="text-2xl font-bold">404 Page Not Found</h1>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          The page you are looking for does not exist or has been moved.
        </p>
      </div>
    </div>
  );
}