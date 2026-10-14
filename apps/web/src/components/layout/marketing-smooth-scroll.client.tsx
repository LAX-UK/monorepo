"use client";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { SmoothScroll } from "@auction/marketing-ui";
import type { ReactNode } from "react";

export function MarketingSmoothScroll({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  return <SmoothScroll reducedMotion={reducedMotion}>{children}</SmoothScroll>;
}
