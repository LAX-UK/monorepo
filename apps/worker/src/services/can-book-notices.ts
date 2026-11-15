import type { EmailEnqueueInput } from "@auction/email";
import type { StoredLot } from "../interfaces/collect-by.reader.js";
import { lotLine, lotSetStamp } from "./collect-by-notices.js";
import type { NoticeRecipient } from "./collection-notices.js";

/** The most lots the booking page takes in one link. */
const MAX_LOTS_IN_LINK = 20;

/** Lots one account can book at one place, told about together. */
export type CanBookGroup = {
  legalEntityId: string;
  venueId: string;
  place: StoredLot["place"];
  lots: StoredLot[];
};

/** The lots by account and place, in the order they were read. */
export function canBookGroups(lots: readonly StoredLot[]): CanBookGroup[] {
  const groups = new Map<string, CanBookGroup>();
  for (const stored of lots) {
    const key = `${stored.legalEntityId}|${stored.venueId}`;
    const group = groups.get(key) ?? {
      legalEntityId: stored.legalEntityId,
      venueId: stored.venueId,
      place: stored.place,
      lots: [],
    };
    group.lots.push(stored);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** What every "you can book" email to one person about one account and place has in its key. */
export const canBookKeyPrefix = (group: CanBookGroup, userId: string): string =>
  `${["collection-can-book", group.legalEntityId, group.venueId, userId].join(":")}:`;

/**
 * The "you can book" email for a group to each person who hears about the account's purchases,
 * naming only the lots that person has not been told about. Pure: it reads nothing and sends
 * nothing. The key names the person by id, never their address, and the lots it is about, so a
 * retry sends nothing twice and a lot that becomes bookable later gets an email of its own.
 */
export function canBookEmailsFor(
  group: CanBookGroup,
  people: readonly (NoticeRecipient & { wonOnly?: boolean })[],
  told: (userId: string) => ReadonlySet<string>,
  config: { webOrigin: string },
): EmailEnqueueInput<"collection-can-book">[] {
  const seen = new Set<string>();
  const emails: EmailEnqueueInput<"collection-can-book">[] = [];
  for (const person of people) {
    if (seen.has(person.userId)) continue;
    seen.add(person.userId);
    const already = told(person.userId);
    // An agent who is not an owner or admin is told only about the lots they won.
    const lots = group.lots.filter(
      (lot) => !already.has(lot.lotId) && (!person.wonOnly || lot.winnerId === person.userId),
    );
    if (lots.length === 0) continue;
    const lotIds = lots.map((lot) => lot.lotId);
    emails.push({
      template: "collection-can-book",
      vars: {
        userName: person.firstName,
        placeName: group.place.name,
        address: group.place.address,
        lots: lots.map(lotLine),
        lotIds,
        bookUrl: `${config.webOrigin}/purchases/collect?lots=${lotIds.slice(0, MAX_LOTS_IN_LINK).join(",")}`,
      },
      to: person.email,
      userId: person.userId,
      idempotencyKey: `${canBookKeyPrefix(group, person.userId)}${lotSetStamp(lots)}`,
      category: "transactional",
    });
  }
  return emails;
}
