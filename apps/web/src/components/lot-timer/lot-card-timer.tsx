"use client";

import { useNow } from "@/hooks/use-now";
import { type LotTimerInputs, classifyLotTimerState } from "./classify";
import { formatRemaining } from "./format";
import { LotTimerPill, type LotTimerPillVariant } from "./lot-timer-pill";

export type LotCardTimerProps = LotTimerInputs & {
  pillSurfaceClassName?: string;
  variant?: LotTimerPillVariant;
  /** Use adaptive overlay chrome from AdaptiveMediaFrame (bottomLeft slot). */
  overlay?: boolean;
};

export function LotCardTimer({
  pillSurfaceClassName,
  variant,
  overlay,
  ...inputs
}: LotCardTimerProps) {
  const now = useNow(1000);
  const state = classifyLotTimerState(inputs, now);
  const surface = pillSurfaceClassName ? { surfaceClassName: pillSurfaceClassName } : {};
  const variantProp = variant && variant !== "default" ? { variant } : {};
  const overlayProp = overlay ? { useOverlayChrome: true as const } : {};

  if (state.kind === "live" || state.kind === "opensSoon") {
    const clockText = formatRemaining(state.msLeft);
    return (
      <LotTimerPill
        state={state}
        clockText={clockText}
        {...surface}
        {...variantProp}
        {...overlayProp}
      />
    );
  }

  return <LotTimerPill state={state} {...surface} {...variantProp} {...overlayProp} />;
}
