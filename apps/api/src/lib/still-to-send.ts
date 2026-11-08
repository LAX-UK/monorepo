import { type StillToSend, type StillToSendGroup, stillToSendByLot } from "@auction/domain";
import type { BidPaymentGroupFact } from "@auction/persistence/interfaces";
import { gbpAmountToPence } from "./decimal-money.js";

/** An invoice's payment, with the combined payment it is settled through (if any). */
export type GroupedPayment = {
  lotId: string;
  status: string;
  /** The invoice total, a decimal string in pounds. */
  amount: string;
  group: BidPaymentGroupFact | null;
};

function toPence(value: string): number | null {
  const pence = gbpAmountToPence(value);
  return Number.isFinite(pence) ? pence : null;
}

/**
 * What each invoice of a part-funded bank transfer still has to send, by lot. Every screen that
 * says "still to send" reads this, so the figure is the same on each of them. The remainder is
 * spread over the invoices given here only: callers pass the invoices their screen shows, so a
 * sibling the screen does not list carries a share this result does not account for.
 */
export function stillToSendOfPayments(
  payments: readonly GroupedPayment[],
): Map<string, StillToSend> {
  const groups = new Map<string, StillToSendGroup>();
  for (const payment of payments) {
    const { group } = payment;
    const amountPence = toPence(payment.amount);
    const totalPence = group ? toPence(group.totalAmount) : null;
    const receivedPence = group ? toPence(group.amountReceived) : null;
    if (!group || amountPence === null || totalPence === null || receivedPence === null) continue;
    const known = groups.get(group.id) ?? {
      id: group.id,
      status: group.status,
      rail: group.checkoutRail === "card" ? ("card" as const) : ("gb_bank_transfer" as const),
      totalPence,
      receivedPence,
      members: [],
    };
    groups.set(group.id, {
      ...known,
      members: [...known.members, { lotId: payment.lotId, status: payment.status, amountPence }],
    });
  }
  return stillToSendByLot([...groups.values()]);
}
