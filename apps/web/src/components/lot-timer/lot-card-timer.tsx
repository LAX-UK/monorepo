"use client";

import { useNow } from "@/hooks/use-now";
import { type LotTimerInputs, classifyLotTimerState } from "./classify";
import { formatRemaining } from "./format";
import { LotTimerPill, type LotTimerPillVariant } from "./lot-timer-pill";

export type LotCardTimerProps = LotTimerInputs & {
  /** Optional shell overrides for marketing cards (merged last in `LotTimerPill`). */
  pillSurfaceClassName?: string;
  /** Figma-style tag typography + glass shell for home ending-soon. */
  variant?: LotTimerPillVariant;
};

export function LotCardTimer({ pillSurfaceClassName, variant, ...inputs }: LotCardTimerProps) {
  const now = useNow(1000);
  const state = classifyLotTimerState(inputs, now);
  const surface = pillSurfaceClassName ? { surfaceClassName: pillSurfaceClassName } : {};
  const variantProp = variant && variant !== "default" ? { variant } : {};

  if (state.kind === "live" || state.kind === "opensSoon") {
    const clockText = formatRemaining(state.msLeft);
    return <LotTimerPill state={state} clockText={clockText} {...surface} {...variantProp} />;
  }

  return <LotTimerPill state={state} {...surface} {...variantProp} />;
}
