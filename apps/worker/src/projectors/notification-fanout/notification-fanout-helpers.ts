export type TransferBlockedPayload = {
  payoutId: string;
  legalEntityId: string;
  reason: string;
};

export type ManualReviewPayload = {
  paymentId: string;
  lotId: string;
  buyerUserId: string;
  sellerLegalEntityId: string;
  amount: string;
  currency: string;
  reason: string;
};

export type SellerMoneyPayload = {
  legalEntityId?: string;
  sellerLegalEntityId?: string;
  amountCents?: number;
  netAmount?: string;
  currency: string;
  reason?: string | null;
  outcome?: string;
};

export type ProxyCancelledPayload = {
  lotId: string;
  bidderUserId: string;
  reason: string;
};

export type LotVoidedPayload = {
  lotId?: string;
  reason: string;
};

export const SUPPORTED_EVENT_TYPES = [
  "payout.transfer_blocked",
  "payment.requires_manual_review",
  "payout.transfer_initiated",
  "payment.dispute_opened",
  "payment.dispute_closed",
  "bid.proxy_cancelled",
  "lot.voided",
  "payout.clawback_required",
] as const;

export function formatReason(reason: string): string {
  if (reason === "connect_not_ready") {
    return "Stripe Connect payouts are not enabled for this organisation";
  }
  return reason.replaceAll("_", " ");
}

export function centsToAmount(cents: number | undefined): string {
  return typeof cents === "number" ? (cents / 100).toFixed(2) : "0.00";
}
