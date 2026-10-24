import type { AdminPayoutList } from "@auction/shop-contracts";
import { PAYOUT_PAID_REFERENCE_MAX_LENGTH } from "@auction/shop-contracts";
import { defineStatusMap, formatGbp } from "@auction/staff-ui";

/*
 * How a payout reads in the list and its panel, and when it may be marked paid. Pure, so the rules
 * are tested without rendering. The API pays out only `due` payouts, so the screen offers the
 * action for those alone and explains the one state that will become payable.
 */

export type PayoutRow = AdminPayoutList["items"][number];

export const PAYOUT_STATUS_LABELS = {
  pending_refund_period: "Waiting for refund period",
  due: "Due",
  paid: "Paid",
  cancelled: "Cancelled",
} as const;

export const presentPayoutStatus = defineStatusMap({
  pending_refund_period: { label: PAYOUT_STATUS_LABELS.pending_refund_period, tone: "neutral" },
  due: { label: PAYOUT_STATUS_LABELS.due, tone: "warning" },
  paid: { label: PAYOUT_STATUS_LABELS.paid, tone: "success" },
  cancelled: { label: PAYOUT_STATUS_LABELS.cancelled, tone: "neutral" },
});

const PAYOUT_SOURCE_LABELS: Record<string, string> = {
  order_line: "Shop order",
  third_party_sale: "Third-party sale",
  original_sale: "Original sale",
};

export function payoutSourceLabel(source: string): string {
  return PAYOUT_SOURCE_LABELS[source] ?? source.replace(/_/g, " ");
}

/** What staff quote and paste for a payout: the first eight characters of its id. */
export function payoutReference(payoutId: string): string {
  return payoutId.slice(0, 8);
}

export type MarkPaidAvailability =
  | { kind: "hidden" }
  | { kind: "available" }
  | { kind: "blocked"; reason: string };

/**
 * Whether "Mark paid" is offered. Roles that cannot pay never see it. For the rest, a due payout
 * can be paid, one still in its refund period is shown disabled with the reason, and paid or
 * cancelled payouts have no payment action at all.
 */
export function markPaidAvailability(
  payout: Pick<PayoutRow, "status">,
  options: { canMarkPaid: boolean },
): MarkPaidAvailability {
  if (!options.canMarkPaid) return { kind: "hidden" };
  switch (payout.status) {
    case "due":
      return { kind: "available" };
    case "pending_refund_period":
      return { kind: "blocked", reason: "Payable once the refund period ends" };
    default:
      return { kind: "hidden" };
  }
}

/** The words on the confirm button, repeating the amount being paid out. */
export function markPaidConfirmLabel(payout: Pick<PayoutRow, "netPence">): string {
  return `Mark ${formatGbp(payout.netPence)} paid`;
}

export function markPaidTitle(payout: Pick<PayoutRow, "ownerDisplayName">): string {
  return `Mark the payout to ${payout.ownerDisplayName} as paid?`;
}

export type PaidReferenceCheck = { ok: true; value: string } | { ok: false; message: string };

/** The bank or transfer reference entered when paying: required, and no longer than the API takes. */
export function checkPaidReference(input: string): PaidReferenceCheck {
  const value = input.trim();
  if (!value) return { ok: false, message: "Enter the reference from the transfer." };
  if (value.length > PAYOUT_PAID_REFERENCE_MAX_LENGTH) {
    return {
      ok: false,
      message: `Use ${PAYOUT_PAID_REFERENCE_MAX_LENGTH} characters or fewer.`,
    };
  }
  return { ok: true, value };
}

export const PAYOUT_PAID_REFERENCE_LIMIT = PAYOUT_PAID_REFERENCE_MAX_LENGTH;

/** Payouts staff can pay now; the count the page leads with. */
export function duePayoutCount(items: readonly Pick<PayoutRow, "status">[]): number {
  return items.filter((item) => item.status === "due").length;
}

const QUEUE_RANK: Record<string, number> = {
  due: 0,
  pending_refund_period: 1,
  paid: 2,
  cancelled: 3,
};

/** Sorts the list as staff work it: payable now first, then waiting, then done, oldest due first. */
export function payoutQueueKey(payout: Pick<PayoutRow, "status" | "payoutDueAt">): string {
  return `${QUEUE_RANK[payout.status] ?? 4}-${payout.payoutDueAt}`;
}
