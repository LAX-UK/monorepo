import { BID_ERROR_CODES, presentationForBidCode } from "@/lib/ui/bid-error/codes";
import type { BidErrorPresentation } from "@/lib/ui/bid-error/types";

export type LotBidEligibilityBlockCode = "seller_cannot_bid" | "already_leading";

export type LotBidEligibilityResult =
  | { ok: true }
  | {
      ok: false;
      code: LotBidEligibilityBlockCode;
      presentation: BidErrorPresentation;
    };

export type EvaluateLotBidEligibilityInput = {
  isOwnLot: boolean;
  sessionUserId: string | null;
  leadingBidderId: string | null;
  /** When true, skip already-leading check (e.g. auto-bid save while winning). */
  allowWhileLeading?: boolean;
};

export function evaluateLotBidEligibility(
  input: EvaluateLotBidEligibilityInput,
): LotBidEligibilityResult {
  if (input.isOwnLot) {
    const presentation = presentationForBidCode(BID_ERROR_CODES.seller_cannot_bid);
    if (!presentation) return { ok: true };
    return { ok: false, code: "seller_cannot_bid", presentation };
  }

  if (
    !input.allowWhileLeading &&
    input.sessionUserId &&
    input.leadingBidderId &&
    input.leadingBidderId === input.sessionUserId
  ) {
    const presentation = presentationForBidCode(BID_ERROR_CODES.already_leading);
    if (!presentation) return { ok: true };
    return { ok: false, code: "already_leading", presentation };
  }

  return { ok: true };
}

export function evaluateManualBidEligibility(
  input: Omit<EvaluateLotBidEligibilityInput, "allowWhileLeading">,
): LotBidEligibilityResult {
  return evaluateLotBidEligibility(input);
}
