"use client";

import { useNow } from "@/hooks/use-now";
import { type LotTimerInputs, classifyLotTimerState } from "./classify";
import { formatRemaining } from "./format";
import { LotTimerPill } from "./lot-timer-pill";

export type LotCardTimerProps = LotTimerInputs;

export function LotCardTimer(props: LotCardTimerProps) {
  const now = useNow(1000);
  const state = classifyLotTimerState(props, now);
  if (state.kind === "live" || state.kind === "opensSoon") {
    const clockText = formatRemaining(state.msLeft);
    return <LotTimerPill state={state} clockText={clockText} />;
  }

  return <LotTimerPill state={state} />;
}
