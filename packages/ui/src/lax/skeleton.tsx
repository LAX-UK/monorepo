import { cn } from "../lib/utils.js";

/**
 * A placeholder bar at the final size of what is loading; hidden from assistive technology. It is
 * the shared `.lax-skeleton` (skeleton.css): it appears after 150ms and pulses its opacity.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("lax-skeleton block rounded-lax-badge bg-lax-neutral-bg", className)}
    />
  );
}
