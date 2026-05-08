import type * as React from "react";
import { cn } from "../../lib/utils.js";

export type StickyBidBarProps = {
  children: React.ReactNode;
  className?: string;
  /** Extra classes on the inner constrained row */
  innerClassName?: string;
};

/** Fixed bottom marketing / bid bar with safe-area padding (mobile-first; hide at `lg` via className from caller).
 */
export function StickyBidBar({ children, className, innerClassName }: StickyBidBarProps) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/25 bg-surface-container-lowest/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgba(0,0,0,0.12)] backdrop-blur-md dark:border-outline-variant/20 dark:shadow-[0_-12px_40px_rgba(0,0,0,0.45)]",
        className,
      )}
    >
      <div
        className={cn("mx-auto flex max-w-xl items-center justify-between gap-3", innerClassName)}
      >
        {children}
      </div>
    </div>
  );
}
