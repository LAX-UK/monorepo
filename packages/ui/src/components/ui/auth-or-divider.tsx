"use client";

import { cn } from "../../lib/utils.js";

export type AuthOrDividerProps = {
  label?: string;
  className?: string;
};

/** Horizontal "or" separator used between social and credential auth flows. */
export function AuthOrDivider({ label = "or", className }: AuthOrDividerProps) {
  return (
    <div className={cn("flex items-center gap-4 text-on-surface-variant", className)} aria-hidden>
      <span className="h-px flex-1 bg-outline-variant/40" />
      <span className="font-footer-links text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]">
        {label}
      </span>
      <span className="h-px flex-1 bg-outline-variant/40" />
    </div>
  );
}
