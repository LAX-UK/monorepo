"use client";

import { cn } from "@auction/ui";
import { type CSSProperties, Children, type ReactNode, isValidElement } from "react";
import { type RevealTrigger, defaultInViewTrigger, eagerTrigger } from "./triggers.js";
import { useReveal } from "./use-reveal.js";
import type { RevealVariant } from "./variants.js";

/** Visual reveal variants. Driven by CSS classes in `marketing-ui.css`.
 * Marketing surfaces: use `MarketingCardReveal`, not raw `RevealInView`.
 */
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
  stepMs?: number;
  maxDelayMs?: number;
  trigger?: RevealTrigger;
  variant?: RevealVariant;
  className?: string;
  childClassName?: string;
  children: ReactNode;
};

/** Stagger helper — wraps every direct child in a `<Reveal/>` with incremental `delayMs`. */
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

export type { RevealVariant } from "./variants.js";
