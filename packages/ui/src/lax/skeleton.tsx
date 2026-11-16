import { cn } from "../lib/utils.js";

/** A placeholder bar at the final size of what is loading; hidden from assistive technology. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("lax-skeleton lax-bar", className)} />;
}
