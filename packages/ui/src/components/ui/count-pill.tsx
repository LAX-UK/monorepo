import type * as React from "react";
import { cn } from "../../lib/utils.js";

export type CountPillTone = "neutral" | "attention";

const TONE_CLASSES: Readonly<Record<CountPillTone, string>> = {
  neutral: "bg-surface-container-high text-on-surface",
  attention: "bg-on-surface text-surface",
};

/** Counts above this read as "99+", so a pill never grows past three characters. */
export const COUNT_PILL_MAX = 99;

export function formatCountPill(value: number): string {
  return value > COUNT_PILL_MAX ? `${COUNT_PILL_MAX}+` : String(value);
}

export type CountPillProps = Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> & {
  value: number;
  tone?: CountPillTone;
  /** Read after the number by assistive technology: "3 waiting". */
  label?: string;
};

/**
 * A count as a 20px digits-only pill with tabular figures. It is not a status, so it carries no
 * cue, and it renders nothing for zero or less: an empty count is never shown.
 */
export function CountPill({ value, tone = "neutral", label, className, ...props }: CountPillProps) {
  if (!(value > 0)) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 font-label text-xs leading-4 font-medium tabular-nums",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      {formatCountPill(value)}
      {label ? <span className="sr-only"> {label}</span> : null}
    </span>
  );
}
