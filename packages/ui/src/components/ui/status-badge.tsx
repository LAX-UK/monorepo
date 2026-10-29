import { type VariantProps, cva } from "class-variance-authority";
import { Check, CircleAlert } from "lucide-react";
import type * as React from "react";
import { cn } from "../../lib/utils.js";

export type StatusBadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "live";

/**
 * The cue drawn before the label, so a status never relies on its colour alone:
 * - `ring` (hollow): not started or inactive;
 * - `dot`: in progress (it pulses on the `live` tone);
 * - `check`: done;
 * - `alert`: blocked or needs attention.
 */
export type StatusBadgeShape = "ring" | "dot" | "check" | "alert";

/**
 * Tint and label colour per tone. The label tokens (`*-on-surface`, `on-success-container`,
 * `on-surface-variant`) are defined by every product theme to reach 4.5:1 on their tint in light
 * and dark; the cue is drawn in the label colour, so it meets the same contrast.
 */
export const STATUS_BADGE_TONE_CLASSES: Readonly<Record<StatusBadgeTone, string>> = {
  neutral: "bg-surface-container-high text-on-surface-variant",
  info: "bg-info-container text-info-on-surface",
  success: "bg-success-container text-on-success-container",
  warning: "bg-warning-container text-warning-on-surface",
  danger: "bg-danger-container text-danger-on-surface",
  live: "bg-danger-container text-danger-on-surface",
};

/** The cue a tone draws when the caller does not name one. */
export const STATUS_BADGE_DEFAULT_SHAPE: Readonly<Record<StatusBadgeTone, StatusBadgeShape>> = {
  neutral: "ring",
  info: "dot",
  success: "check",
  warning: "alert",
  danger: "alert",
  live: "dot",
};

/** One size: 20px tall, 12px sentence-case label at weight 500, full pill. */
export const statusBadgeVariants = cva(
  "inline-flex h-5 w-fit min-w-0 max-w-full shrink-0 items-center gap-1 whitespace-nowrap rounded-full pr-2 pl-1.5 font-label text-xs leading-4 font-medium",
  {
    variants: { variant: STATUS_BADGE_TONE_CLASSES },
    defaultVariants: { variant: "neutral" },
  },
);

const SHAPE_FRAME = "inline-flex size-3.5 shrink-0 items-center justify-center";

function StatusBadgeCue({ shape, pulse }: { shape: StatusBadgeShape; pulse: boolean }) {
  switch (shape) {
    case "ring":
      return (
        <span className={SHAPE_FRAME} aria-hidden data-shape="ring">
          <span className="size-2 rounded-full border-[1.5px] border-current" />
        </span>
      );
    case "dot":
      return (
        <span className={SHAPE_FRAME} aria-hidden data-shape="dot">
          <span
            className={cn("size-1.5 rounded-full bg-current", pulse && "motion-safe:animate-pulse")}
          />
        </span>
      );
    case "check":
      return (
        <span className={SHAPE_FRAME} aria-hidden data-shape="check">
          <Check className="size-3.5" strokeWidth={2.25} />
        </span>
      );
    case "alert":
      return (
        <span className={SHAPE_FRAME} aria-hidden data-shape="alert">
          <CircleAlert className="size-3.5" strokeWidth={2} />
        </span>
      );
  }
}

export type StatusBadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof statusBadgeVariants> & {
    /** Overrides the tone's default cue (see `StatusBadgeShape`). */
    shape?: StatusBadgeShape;
  };

/**
 * A status as a tinted pill: tone, cue and words together. Labels are written in sentence case
 * by the caller's status map; the badge never transforms case. For counts, use a count pill.
 */
export function StatusBadge({ className, variant, shape, children, ...props }: StatusBadgeProps) {
  const tone = variant ?? "neutral";
  return (
    <span
      className={cn(statusBadgeVariants({ variant: tone }), className)}
      data-tone={tone}
      {...props}
    >
      <StatusBadgeCue shape={shape ?? STATUS_BADGE_DEFAULT_SHAPE[tone]} pulse={tone === "live"} />
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}
