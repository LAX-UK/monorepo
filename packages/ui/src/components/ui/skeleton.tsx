import type * as React from "react";
import { cn } from "../../lib/utils.js";

/**
 * A placeholder block at the size of what is loading; hidden from assistive technology. Its
 * motion is the shared `.lax-skeleton` (packages/ui/src/lax/skeleton.css): it appears after 150ms
 * and pulses its opacity, and is static under reduced motion.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("lax-skeleton rounded-md bg-surface-container-high", className)}
      aria-hidden
      {...props}
    />
  );
}

export { Skeleton };
