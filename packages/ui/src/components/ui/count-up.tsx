"use client";

import * as React from "react";
import { cn } from "../../lib/utils.js";

export type CountUpProps = {
  /** Numeric value to animate towards. When this changes, animation starts from the previous rendered value. */
  value: number;
  /** Optional formatter (e.g., currency). Defaults to integer locale string. */
  format?: (n: number) => string;
  /** Animation duration ms. Defaults to motion-duration-md (320). */
  durationMs?: number;
  className?: string;
  /** Visually-hidden full announcement (e.g., for non-numeric context). */
  ariaLabel?: string;
  /** When true, no animation — render the formatted value directly. Useful for SSR-only paint. */
  disableAnimation?: boolean;
};

const DEFAULT_FORMAT: (n: number) => string = (n) => Math.round(n).toLocaleString();

/** CountUp — tweens a number to a new target using `requestAnimationFrame`.
 *
 * - SSR-safe: renders the formatted target on first paint, then animates only on client value changes.
 * - Respects `prefers-reduced-motion` automatically (skips the tween).
 * - No external dependency. Works inside `Suspense` boundaries.
 */
export function CountUp({
  value,
  format = DEFAULT_FORMAT,
  durationMs = 320,
  className,
  ariaLabel,
  disableAnimation = false,
}: CountUpProps) {
  const [display, setDisplay] = React.useState<number>(value);
  const fromRef = React.useRef<number>(value);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (disableAnimation || typeof window === "undefined") {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduced) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const start = performance.now();
    const from = fromRef.current;
    const delta = value - from;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / Math.max(1, durationMs));
      const eased = 1 - (1 - t) ** 3;
      setDisplay(from + delta * eased);
      if (t < 1) {
        rafRef.current = window.requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
        rafRef.current = null;
      }
    };

    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [value, durationMs, disableAnimation]);

  const text = format(display);

  return (
    <span className={cn("tabular-nums", className)} aria-label={ariaLabel}>
      {text}
    </span>
  );
}
