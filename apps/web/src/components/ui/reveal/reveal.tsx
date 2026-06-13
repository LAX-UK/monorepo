"use client";

import {
  type RevealTrigger,
  defaultInViewTrigger,
  eagerTrigger,
} from "@/components/ui/reveal/triggers";
import { useReveal } from "@/components/ui/reveal/use-reveal";
import { cn } from "@auction/ui";
import { type CSSProperties, Children, type ReactNode, isValidElement } from "react";

/** Visual reveal variants. Driven by CSS classes in `globals.css`.
 * Marketing surfaces: use `MarketingCardReveal`, not raw `RevealInView`.
 * - `wipe`        : clip-path inset wipe-in (90 0 0 0 → 0 0 0 0).
 * - `zoom`        : inner element scales 1.08 → 1.
 * - `wipeZoom`    : both, in parallel.
 * - `fadeUp`      : translate(0, 16px) + opacity 0 → 1, no clip-path.
 * - `textLine`    : per-line clip-path wipe; pair with manual line wrappers.
 */
export type RevealVariant = "wipeZoom" | "wipe" | "zoom" | "fadeUp" | "textLine";

export type RevealProps = {
  trigger: RevealTrigger;
  variant?: RevealVariant;
  /** Stagger reveal animation start (ms). Passed as CSS `--reveal-delay`. */
  delayMs?: number;
  className?: string;
  innerClassName?: string;
  children: ReactNode;
};

export function Reveal({
  trigger,
  variant = "fadeUp",
  delayMs,
  className,
  innerClassName,
  children,
}: RevealProps) {
  const ref = useReveal<HTMLDivElement>(trigger);
  const style: CSSProperties | undefined =
    delayMs !== undefined ? ({ "--reveal-delay": `${delayMs}ms` } as CSSProperties) : undefined;
  return (
    <div
      ref={ref}
      className={cn("reveal", `reveal--${variant}`, className)}
      data-reveal-trigger={trigger.id}
      style={style}
    >
      <div className={cn("reveal__inner", innerClassName)}>{children}</div>
    </div>
  );
}

export type RevealFacadeProps = Omit<RevealProps, "trigger">;

export function RevealOnMount(props: RevealFacadeProps) {
  return <Reveal {...props} trigger={eagerTrigger} />;
}

export function RevealInView(props: RevealFacadeProps) {
  return <Reveal {...props} trigger={defaultInViewTrigger} />;
}

export type RevealStaggerProps = {
  /** Per-child delay step in ms (e.g., 80 yields 0ms, 80ms, 160ms, …). */
  stepMs?: number;
  /** Cap the maximum delay so a long list doesn't wait forever. */
  maxDelayMs?: number;
  /** Trigger to apply to every child reveal. Defaults to in-view. */
  trigger?: RevealTrigger;
  /** Variant applied to every child. Defaults to `fadeUp`. */
  variant?: RevealVariant;
  className?: string;
  childClassName?: string;
  children: ReactNode;
};

/** Stagger helper — wraps every direct child in a `<Reveal/>` with an
 * incremental `delayMs`. Encapsulates the ad-hoc `index * 80` pattern that
 * was repeated across the home sections.
 */
export function RevealStagger({
  stepMs = 80,
  maxDelayMs = 480,
  trigger = defaultInViewTrigger,
  variant = "fadeUp",
  className,
  childClassName,
  children,
}: RevealStaggerProps) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <div className={className}>
      {items.map((child, index) => {
        const props: RevealProps = {
          trigger,
          variant,
          delayMs: Math.min(index * stepMs, maxDelayMs),
          children: child,
          ...(childClassName ? { className: childClassName } : {}),
        };
        return <Reveal key={child.key ?? index} {...props} />;
      })}
    </div>
  );
}
