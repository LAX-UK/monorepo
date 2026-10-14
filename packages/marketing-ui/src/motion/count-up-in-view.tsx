"use client";

import { CountUp } from "@auction/ui";
import { useEffect, useRef, useState } from "react";
import { inViewTrigger } from "./reveal/triggers.js";

export type CountUpInViewProps = {
  value: number;
  format?: (n: number) => string;
  durationMs?: number;
  className?: string;
  ariaLabel?: string;
};

export function CountUpInView({
  value,
  format,
  durationMs = 1600,
  className,
  ariaLabel,
}: CountUpInViewProps) {
  const ref = useRef<HTMLSpanElement>(null);
  /** False on SSR and until the client effect runs (shows final value, no animation). */
  const [armed, setArmed] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setInView(true);
      setArmed(true);
      return;
    }
    setArmed(true);
    const cleanup = inViewTrigger({ rootMargin: "0px 0px -10% 0px" }).bind(el, () =>
      setInView(true),
    );
    return cleanup;
  }, []);

  const showTarget = !armed || inView;
  const disableAnimation = !armed || !inView;

  return (
    <span ref={ref} className={className}>
      <CountUp
        value={showTarget ? value : 0}
        disableAnimation={disableAnimation}
        {...(format !== undefined ? { format } : {})}
        durationMs={durationMs}
        {...(ariaLabel !== undefined ? { ariaLabel } : {})}
      />
    </span>
  );
}
