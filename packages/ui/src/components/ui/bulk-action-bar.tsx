"use client";

import type * as React from "react";
import { cn } from "../../lib/utils.js";

export type BulkActionBarProps = {
  count: number;
  children: React.ReactNode;
  className?: string;
  /** Lift mobile bar above dashboard bottom tab bar / consent offset. */
  offsetBottomChrome?: boolean;
};

/** Desktop: inline bar. Mobile: fixed bottom with safe-area inset.
 */
export function BulkActionBar({
  count,
  children,
  className,
  offsetBottomChrome = false,
}: BulkActionBarProps) {
  if (count <= 0) return null;
  return (
    <>
      <section
        className={cn(
          "hidden items-center justify-between gap-4 rounded-lg border border-primary/25 bg-surface-container-low px-4 py-3 shadow-md md:flex",
          className,
        )}
        aria-label={`${count} selected`}
      >
        <span className="font-label text-xs font-bold uppercase tracking-widest text-on-surface">
          {count} selected
        </span>
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      </section>
      <section
        className={cn(
          "fixed inset-x-0 z-50 flex items-center justify-between gap-3 border-t border-primary/25 bg-surface-container-lowest/98 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] backdrop-blur-md md:hidden",
          offsetBottomChrome
            ? "bottom-[calc(var(--bottom-nav-height,64px)+var(--bottom-tab-bar-bottom,0px))]"
            : "bottom-0",
          className,
        )}
        aria-label={`${count} selected`}
      >
        <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface">
          {count} sel.
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          {children}
        </div>
      </section>
    </>
  );
}
