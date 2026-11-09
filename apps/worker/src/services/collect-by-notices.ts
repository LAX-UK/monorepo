import {
  type CollectByReminderKind,
  DEFAULT_COLLECT_BY_POLICY,
  collectByRemindersDue,
  formatCollectionDay,
  londonDateKey,
} from "@auction/domain";
import type { EmailEnqueueInput } from "@auction/email";
import type { StoredLot } from "../interfaces/collect-by.reader.js";
import type { NoticeRecipient } from "./collection-notices.js";

/** The lots one account is reminded about together: same place, kind of reminder and deadline. */
export type CollectByGroup = {
  legalEntityId: string;
  kind: CollectByReminderKind;
  /** The deadline, a London day. */
  collectBy: string;
  place: StoredLot["place"];
  lots: StoredLot[];
};

/**
 * Which storage reminders go today, as groups of lots by account, place and reminder. A lot is in
 * a group only when its payment cleared on the day the reminder is for, which is what makes each
 * lot reminded once however often the sweep runs. The place's free period decides the deadline.
 */
export function collectByGroups(lots: readonly StoredLot[], today: string): CollectByGroup[] {
  const groups = new Map<string, CollectByGroup>();
  for (const stored of lots) {
    const policy = {
      ...DEFAULT_COLLECT_BY_POLICY,
      freeStorageDays: stored.freeStorageDays ?? DEFAULT_COLLECT_BY_POLICY.freeStorageDays,
    };
    const clearedOn = londonDateKey(stored.clearedAt);
    const due = collectByRemindersDue(today, policy).find((d) => d.clearedOn === clearedOn);
    if (!due) continue;
    const key = [stored.legalEntityId, stored.place.name, due.kind, due.collectBy].join("|");
    const group = groups.get(key) ?? {
      legalEntityId: stored.legalEntityId,
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

/**
 * The email for one group to each person who hears about the account's purchases. Pure: it reads
 * nothing and sends nothing. The key names the reminder, the account, the deadline and the
 * address, so a retry or another sweep sends nothing twice.
 */
export function collectByEmailsFor(
  group: CollectByGroup,
  people: readonly NoticeRecipient[],
  config: { webOrigin: string; now: Date },
): EmailEnqueueInput[] {
  const collectByLabel = formatCollectionDay(new Date(`${group.collectBy}T12:00:00Z`), config.now);
  const seen = new Set<string>();
  const emails: EmailEnqueueInput[] = [];
  for (const person of people) {
    const address = person.email.toLowerCase();
    if (seen.has(address)) continue;
    seen.add(address);
    emails.push({
      template: "collection-collect-by",
      vars: {
        userName: person.firstName,
        when: group.kind,
        collectByLabel,
        placeName: group.place.name,
        address: group.place.address,
        lots: group.lots.map(lotLine),
        bookUrl: `${config.webOrigin}/purchases`,
      },
      to: person.email,
      userId: person.userId,
      idempotencyKey: `collection-collect-by:${group.kind}:${group.legalEntityId}:${group.collectBy}:${address}`,
      category: "transactional",
    } as EmailEnqueueInput);
  }
  return emails;
}
