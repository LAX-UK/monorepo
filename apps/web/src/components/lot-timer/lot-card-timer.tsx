"use client";

import { useCountdownTick } from "@/lib/time/use-clock";
import { useRef } from "react";
import { type LotTimerInputs, classifyLotTimerState, lotTimerMoments } from "./classify";
import { timerText } from "./format";
import { LotTimerPill, type LotTimerPillVariant } from "./lot-timer-pill";

export type LotCardTimerProps = LotTimerInputs & {
  pillSurfaceClassName?: string;
  variant?: LotTimerPillVariant;
  /** Use adaptive overlay chrome from AdaptiveMediaFrame (bottomLeft slot). */
  overlay?: boolean;
  /** `overlay` for image cards; `inline` for document-flow rows (e.g. quick look meta). */
  layout?: "overlay" | "inline";
};

/** Default `layout="overlay"` is for image cards only; tables/lists must use `layout="inline"` or `DashboardLotCountdown`. */

export function LotCardTimer({
  pillSurfaceClassName,
  variant,
  overlay,
  layout = "overlay",
  ...inputs
}: LotCardTimerProps) {
  const rootRef = useRef<HTMLOutputElement>(null);
  // Off screen, the pill stops counting and catches up when it comes back.
  const now = useCountdownTick(lotTimerMoments(inputs), { surface: "card", inViewRef: rootRef });
  const state = classifyLotTimerState(inputs, now);
  const surface = pillSurfaceClassName ? { surfaceClassName: pillSurfaceClassName } : {};
  const variantProp = variant && variant !== "default" ? { variant } : {};
  const overlayProp = overlay ? { useOverlayChrome: true as const } : {};
  const layoutProp = layout !== "overlay" ? { layout } : {};

  if ((state.kind === "live" || state.kind === "opensSoon") && now != null) {
    return (
      <LotTimerPill
        state={state}
        timer={timerText(state.msLeft, now)}
        rootRef={rootRef}
        {...surface}
        {...variantProp}
        {...overlayProp}
        {...layoutProp}
      />
    );
  }

  return (
    <LotTimerPill
      state={state}
      rootRef={rootRef}
      {...surface}
      {...variantProp}
      {...overlayProp}
      {...layoutProp}
    />
  );
}
