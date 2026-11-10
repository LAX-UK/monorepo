import { createHash } from "node:crypto";
import {
  type CollectByReminderKind,
  DEFAULT_COLLECT_BY_POLICY,
  collectByReminderFor,
  formatCollectionDay,
  londonDateKey,
} from "@auction/domain";
import type { EmailEnqueueInput } from "@auction/email";
import type { StoredLot } from "../interfaces/collect-by.reader.js";
import type { NoticeRecipient } from "./collection-notices.js";

/** The most lots the booking page takes in one link. */
const MAX_LOTS_IN_LINK = 20;

/** The lots one account is reminded about together: same place, kind of reminder and deadline. */
export type CollectByGroup = {
  legalEntityId: string;
  venueId: string;
  kind: CollectByReminderKind;
  /** The deadline, a London day. */
  collectBy: string;
  place: StoredLot["place"];
  lots: StoredLot[];
};

/**
 * Which storage reminders are due today, as groups of lots by account, place and reminder. The
 * place's free period decides each lot's deadline; the early reminder is due from a week before
 * it, the one on the day on the deadline only.
 */
export function collectByGroups(lots: readonly StoredLot[], today: string): CollectByGroup[] {
  const groups = new Map<string, CollectByGroup>();
  for (const stored of lots) {
    const policy = {
      ...DEFAULT_COLLECT_BY_POLICY,
      freeStorageDays: stored.freeStorageDays ?? DEFAULT_COLLECT_BY_POLICY.freeStorageDays,
    };
    const due = collectByReminderFor(stored.clearedAt, today, policy);
    if (!due) continue;
    const key = [stored.legalEntityId, stored.venueId, due.kind, due.collectBy].join("|");
    const group = groups.get(key) ?? {
      legalEntityId: stored.legalEntityId,
      venueId: stored.venueId,
      kind: due.kind,
      collectBy: due.collectBy,
      place: stored.place,
      lots: [],
    };
    group.lots.push(stored);
    groups.set(key, group);
  }
  return [...groups.values()];
}

const lotLine = (lot: { title: string; lotNumber: number | null }) =>
  lot.lotNumber != null ? `Lot ${lot.lotNumber} · ${lot.title}` : lot.title;

/** A short stamp of which lots an email is about, so lots that become eligible later get their own. */
const lotSetStamp = (lots: readonly StoredLot[]): string =>
  createHash("sha256")
    .update(
      lots
        .map((lot) => lot.lotId)
        .sort()
        .join(","),
    )
    .digest("hex")
    .slice(0, 12);

/** What every email to one person about one reminder's deadline has in common in its key. */
export const collectByKeyPrefix = (group: CollectByGroup, userId: string): string =>
  `${[
    "collection-collect-by",
    group.kind,
    group.legalEntityId,
    group.venueId,
    group.collectBy,
    userId,
  ].join(":")}:`;

/** The key of one reminder to one person: that prefix, and the lots the email is about. */
export const collectByKey = (group: CollectByGroup, userId: string): string =>
  `${collectByKeyPrefix(group, userId)}${lotSetStamp(group.lots)}`;

/**
 * The email for one group to each person who hears about the account's purchases. Pure: it reads
 * nothing and sends nothing. The key names the person by their id, never their address, and the
 * lots it is about: a retry or another sweep sends nothing twice, and a lot that becomes eligible
 * later the same day (a check closes) is reminded about in an email of its own.
 */
export function collectByEmailsFor(
  group: CollectByGroup,
  people: readonly (NoticeRecipient & { wonOnly?: boolean })[],
  config: { webOrigin: string; now: Date },
): EmailEnqueueInput<"collection-collect-by">[] {
  const collectByLabel = formatCollectionDay(new Date(`${group.collectBy}T12:00:00Z`), config.now);
  const seen = new Set<string>();
  const emails: EmailEnqueueInput<"collection-collect-by">[] = [];
  for (const person of people) {
    if (seen.has(person.userId)) continue;
    seen.add(person.userId);
    // An agent who is not an owner or admin is told only about the lots they won.
    const own: CollectByGroup = {
      ...group,
      lots: person.wonOnly
        ? group.lots.filter((lot) => lot.winnerId === person.userId)
        : group.lots,
    };
    if (own.lots.length === 0) continue;
    const lotIds = own.lots.map((lot) => lot.lotId);
    emails.push({
      template: "collection-collect-by",
      vars: {
        userName: person.firstName,
        when: group.kind,
        collectByLabel,
        placeName: group.place.name,
        address: group.place.address,
        lots: own.lots.map(lotLine),
        lotIds,
        bookUrl: `${config.webOrigin}/purchases/collect?lots=${lotIds.slice(0, MAX_LOTS_IN_LINK).join(",")}`,
        storagePolicyUrl: `${config.webOrigin}/shipping#storage`,
        quoteUrl: `${config.webOrigin}/purchases`,
      },
      to: person.email,
      userId: person.userId,
      idempotencyKey: collectByKey(own, person.userId),
      category: "transactional",
    });
  }
  return emails;
}

/** The London day of an instant, for the sweep. */
export const today = (at: Date): string => londonDateKey(at);
