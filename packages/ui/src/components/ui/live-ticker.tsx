"use client";

import type * as React from "react";
import { cn } from "../../lib/utils.js";
import { LiveDot } from "./live-dot.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip.js";

export type LiveTickerProps = {
  /** Short label (truncated with tooltip if long) */
  label: string;
  /** Main numeric or text value */
  value: React.ReactNode;
  className?: string;
};

/** Inline live indicator + value; truncates long labels. */
export function LiveTicker({ label, value, className }: LiveTickerProps) {
  const showTip = label.length > 24;
  const inner = (
    <span className={cn("inline-flex min-w-0 max-w-full items-center gap-1.5", className)}>
      <LiveDot size="sm" />
      <span className="min-w-0 truncate font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      <span className="shrink-0 font-headline text-sm tabular-nums text-on-surface">{value}</span>
    </span>
  );
  if (!showTip) return inner;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
