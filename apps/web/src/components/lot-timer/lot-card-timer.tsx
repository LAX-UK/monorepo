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
  /** `overlay` for image cards; `inline` for document-flow rows (e.g. quick look meta). */
  layout?: "overlay" | "inline";
};

export function LotCardTimer({
  pillSurfaceClassName,
  variant,
  overlay,
  layout = "overlay",
  ...inputs
}: LotCardTimerProps) {
  const now = useNow(1000);
  const state = classifyLotTimerState(inputs, now);
  const surface = pillSurfaceClassName ? { surfaceClassName: pillSurfaceClassName } : {};
  const variantProp = variant && variant !== "default" ? { variant } : {};
  const overlayProp = overlay ? { useOverlayChrome: true as const } : {};
  const layoutProp = layout !== "overlay" ? { layout } : {};

  if (state.kind === "live" || state.kind === "opensSoon") {
    const clockText = formatRemaining(state.msLeft);
    return (
      <LotTimerPill
        state={state}
        clockText={clockText}
        {...surface}
        {...variantProp}
        {...overlayProp}
        {...layoutProp}
      />
    );
  }

  return (
    <LotTimerPill state={state} {...surface} {...variantProp} {...overlayProp} {...layoutProp} />
  );
}
