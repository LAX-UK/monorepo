import type * as React from "react";
import { cn } from "../../lib/utils.js";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md bg-gradient-to-r from-surface-container-high/60 via-surface-container-high to-surface-container-high/60 bg-[length:200%_100%] motion-safe:animate-[shimmer_1.4s_linear_infinite] motion-reduce:animate-pulse motion-reduce:bg-surface-container-high/60",
        className,
      )}
      aria-hidden
      {...props}
    />
  );
}

export { Skeleton };
