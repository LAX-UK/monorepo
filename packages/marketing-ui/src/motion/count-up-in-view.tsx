"use client";

import { CountUp } from "@auction/ui";
import { useEffect, useRef, useState } from "react";
import { whenReaderMoves } from "./reveal/reader-intent.js";
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
  /**
   * True only once the reader has moved through the page and this counter was still off screen.
   * Until then (SSR, a capture, a preview, a print) it shows its final value, as drawn.
   */
  const [armed, setArmed] = useState(false);
  const [inView, setInView] = useState(false);
  /** Print shows every counter at its final value. */
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const onBeforePrint = () => setPrinting(true);
    const onAfterPrint = () => setPrinting(false);
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const trigger = inViewTrigger({ rootMargin: "0px 0px -10% 0px" });
    // Already on screen at load: leave the final value as drawn, with nothing to animate.
    if (trigger.isSatisfiedOnArm?.(el)) return;
    let isArmed = false;
    let isStatic = false;
    const cancelArm = whenReaderMoves(() => {
      if (isStatic) return;
      isArmed = true;
      setArmed(true);
    });
    const unbind = trigger.bind(el, () => {
      if (!isArmed) {
        // Came into view before the reader ever moved: keep it as drawn.
        isStatic = true;
        cancelArm();
        return;
      }
      setInView(true);
    });
    return () => {
      cancelArm();
      unbind();
    };
  }, []);

  const showTarget = printing || !armed || inView;
  const disableAnimation = printing || !armed || !inView;

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
