"use client";

import { cn } from "@auction/ui";
import * as React from "react";

type MagneticButtonProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Magnetic strength in px (max translation). */
  strength?: number;
  /** Children — should be a single Button / Link. */
  children: React.ReactNode;
};

/** F7 — MagneticButton.
 *
 * Wraps a CTA in a container that gently pulls the child toward the cursor
 * when hovered. Respects `prefers-reduced-motion` and skips entirely on
 * coarse pointers (touch devices). Pure CSS transform — no layout thrash.
 */
export function MagneticButton({
  strength = 12,
  className,
  children,
  ...rest
}: MagneticButtonProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const innerRef = React.useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    setEnabled(!reduce && fine);
  }, []);

  React.useEffect(() => {
    if (!enabled) return;
    const root = ref.current;
    const inner = innerRef.current;
    if (!root || !inner) return;

    let raf = 0;
    let tx = 0;
    let ty = 0;

    const rootEl = root;
    const innerEl = inner;

    function onMove(e: PointerEvent) {
      const rect = rootEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / rect.width;
      const dy = (e.clientY - cy) / rect.height;
      tx = dx * strength;
      ty = dy * strength;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        innerEl.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px)`;
      });
    }

    function onLeave() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        innerEl.style.transform = "translate(0px, 0px)";
      });
    }

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      rootEl.removeEventListener("pointermove", onMove);
      rootEl.removeEventListener("pointerleave", onLeave);
      innerEl.style.transform = "";
    };
  }, [enabled, strength]);

  return (
    <div ref={ref} className={cn("inline-block", className)} {...rest}>
      <div
        ref={innerRef}
        className="inline-block transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{ transitionDuration: "var(--motion-duration-md, 320ms)" }}
      >
        {children}
      </div>
    </div>
  );
}
