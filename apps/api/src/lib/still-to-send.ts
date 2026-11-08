import { type StillToSend, type StillToSendGroup, stillToSendByLot } from "@auction/domain";
import type { BidPaymentGroupFact } from "@auction/persistence/interfaces";
import { gbpAmountToPence } from "./decimal-money.js";

/** An invoice's payment, with the combined payment it is settled through (if any). */
export type GroupedPayment = {
  lotId: string;
  group: BidPaymentGroupFact | null;
};

function toPence(value: string): number | null {
  const pence = gbpAmountToPence(value);
  return Number.isFinite(pence) ? pence : null;
}

/** A group with every one of its invoices, or null when any figure is unreadable. */
function groupOf(group: BidPaymentGroupFact): StillToSendGroup | null {
  const totalPence = toPence(group.totalAmount);
  const receivedPence = toPence(group.amountReceived);
  if (totalPence === null || receivedPence === null) return null;
  const members = group.members.flatMap((member) => {
    const amountPence = toPence(member.amount);
    return amountPence === null
      ? []
      : [{ lotId: member.lotId, status: member.status, amountPence }];
  });
  return {
    id: group.id,
    status: group.status,
    rail: group.checkoutRail === "card" ? "card" : "gb_bank_transfer",
    totalPence,
    receivedPence,
    members,
  };
}

/**
 * What each of the given invoices still has to send on a part-funded bank transfer, by lot. Every
 * screen that says "still to send" reads this, so the figure is the same on each of them. The
 * remainder is shared across the group's whole membership, whoever may see each invoice, and only
 * then are the listed invoices picked out: a lot's share does not depend on which page or account
 * view lists it, and the shares shown never add up to more than the remainder.
 */
export function stillToSendOfPayments(
  payments: readonly GroupedPayment[],
): Map<string, StillToSend> {
  const groups = new Map<string, StillToSendGroup>();
  for (const { group } of payments) {
    if (!group || groups.has(group.id)) continue;
    const known = groupOf(group);
    if (known) groups.set(group.id, known);
  }
  const listed = new Set(payments.map((payment) => payment.lotId));
  const shares = stillToSendByLot([...groups.values()]);
  return new Map([...shares].filter(([lotId]) => listed.has(lotId)));
}
