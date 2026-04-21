"use client";

import { useReveal } from "@/components/ui/reveal/use-reveal";
import { defaultInViewTrigger, eagerTrigger, type RevealTrigger } from "@/components/ui/reveal/triggers";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type RevealVariant = "wipeZoom" | "wipe" | "zoom";

export type RevealProps = {
  trigger: RevealTrigger;
  variant?: RevealVariant;
  className?: string;
  innerClassName?: string;
  children: ReactNode;
};

export function Reveal({ trigger, variant = "wipeZoom", className, innerClassName, children }: RevealProps) {
  const ref = useReveal<HTMLDivElement>(trigger);
  return (
    <div
      ref={ref}
      className={cn("reveal", `reveal--${variant}`, className)}
      data-reveal-trigger={trigger.id}
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
