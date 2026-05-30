"use client";

import { cn } from "@auction/ui";
import type { ReactNode } from "react";

type Props = {
  className?: string;
  /** When item count meets threshold, applies content-visibility for smoother long mobile lists. */
  virtualizeThreshold?: number;
  itemCount: number;
  children: ReactNode;
};

/**
 * Lightweight list wrapper for catalog mobile card stacks.
 * Uses CSS content-visibility (not windowing) until full virtual scroll is justified.
 */
export function CatalogVirtualizedList({
  className,
  virtualizeThreshold = 48,
  itemCount,
  children,
}: Props) {
  const virtualized = itemCount >= virtualizeThreshold;
  return (
    <ul
      className={cn("space-y-3", virtualized && "catalog-virtualized-list", className)}
      data-virtualized={virtualized ? "true" : undefined}
    >
      {children}
    </ul>
  );
}
