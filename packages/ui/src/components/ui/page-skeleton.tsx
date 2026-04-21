import * as React from "react";
import { cn } from "../../lib/utils.js";
import { Skeleton } from "./skeleton.js";

export type PageSkeletonVariant = "dashboard" | "table" | "grid";

export type PageSkeletonProps = {
  variant?: PageSkeletonVariant;
  className?: string;
};

export function PageSkeleton({ variant = "dashboard", className }: PageSkeletonProps) {
  if (variant === "table") {
    return (
      <div className={cn("space-y-4", className)} aria-busy="true" aria-label="Loading">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (variant === "grid") {
    return (
      <div className={cn("space-y-8", className)} aria-busy="true" aria-label="Loading">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(["a", "b", "c", "d", "e", "f"] as const).map((k) => (
            <Skeleton key={k} className="aspect-[4/5] w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className={cn("space-y-10", className)} aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-12 w-full max-w-md" />
      <Skeleton className="h-4 w-48" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(["k1", "k2", "k3", "k4"] as const).map((id) => (
          <Skeleton key={id} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
        <div className="space-y-4 lg:col-span-4">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
