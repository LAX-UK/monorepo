import type { SaleCancelledAudience } from "@auction/branding";
import type { SaleCancelledPeople } from "../../interfaces/notification-fanout.reader.js";

export type SaleCancelledRecipient = {
  userId: string;
  /** The account the notice is about; `null` for the person's own. */
  legalEntityId: string | null;
  audience: SaleCancelledAudience;
};

/** A member of a consignor's organisation, who hears about the consignor's lots. */
export type ConsignorMember = { userId: string; legalEntityId: string };

/**
 * One notice per person for a cancelled sale, however many lots or roles they had in it. Where a
 * person has several, the one with the most at stake wins: a bidder hears their bids are void
 * before they hear about a watched lot or a booking, and a consignor hears about their lots
 * before a watcher does. Watchers and telephone clients read the same plain notice.
 */
export function planSaleCancelledRecipients(
  people: SaleCancelledPeople,
  consignorMembers: readonly ConsignorMember[],
): SaleCancelledRecipient[] {
  const byUser = new Map<string, SaleCancelledRecipient>();
  const add = (userId: string, legalEntityId: string | null, audience: SaleCancelledAudience) => {
    if (!byUser.has(userId)) byUser.set(userId, { userId, legalEntityId, audience });
  };
  for (const b of people.bidders) add(b.userId, b.legalEntityId, "bidder");
  for (const m of consignorMembers) add(m.userId, m.legalEntityId, "consignor");
  for (const t of people.telephoneClients) add(t.userId, t.legalEntityId, "other");
  for (const userId of people.watcherUserIds) add(userId, null, "other");
  return [...byUser.values()];
}
