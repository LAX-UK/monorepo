import { cva } from "class-variance-authority";
import { Check, CircleAlert } from "lucide-react";
import type * as React from "react";
import { cn } from "../../lib/utils.js";

export type StatusBadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "live";

/**
 * The cue drawn before the label, so a status never relies on its colour alone:
 * - `ring` (hollow): not started or inactive;
 * - `dot`: in progress (it pulses when the badge is live);
 * - `check`: done;
 * - `alert`: blocked or needs attention.
 */
export type StatusBadgeShape = "ring" | "dot" | "check" | "alert";

/**
 * Tint and label colour per tone: the LAX status palette (`--lax-<tone>-bg` and `-fg`), one for
 * Bid, the client workspace and both staff tools, whose text meets 4.5:1 on its tint in light and
 * dark (packages/branding/tests/lax-system.test.ts). A product that does not load the LAX system
 * (Shop, LAX Account) falls back to its own theme's status tokens. `live` is a solid fill, so
 * something happening now never reads as the tinted danger of a failed record.
 */
export const STATUS_BADGE_TONE_CLASSES: Readonly<Record<StatusBadgeTone, string>> = {
  neutral:
    "bg-[var(--lax-neutral-bg,var(--color-surface-container-high))] text-[var(--lax-neutral-fg,var(--color-on-surface-variant))]",
  info: "bg-[var(--lax-info-bg,var(--color-info-container))] text-[var(--lax-info-fg,var(--color-info-on-surface))]",
  success:
    "bg-[var(--lax-success-bg,var(--color-success-container))] text-[var(--lax-success-fg,var(--color-on-success-container))]",
  warning:
    "bg-[var(--lax-warning-bg,var(--color-warning-container))] text-[var(--lax-warning-fg,var(--color-warning-on-surface))]",
  danger:
    "bg-[var(--lax-danger-bg,var(--color-danger-container))] text-[var(--lax-danger-fg,var(--color-danger-on-surface))]",
  live: "bg-[var(--lax-live-bg,var(--color-danger-container))] text-[var(--lax-on-live,var(--color-danger-on-surface))]",
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

/**
 * One size: 20px tall, 12/16 sentence-case label at weight 500. The corner is the LAX badge
 * radius (4px) wherever the LAX system is loaded, and a pill elsewhere.
 */
export const statusBadgeVariants = cva(
  "inline-flex h-5 w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-[var(--lax-radius-badge,9999px)] pr-2 pl-1.5 align-middle font-label text-xs leading-4 font-medium",
  {
    variants: { tone: STATUS_BADGE_TONE_CLASSES },
    defaultVariants: { tone: "neutral" },
  },
);

const SHAPE_FRAME = "inline-flex size-3.5 shrink-0 items-center justify-center";

function StatusBadgeCue({
  shape,
  pulse,
  liveDot,
}: {
  shape: StatusBadgeShape;
  pulse: boolean;
  /** A tinted badge that is live shows the live red dot; the solid live badge keeps its own. */
  liveDot: boolean;
}) {
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
            className={cn(
              "size-1.5 rounded-full bg-current",
              liveDot && "bg-[var(--lax-live-dot,currentColor)]",
              pulse && "motion-safe:animate-pulse",
            )}
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

export type StatusBadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: StatusBadgeTone;
  /** Overrides the tone's default cue (see `StatusBadgeShape`). */
  shape?: StatusBadgeShape;
  /** Something happening now: a pulsing dot (red on a tinted badge). The `live` tone always is. */
  live?: boolean;
  /** A glyph in place of the status cue, for a tag that names a kind rather than a state. */
  icon?: React.ReactNode;
  /** An opaque surface with a hairline, so the badge reads on any picture it sits over. */
  onImage?: boolean;
};

/** The on-image treatment: the page surface and a hairline, whatever the tone. */
const ON_IMAGE_CLASSES =
  "bg-[var(--lax-surface,var(--color-surface))] text-[var(--lax-fg,var(--color-on-surface))] shadow-[inset_0_0_0_1px_var(--lax-line,var(--color-outline-variant))]";

/**
 * A status as a tinted badge: tone, cue and words together. Labels are written in sentence case
 * by the caller's status map; the badge never transforms case. The label is the meaning, so it is
 * never cut short: the cell around a badge wraps, the badge does not. For counts, use a count pill.
 */
export function StatusBadge({
  className,
  tone = "neutral",
  shape,
  live = false,
  icon,
  onImage = false,
  children,
  ...props
}: StatusBadgeProps) {
  const pulsing = live || tone === "live";
  return (
    <span
      className={cn(statusBadgeVariants({ tone }), onImage && ON_IMAGE_CLASSES, className)}
      data-tone={tone}
      {...props}
    >
      {icon ? (
        <span className={SHAPE_FRAME} aria-hidden data-shape="icon">
          {icon}
        </span>
      ) : (
        <StatusBadgeCue
          shape={live ? "dot" : (shape ?? STATUS_BADGE_DEFAULT_SHAPE[tone])}
          pulse={pulsing}
          liveDot={live && tone !== "live"}
        />
      )}
      <span>{children}</span>
    </span>
  );
}

/** How a domain status is shown: its sentence-case label, tone and, rarely, a live pulse. */
export type StatusPresentation = {
  label: string;
  tone: StatusBadgeTone;
  shape?: StatusBadgeShape;
  live?: boolean;
};

/** "partially_refunded" → "Partially refunded". */
export function humanizeStatus(status: string): string {
  const words = status.replace(/[_-]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * One mapping per domain status (order, fulfilment, lot, account…). Each app declares its own
 * table; a status the API adds later still renders, as its humanised name in the neutral tone,
 * rather than breaking the page.
 */
export function defineStatusMap<T extends string>(
  map: Readonly<Record<T, StatusPresentation>>,
): (status: string) => StatusPresentation {
  return (status) =>
    (map as Readonly<Record<string, StatusPresentation | undefined>>)[status] ?? {
      label: humanizeStatus(status),
      tone: "neutral",
    };
}

/** A domain status through its app's map. */
export function MappedStatusBadge({
  status,
  present,
  className,
}: {
  status: string;
  present: (status: string) => StatusPresentation;
  className?: string;
}) {
  const { label, tone, shape, live } = present(status);
  return (
    <StatusBadge
      tone={tone}
      live={live ?? false}
      {...(shape ? { shape } : {})}
      {...(className ? { className } : {})}
    >
      {label}
    </StatusBadge>
  );
}
