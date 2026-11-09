import {
  type DealBlocker,
  type DealCommand,
  dealTermIsEditable,
  describeDealBlocker,
} from "@auction/domain";
import type { PrivateSaleDealDetail } from "@auction/types";
import type { AdminDealTerms, StaffDealAction } from "@auction/validators";
import type { DealActionBlocker } from "../interfaces/private-sale-deal-desk.js";
import type { RecordTransferError } from "./deal-payment-settlement.service.js";
import { type DealStaffViewer, TERM_RULES } from "./deal-staff-permissions.js";

/** The deal transition behind each staff move; a refund is not one. */
export const STAFF_COMMANDS: Readonly<Partial<Record<StaffDealAction, DealCommand>>> = {
  open_offer: "open_offer",
  agree: "agree",
  clear: "clear",
  issue_invoice: "issue_invoice",
  release: "release",
  cancel: "cancel",
};

export function commandOf(action: StaffDealAction): DealCommand {
  const command = STAFF_COMMANDS[action];
  if (!command) throw new RangeError(`${action} is not a deal transition`);
  return command;
}

export const OFFER_STAGES: ReadonlySet<string> = new Set(["proposed", "offer"]);

export function toBlocker(blocker: DealBlocker): DealActionBlocker {
  return {
    code: blocker.code,
    message: describeDealBlocker(blocker),
    ...(blocker.party ? { party: blocker.party } : {}),
  };
}

/** Reasons that reveal how a check stands. */
const CHECK_CODES: ReadonlySet<string> = new Set([
  "kyc_not_clear",
  "aml_not_clear",
  "source_of_funds_not_satisfied",
  "party_missing",
]);

/**
 * People who may not see the checks are told that the deal waits on them, once, and nothing about
 * whose identity, which screening or whether funds are the reason.
 */
export function redactBlockers(
  viewer: DealStaffViewer,
  blockers: DealActionBlocker[],
): DealActionBlocker[] {
  if (viewer.checks) return blockers;
  const kept = blockers.filter((b) => !CHECK_CODES.has(b.code));
  return kept.length === blockers.length
    ? kept
    : [
        ...kept,
        { code: "checks_pending", message: describeDealBlocker({ code: "checks_pending" }) },
      ];
}

/** Whether a term is still open on this deal in its stage. */
export function termIsOpen(deal: PrivateSaleDealDetail, field: keyof AdminDealTerms): boolean {
  const { field: term } = TERM_RULES[field];
  return term === null ? OFFER_STAGES.has(deal.stage) : dealTermIsEditable(deal.stage, term);
}

export const REFUND_BLOCKERS: Readonly<
  Record<
    | "nothing_to_refund"
    | "invalid_amount"
    | "payout_queued"
    | "refund_unavailable"
    | "bank_transfer_payment"
    | "not_a_recorded_transfer",
    DealActionBlocker
  >
> = {
  bank_transfer_payment: {
    code: "bank_transfer_payment",
    message:
      "This payment came by bank transfer that finance recorded. Record the refund you made at the bank instead.",
  },
  not_a_recorded_transfer: {
    code: "not_a_recorded_transfer",
    message:
      "This payment went through the checkout, so it is refunded with Refund the buyer, not by recording a bank refund.",
  },
  invalid_amount: {
    code: "refund_amount_invalid",
    message: "Enter an amount of at least one penny and no more than is left to return.",
  },
  nothing_to_refund: {
    code: "no_payment_to_refund",
    message: "The buyer has not paid, so there is nothing to refund.",
  },
  payout_queued: {
    code: "payout_queued",
    message: "The seller's payout already includes this deal, so it cannot be refunded here.",
  },
  refund_unavailable: {
    code: "refund_unavailable",
    message: "The refund could not be made. Finance can return the money from the payment.",
  },
};

/** Why a bank transfer could not be recorded, in words for finance. */
export const TRANSFER_BLOCKERS: Readonly<Record<RecordTransferError, DealActionBlocker>> = {
  not_found: { code: "deal_not_found", message: "This deal could not be found." },
  not_invoiced: {
    code: "deal_not_invoiced",
    message: "The deal is not waiting for payment, so a transfer can't be recorded.",
  },
  buyer_missing: { code: "buyer_not_named", message: "Name the buyer first." },
  amount_mismatch: {
    code: "transfer_amount_mismatch",
    message: "The amount must be exactly what the buyer owes, including any buyer's fee.",
  },
  already_paid: { code: "already_paid", message: "This deal has already been paid." },
  checkout_completed: {
    code: "checkout_completed",
    message:
      "The buyer has finished their checkout, so money may still arrive. Wait for it, or ask the buyer, before recording a transfer.",
  },
  checkout_not_ended: {
    code: "checkout_not_ended",
    message:
      "The buyer's checkout could not be confirmed ended, so it could still be paid. Try again in a moment.",
  },
  transfer_in_flight: {
    code: "transfer_in_flight",
    message:
      "The buyer's own bank transfer is on its way. Wait for it to land; it is recorded automatically.",
  },
};
