import type { CheckoutRailKind } from "./payment-tier-policy.js";

/**
 * A bank transfer that has delivered part of a combined payment: what the buyer still has to
 * send, shared across the invoices it pays. Pure and in whole pence, so every screen that says
 * "still to send" reads one figure and the shares always add up to it.
 */

export type StillToSendGroup = {
  id: string;
  status: string;
  rail: CheckoutRailKind;
  totalPence: number;
  /** What the transfer has delivered so far, as the provider reported it. */
  receivedPence: number;
  /** The invoices the group pays, with the status of each one's payment. */
  members: readonly { lotId: string; status: string; amountPence: number }[];
};

export type StillToSend = { groupId: string; pence: number };

/**
 * The share of the remainder each invoice carries, by lot. Only a bank transfer that is under way
 * (`processing`), has delivered something and has not delivered everything leaves anything to
 * send: money received is clamped to the total, so a transfer that is complete or over what was
 * asked leaves nothing, and a card or an unfunded transfer is not a part-funded one. The
 * remainder is shared in proportion to each invoice's amount; leftover pence go to the largest
 * fractions, ties to the lot id, so the result never depends on the order of the input.
 */
export function stillToSendByLot(groups: readonly StillToSendGroup[]): Map<string, StillToSend> {
  const byLot = new Map<string, StillToSend>();
  for (const group of groups) {
    if (group.status !== "processing" || group.rail === "card") continue;
    const total = Math.max(0, group.totalPence);
    const received = Math.min(Math.max(0, group.receivedPence), total);
    const remaining = total - received;
    if (received === 0 || remaining === 0) continue;

    const members = group.members
      .filter((member) => member.status === "authorized" && member.amountPence > 0)
      .sort((a, b) => (a.lotId < b.lotId ? -1 : a.lotId > b.lotId ? 1 : 0));
    const weight = members.reduce((sum, member) => sum + BigInt(member.amountPence), 0n);
    if (weight === 0n) continue;

    const shares = members.map((member) => {
      const exact = BigInt(remaining) * BigInt(member.amountPence);
      return { lotId: member.lotId, pence: exact / weight, fraction: exact % weight };
    });
    let leftover = BigInt(remaining) - shares.reduce((sum, share) => sum + share.pence, 0n);
    const byFraction = [...shares].sort((a, b) =>
      a.fraction === b.fraction ? 0 : a.fraction > b.fraction ? -1 : 1,
    );
    for (const share of byFraction) {
      if (leftover === 0n) break;
      share.pence += 1n;
      leftover -= 1n;
    }
    for (const share of shares) {
      if (share.pence > 0n)
        byLot.set(share.lotId, { groupId: group.id, pence: Number(share.pence) });
    }
  }
  return byLot;
}
