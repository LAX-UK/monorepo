"use client";

import { cn } from "@auction/ui";
import type { CSSProperties, ReactNode } from "react";
import { type RevealTrigger, defaultInViewTrigger, eagerTrigger } from "./triggers.js";
import { useReveal } from "./use-reveal.js";

export type RevealVariant = "fadeUp";

export type RevealProps = {
  trigger: RevealTrigger;
  variant?: RevealVariant;
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

export function RevealInView(props: Omit<RevealProps, "trigger">) {
  return <Reveal {...props} trigger={defaultInViewTrigger} />;
}

export function RevealOnMount(props: Omit<RevealProps, "trigger">) {
  return <Reveal {...props} trigger={eagerTrigger} />;
}
