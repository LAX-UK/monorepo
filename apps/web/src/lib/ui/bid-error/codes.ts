import type { BidErrorPresentation } from "./types";

export const BID_ERROR_CODES = {
  seller_cannot_bid: "seller_cannot_bid",
  already_leading: "already_leading",
  auto_bid_disabled: "auto_bid_disabled",
  auto_bid_step_invalid: "auto_bid_step_invalid",
} as const;

export type BidErrorCode = (typeof BID_ERROR_CODES)[keyof typeof BID_ERROR_CODES];

const SELLER_MESSAGE = "Seller cannot bid on own lot";

export const BID_ERROR_PRESENTATIONS: Record<BidErrorCode, BidErrorPresentation> = {
  seller_cannot_bid: {
    title: "Your listing",
    message: "You're the seller of this lot, so you can't place a bid.",
    severity: "warning",
  },
  already_leading: {
    title: "You are leading",
    message:
      "You are already the highest bidder. Raise your auto-bid max instead of bidding again.",
    severity: "warning",
    actionKey: "switch-to-auto-bid",
    actionLabel: "Raise auto-bid max",
  },
  auto_bid_disabled: {
    message: "Auto-bid isn't available on this lot.",
    severity: "warning",
  },
  auto_bid_step_invalid: {
    message: "Choose one of the listed raise amounts.",
    severity: "error",
  },
};

export function isBidErrorCode(code: string): code is BidErrorCode {
  return code in BID_ERROR_PRESENTATIONS;
}

export function presentationForBidCode(code: string): BidErrorPresentation | null {
  if (!isBidErrorCode(code)) return null;
  return BID_ERROR_PRESENTATIONS[code];
}

export function matchesSellerOwnLotError(raw: string, code?: string | null): boolean {
  return code === BID_ERROR_CODES.seller_cannot_bid || raw === SELLER_MESSAGE;
}

export function matchesAlreadyLeadingError(raw: string, code?: string | null): boolean {
  return (
    code === BID_ERROR_CODES.already_leading ||
    raw === BID_ERROR_CODES.already_leading ||
    raw.includes("already the highest")
  );
}
