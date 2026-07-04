import type { BidPolicyDecision } from "@/lib/bid/policies/types";
import type { LotTimerState } from "@/lib/lot/classify-lot-timer-state";
import type { LotLifecycleKind } from "@/lib/lot/lot-lifecycle";

export type BidStickyMobileBarVisibilityInput = {
  live: boolean;
  lifecycleKind?: LotLifecycleKind | undefined;
  timerState: LotTimerState;
};

/** Whether the lot mobile sticky bar should render (and reserve bottom chrome). */
export function shouldShowBidStickyMobileBar({
  live,
  lifecycleKind,
  timerState,
}: BidStickyMobileBarVisibilityInput): boolean {
  if (isTerminalLifecycle(lifecycleKind)) return false;

  const saleroomMode = isSaleroomLifecycle(lifecycleKind);
  if (timerState.kind === "opensSoon" && !saleroomMode) return true;
  if (!saleroomMode && (timerState.kind === "closed" || timerState.kind === "cancelled")) {
    return false;
  }
  if (!live) return false;
  return true;
}

export function isSaleroomLifecycle(kind: LotLifecycleKind | undefined): boolean {
  return kind === "liveSaleroom" || kind === "saleroomPaused";
}

export function isTerminalLifecycle(kind: LotLifecycleKind | undefined): boolean {
  return (
    kind === "endedSold" || kind === "endedNoSale" || kind === "cancelled" || kind === "withdrawn"
  );
}

export function saleroomStatusLine(
  lifecycleKind: LotLifecycleKind | undefined,
  isOnBlock: boolean,
): string {
  if (lifecycleKind === "saleroomPaused") return "Auction paused";
  if (isOnBlock) return "On the block";
  return "Live in saleroom";
}

/** Bid CTAs (Review / Increase) only when policies allow bidding. */
export function canShowBidCta(decision: BidPolicyDecision): boolean {
  return decision.kind !== "block";
}
