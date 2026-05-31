"use client";

import type * as React from "react";
import { cn } from "../../lib/utils.js";

export type StatStripProps = {
  children: React.ReactNode;
  /** Sticky below header on wide layouts */
  sticky?: boolean;
  className?: string;
};

/** Responsive KPI row: 2 cols on phones, denser breakpoints from `className`.
 * `sticky` pins below the shell header on `lg+` only.
 * Children are typically `KpiTile` or custom stat cards.
 */
export function StatStrip({ children, sticky, className }: StatStripProps) {
  return (
    <div
      className={cn(
        "grid auto-rows-fr grid-cols-2 items-stretch gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6",
        sticky &&
          "top-0 z-10 border-b border-outline-variant/10 bg-surface/95 py-3 backdrop-blur-sm lg:sticky",
        className,
      )}
    >
      {children}
    </div>
  );
}
