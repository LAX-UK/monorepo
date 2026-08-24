import type { BidBlockerAction, BidBlockerPresentation } from "@/lib/bid/bid-blocker-presentation";

export function bidBlockerStickyAction(
  presentation: BidBlockerPresentation,
): BidBlockerAction | null {
  return presentation.action ?? null;
}

export function bidBlockerStickyLabel(action: BidBlockerAction): string {
  return action.shortLabel ?? action.label;
}
