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

export type MemberRemovedPayload = {
  member_user_id: string;
  removed_by_user_id: string;
  role_at_removal: string;
  /** Automatic bids for the organisation that stopped with the removal. */
  stopped_bids?: unknown[];
};

export type SaleRegistrationDecidedPayload = {
  saleId: string;
  userId: string;
  decision: "approved" | "declined";
  bidLimit?: string | null;
  reason?: string | null;
};

export type SaleRegistrationLimitChangedPayload = {
  saleId: string;
  userId: string;
  previousLimit: string | null;
  limit: string | null;
};

export type OrganisationLimitChangedPayload = {
  previous_limit: string | null;
  limit: string | null;
  /** Who made the change: a member of the organisation, or LAX staff. */
  changed_by: "member" | "staff";
};

/** Payment cancelled; `reason` says whether the buyer, the clock or the bank ended it. */
export type PaymentCancelledPayload = {
  lotId?: string | null;
  buyerUserId?: string | null;
  reason?: string;
};

/** Reason recorded when the buyer's bank did not complete a delayed payment. */
export const ASYNC_PAYMENT_FAILED_REASON = "stripe_checkout_async_payment_failed";

export type LotVoidedPayload = {
  lotId?: string;
  reason: string;
};

export type LotWithdrawalDeclinedPayload = {
  sellerLegalEntityId: string;
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
  "lot.withdrawal_declined",
  "payout.clawback_required",
  "legal_entity.member_removed",
  "sale_registration.decided",
  "sale_registration.bid_limit_changed",
  "legal_entity.bidding_limit_changed",
  "payment.cancelled",
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

/** Where sellers follow their payouts: Sold & payouts in Bid's Selling mode. */
export function sellerPayoutsUrlFor(adminPayoutsUrl: string): string {
  return new URL("/selling/payouts", adminPayoutsUrl).toString();
}

export type StaffAlertTarget = {
  to: string;
  userId?: string;
  firstName: string;
  /** Distinguishes this recipient in the email idempotency key. */
  keySuffix: string;
  snapshot: boolean;
};

/** Staff ops recipients, falling back to the shared admin inbox when none are configured. */
export async function listStaffAlertTargets(
  reader: {
    listRecipients(): Promise<Array<{ id: string; email: string; firstName: string | null }>>;
  },
  adminEmailAddress: string | undefined,
): Promise<StaffAlertTarget[]> {
  const staff = await reader.listRecipients();
  if (staff.length > 0) {
    return staff.map((s) => ({
      to: s.email,
      userId: s.id,
      firstName: s.firstName ?? "Team",
      keySuffix: `ops:${s.id}`,
      snapshot: false,
    }));
  }
  if (adminEmailAddress) {
    return [{ to: adminEmailAddress, firstName: "Ops Team", keySuffix: "admin", snapshot: true }];
  }
  return [];
}
