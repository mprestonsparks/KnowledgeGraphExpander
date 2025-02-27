import type { LucideProps } from 'lucide-react';
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LoadingSpinnerProps {
  className?: string;
}

export function LoadingSpinner({ className }: LoadingSpinnerProps) {
  return (
    <div className="flex items-center justify-center">
      {/* @ts-expect-error - Known issue with Lucide types */}
      <Loader2 className={cn("h-6 w-6 animate-spin", className)} />
    </div>
  );
}