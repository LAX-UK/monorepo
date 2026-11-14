import type { PaymentStatus, PayoutStatus } from "@auction/types";
import type { StatusBadgeVariant } from "./core";

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  pending: "Pending",
  authorized: "Authorised",
  captured: "Captured",
  refunded: "Refunded",
  requires_manual_review: "Manual review",
  cancelled: "Cancelled",
};

export function paymentStatusToBadgeVariant(status: PaymentStatus): StatusBadgeVariant {
  switch (status) {
    case "captured":
      return "success";
    case "authorized":
      return "info";
    case "pending":
    case "requires_manual_review":
      return "warning";
    case "refunded":
      return "neutral";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

export const payoutStatusLabel: Record<PayoutStatus, string> = {
  scheduled: "Scheduled",
  in_transit: "In transit",
  paid: "Paid",
  failed: "Failed",
  reversed: "Reversed",
  clawback_pending: "Clawback pending",
  transfer_blocked: "Blocked, needs review",
};

/**
 * Staff copy for the reason codes a payout can carry in `failureReason`. Sentence case: what
 * happened, then what staff should do. Keyed by the code before any ": detail" suffix.
 */
export const payoutFailureReasonLabel: Record<string, string> = {
  manual_reconciliation_required:
    "Refunded after the settlement window. Reconcile this payout by hand.",
  insufficient_funds:
    "The platform balance did not cover this transfer. Top up the balance, then retry.",
  account_closed: "The seller's payout account is closed. Ask the seller for new payout details.",
  no_account: "The seller has no connected payout account. Ask them to finish payout setup.",
  transfer_already_exists:
    "The payment provider already holds a transfer for this payout. Link it instead of retrying.",
};

export const PAYOUT_FAILURE_REASON_FALLBACK =
  "The payout could not be completed. Check the transfer with the payment provider, or ask engineering if it is unclear.";

export type PayoutFailureReason = {
  /** Plain staff copy; never the raw code. */
  text: string;
  /** The raw provider or internal value, for a small copyable "Reason code" fact. */
  code: string;
};

/** Maps a stored failure reason to staff copy, falling back to a generic sentence for unknown codes. */
export function presentPayoutFailureReason(raw: string): PayoutFailureReason {
  const code = raw.trim();
  const key = code.split(":")[0]?.trim().toLowerCase() ?? "";
  const text = Object.hasOwn(payoutFailureReasonLabel, key)
    ? (payoutFailureReasonLabel[key] as string)
    : PAYOUT_FAILURE_REASON_FALLBACK;
  return { text, code };
}

export function payoutStatusToBadgeVariant(status: PayoutStatus | string): StatusBadgeVariant {
  switch (status) {
    case "paid":
      return "success";
    case "in_transit":
      return "info";
    case "scheduled":
      return "neutral";
    case "failed":
    case "clawback_pending":
    case "transfer_blocked":
      return "danger";
    case "reversed":
      return "danger";
    default:
      return "neutral";
  }
}
