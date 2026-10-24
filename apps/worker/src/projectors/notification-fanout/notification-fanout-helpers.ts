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
  return new URL("/dashboard/seller/payouts", adminPayoutsUrl).toString();
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
