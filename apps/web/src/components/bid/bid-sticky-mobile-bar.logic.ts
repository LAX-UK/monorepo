import type { BidPolicyDecision } from "@/lib/bid/policies/types";
import type { LotLifecycleKind } from "@/lib/lot/lot-lifecycle";

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
