import { formatMoney } from "@/lib/format-currency";
import type { BidErrorPresentation } from "@/lib/ui/bid-error";
import { clientBidError } from "@/lib/ui/bid-error";

const EPSILON = 1e-9;

export type BidEntryValidationResult = { ok: true } | { ok: false; error: BidErrorPresentation };

export type ValidateBidReviewInput = {
  amount: string;
  minNumeric: number;
  approvedBidLimit?: number | null;
  includeAutoBidOnManualBid: boolean;
  activeAutoBidMax?: string | null;
};

export function validateBidReview(input: ValidateBidReviewInput): BidEntryValidationResult {
  const n = Number.parseFloat(input.amount);
  if (Number.isNaN(n) || n + EPSILON < input.minNumeric) {
    return {
      ok: false,
      error: clientBidError(`Enter at least ${formatMoney(input.minNumeric.toFixed(2))}`),
    };
  }

  const regLimit = input.approvedBidLimit;
  if (regLimit != null && n > regLimit + EPSILON) {
    return {
      ok: false,
      error: clientBidError(
        `Your approved limit for this sale is ${formatMoney(regLimit.toFixed(2))}. Enter a lower amount.`,
      ),
    };
  }

  const savedMax = input.activeAutoBidMax ?? "";
  const maxN =
    input.includeAutoBidOnManualBid && savedMax.trim() !== ""
      ? Number.parseFloat(savedMax)
      : undefined;
  if (maxN !== undefined) {
    if (Number.isNaN(maxN) || maxN < n) {
      return {
        ok: false,
        error: clientBidError("Max auto-bid must be greater than or equal to your bid."),
      };
    }
    if (regLimit != null && maxN > regLimit + EPSILON) {
      return {
        ok: false,
        error: clientBidError(
          `Your approved limit for this sale is ${formatMoney(regLimit.toFixed(2))}. Lower your max auto-bid.`,
        ),
      };
    }
  }

  return { ok: true };
}

export type ValidateBidConfirmAmountInput = {
  amount: string;
  minNumeric: number;
};

export function validateBidConfirmAmount(
  input: ValidateBidConfirmAmountInput,
): BidEntryValidationResult {
  const n = Number.parseFloat(input.amount);
  if (Number.isNaN(n)) {
    return { ok: false, error: clientBidError("Invalid amount") };
  }
  if (n + EPSILON < input.minNumeric) {
    return {
      ok: false,
      error: clientBidError(`Enter at least ${formatMoney(input.minNumeric.toFixed(2))}`),
    };
  }
  return { ok: true };
}

export function validateLiveBiddingConnectionBlocked(
  biddingLive: boolean,
  biddingAllowed: boolean,
): BidEntryValidationResult | null {
  if (biddingLive && !biddingAllowed) {
    return {
      ok: false,
      error: clientBidError(
        "Live bidding is unavailable until your connection to the saleroom is restored.",
      ),
    };
  }
  return null;
}
