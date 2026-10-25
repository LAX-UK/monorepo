import type { AdminPayoutList } from "@auction/shop-contracts";
import { PAYOUT_PAID_REFERENCE_MAX_LENGTH } from "@auction/shop-contracts";
import { formatStaffMoney, humanizeStatus } from "@auction/staff-ui";
import { presentStatus } from "./staff-status";

/*
 * How a payout reads in the list and its panel, and when it may be marked paid. Pure, so the rules
 * are tested without rendering. The API pays out only `due` payouts, so the screen offers the
 * action for those alone and explains the one state that will become payable.
 */

export type PayoutRow = AdminPayoutList["items"][number];

export const presentPayoutStatus = presentStatus("payout");

const PAYOUT_SOURCE_LABELS: Record<string, string> = {
  order_line: "Shop order",
  third_party_sale: "Third-party sale",
  original_sale: "Original sale",
};

export function payoutSourceLabel(source: string): string {
  return PAYOUT_SOURCE_LABELS[source] ?? humanizeStatus(source);
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
  return `Mark ${formatStaffMoney(payout.netPence)} paid`;
}

export function markPaidTitle(payout: Pick<PayoutRow, "ownerDisplayName">): string {
  return `Mark the payout to ${payout.ownerDisplayName} as paid?`;
}

export const PAYOUT_PAID_REFERENCE_LIMIT = PAYOUT_PAID_REFERENCE_MAX_LENGTH;
