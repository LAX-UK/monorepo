"use client";

import { RevealInView, RevealOnMount } from "@/components/ui/reveal";
import {
  MARKETING_CARD_REVEAL,
  MARKETING_SECTION_REVEAL,
  marketingStaggerDelay,
} from "@/lib/marketing/motion";
import type { ReactNode } from "react";

type MarketingCardRevealProps = {
  index: number;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
};

/** Scroll-triggered reveal for catalogue/marketing cards (grid, carousel, archive). */
export function MarketingCardReveal({
  index,
  children,
  className,
  innerClassName,
}: MarketingCardRevealProps) {
  return (
    <RevealInView
      variant={MARKETING_CARD_REVEAL.variant}
      delayMs={marketingStaggerDelay(index, MARKETING_CARD_REVEAL)}
      {...(className !== undefined ? { className } : {})}
      {...(innerClassName !== undefined ? { innerClassName } : {})}
    >
      {children}
    </RevealInView>
  );
}

type MarketingSectionRevealProps = {
  index?: number;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
};

/** Scroll-triggered reveal for section copy blocks (CTA bands, private-sale text column). */
export function MarketingSectionReveal({
  index = 0,
  children,
  className,
  innerClassName,
}: MarketingSectionRevealProps) {
  return (
    <RevealInView
      variant={MARKETING_SECTION_REVEAL.variant}
      delayMs={marketingStaggerDelay(index, MARKETING_SECTION_REVEAL)}
      {...(className !== undefined ? { className } : {})}
      {...(innerClassName !== undefined ? { innerClassName } : {})}
    >
      {children}
    </RevealInView>
  );
}

type MarketingHeroRevealProps = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  delayMs?: number;
};

/** Above-fold hero media — eager on mount, no IO wait. */
export function MarketingHeroReveal({
  children,
  className,
  innerClassName,
  delayMs,
}: MarketingHeroRevealProps) {
  return (
    <RevealOnMount
      variant="fadeUp"
      {...(delayMs !== undefined ? { delayMs } : {})}
      {...(className !== undefined ? { className } : {})}
      {...(innerClassName !== undefined ? { innerClassName } : {})}
    >
      {children}
    </RevealOnMount>
  );
}
