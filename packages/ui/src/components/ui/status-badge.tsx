import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";
import { cn } from "../../lib/utils.js";

export const statusBadgeVariants = cva(
  "inline-flex items-center justify-center rounded-full font-label font-bold uppercase tracking-widest ring-1 ring-inset",
  {
    variants: {
      variant: {
        neutral: "bg-surface-container-high text-on-surface-variant ring-outline-variant/20",
        info: "bg-primary-container/30 text-on-primary-container ring-primary/25",
        success: "bg-primary-container/25 text-on-primary-container ring-primary/30",
        warning: "bg-primary-fixed/40 text-on-primary-fixed ring-primary-container/40",
        danger: "bg-error/15 text-error ring-error/30",
        live: "bg-live-red/15 text-live-red ring-live-red/40",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px]",
        md: "px-3 py-1.5 text-xs font-semibold",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "sm",
    },
  },
);

export type StatusBadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof statusBadgeVariants> & {
    /** Pulse dot before label (e.g. live auctions). */
    dot?: boolean;
  };

export function StatusBadge({
  className,
  variant,
  size,
  dot,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(statusBadgeVariants({ variant, size }), dot && "gap-1.5", className)}
      {...props}
    >
      {dot ? (
        <span
          className="size-1.5 shrink-0 rounded-full bg-current motion-safe:animate-pulse"
          aria-hidden
        />
      ) : null}
      {children}
    </span>
  );
}
