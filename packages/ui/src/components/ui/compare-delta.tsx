"use client";

import type * as React from "react";
import { cn } from "../../lib/utils.js";

export type CompareDeltaTone = "positive" | "negative" | "neutral";

const toneClass: Record<CompareDeltaTone, string> = {
  positive: "text-lot-orange dark:text-emerald-400",
  negative: "text-live-red",
  neutral: "text-on-surface-variant",
};

export type CompareDeltaProps = {
  /** e.g. "+12%" or "−3" vs prior period */
  label: React.ReactNode;
  tone?: CompareDeltaTone;
  className?: string;
};

export function CompareDelta({ label, tone = "neutral", className }: CompareDeltaProps) {
  return (
    <span className={cn("font-label text-xs font-semibold tabular-nums", toneClass[tone], className)}>
      {label}
    </span>
  );
}
