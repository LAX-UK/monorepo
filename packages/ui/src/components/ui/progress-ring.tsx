import type * as React from "react";
import { cn } from "../../lib/utils.js";

export type ProgressRingProps = {
  /** Steps completed. Clamped to 0..max. */
  value: number;
  /** Total steps. A ring with no steps renders empty rather than dividing by zero. */
  max: number;
  /** Accessible name, e.g. "Security checkup progress". */
  label: string;
  /** Diameter in px. */
  size?: number;
  strokeWidth?: number;
  /** Content drawn in the middle, e.g. "2/5". It is decorative: the value is exposed on the root. */
  children?: React.ReactNode;
  /** The arc takes `currentColor`, so set the colour with a text utility. */
  className?: string;
};

/**
 * Circular step counter. Use it for "N of M done" summaries; the linear `Progress` suits
 * continuous values such as uploads. The track uses a neutral outline token and the arc uses
 * `currentColor`, so each product tints it with its own accent.
 */
export function ProgressRing({
  value,
  max,
  label,
  size = 72,
  strokeWidth = 6,
  children,
  className,
}: ProgressRingProps) {
  const total = Math.max(0, max);
  const done = Math.min(Math.max(0, value), total);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = total === 0 ? 0 : done / total;

  return (
    // biome-ignore lint/a11y/useFocusableInteractive: a progressbar only reports a value; it takes no input, so it should not be a tab stop.
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-valuetext={`${done} of ${total}`}
      data-slot="progress-ring"
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
        focusable="false"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          style={{ stroke: "var(--color-outline-variant)" }}
        />
        <circle
          data-slot="progress-ring-arc"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-500"
        />
      </svg>
      {children ? (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          {children}
        </span>
      ) : null}
    </div>
  );
}
