"use client";

import type { ReactNode } from "react";
import {
  MARKETING_CARD_REVEAL,
  MARKETING_SECTION_REVEAL,
  marketingStaggerDelay,
} from "./motion.js";
import { RevealInView } from "./reveal/reveal.js";

type MarketingRevealProps = {
  index?: number;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  preset?: typeof MARKETING_SECTION_REVEAL;
};

export function MarketingReveal({
  index = 0,
  children,
  className,
  innerClassName,
  preset = MARKETING_SECTION_REVEAL,
}: MarketingRevealProps) {
  return (
    <RevealInView
      variant="fadeUp"
      delayMs={marketingStaggerDelay(index, preset)}
      {...(className !== undefined ? { className } : {})}
      {...(innerClassName !== undefined ? { innerClassName } : {})}
    >
      {children}
    </RevealInView>
  );
}

type MarketingCardRevealProps = {
  index: number;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
};

export function MarketingCardReveal({
  index,
  children,
  className,
  innerClassName,
}: MarketingCardRevealProps) {
  return (
    <RevealInView
      variant="fadeUp"
      delayMs={marketingStaggerDelay(index, MARKETING_CARD_REVEAL)}
      {...(className !== undefined ? { className } : {})}
      {...(innerClassName !== undefined ? { innerClassName } : {})}
    >
      {children}
    </RevealInView>
  );
}
