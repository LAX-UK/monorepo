import { createHash } from "node:crypto";
import {
  type LotStorageCharge,
  type StorageReminderKind,
  formatCollectionDay,
  formatStorageRateAfter,
  formatStorageRunningTotal,
  londonDateKey,
  lotStorageCharge,
  storageQuotePauses,
  storageReminderFor,
} from "@auction/domain";
import type { EmailEnqueueInput } from "@auction/email";
import type { StoredLot } from "../interfaces/collect-by.reader.js";
import { placeContact } from "./collection-contact.js";
import type { NoticeRecipient } from "./collection-notices.js";

/** The most lots the booking page takes in one link. */
const MAX_LOTS_IN_LINK = 20;

/** A waiting lot with its storage priced on the sweep's day. */
export type PricedLot = StoredLot & { priced: LotStorageCharge };

/**
 * The lots one account is reminded about together: same place, reminder, collect-by day and run of
 * 14 days. The place decides whether storage invoices are raised, so it is the same for the group.
 */
export type CollectByGroup = {
  legalEntityId: string;
  venueId: string;
  kind: StorageReminderKind;
  /** The deadline, a London day. */
  collectBy: string;
  /** 0 before and on the day and for "started"; 1 and on for each running total. */
  cycle: number;
  /** The place raises storage invoices. Off, the email after the day keeps the "may apply" wording. */
  chargingOn: boolean;
  place: StoredLot["place"];
  lots: PricedLot[];
};

/**
 * Which storage reminders are due today, as groups of lots by account, place and reminder. Each
 * lot is priced under the terms it was sold under, with its extensions, waiver and the days LAX
 * held it for a courier quote, through the same rules the buyer's page reads (`lotStorageCharge`),
 * and `storageReminderFor` decides the reminder. A lot that cannot be priced (its place has no
 * opening calendar, or its stored terms are refused) is left out and passed to `onUnpriced`.
 */
export function collectByGroups(
  lots: readonly StoredLot[],
  today: string,
  onUnpriced: (lot: StoredLot, err: unknown) => void = () => {},
): CollectByGroup[] {
  const groups = new Map<string, CollectByGroup>();
  for (const stored of lots) {
    const storage = stored.storage;
    let priced: LotStorageCharge;
    try {
      if (!storage?.calendar) throw new Error("The place has no opening calendar to read");
      priced = lotStorageCharge({
        facts: storage.pricing,
        clearedAt: stored.clearedAt,
        pausedRanges: storageQuotePauses(storage.quote, today),
        calendar: storage.calendar,
        asOf: today,
      });
    } catch (err) {
      onUnpriced(stored, err);
      continue;
    }
    const due = storageReminderFor(
      { ...priced, extensionDays: storage.pricing.extensionDays },
      today,
      storage.chargingOn,
    );
    if (!due) continue;
    const key = [stored.legalEntityId, stored.venueId, due.kind, due.collectBy, due.cycle].join(
      "|",
    );
    const group = groups.get(key) ?? {
      legalEntityId: stored.legalEntityId,
      venueId: stored.venueId,
      kind: due.kind,
      collectBy: due.collectBy,
      cycle: due.cycle,
      chargingOn: storage.chargingOn,
      place: stored.place,
      lots: [],
    };
    group.lots.push({ ...stored, priced });
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** The reminders before the charges start; the others are about charges. */
const isCollectBy = (kind: StorageReminderKind): kind is "lead" | "day" =>
  kind === "lead" || kind === "day";

export const lotLine = (lot: { title: string; lotNumber: number | null }) =>
  lot.lotNumber != null ? `Lot ${lot.lotNumber} · ${lot.title}` : lot.title;

/** A short stamp of which lots an email is about, so lots that become eligible later get their own. */
export const lotSetStamp = (lots: readonly StoredLot[]): string =>
  createHash("sha256")
    .update(
      lots
        .map((lot) => lot.lotId)
        .sort()
        .join(","),
    )
    .digest("hex")
    .slice(0, 12);

/**
 * What every email to one person about one reminder has in common in its key. The reminders
 * before the day keep the key they always had, so a lot reminded before this release is not
 * reminded again; the emails about charges also name the run of 14 days.
 */
export const collectByKeyPrefix = (group: CollectByGroup, userId: string): string =>
  `${(isCollectBy(group.kind)
    ? ["collection-collect-by", group.kind, group.legalEntityId, group.venueId, group.collectBy]
    : [
        "collection-storage",
        group.kind,
        group.legalEntityId,
        group.venueId,
        group.collectBy,
        String(group.cycle),
      ]
  )
    .concat(userId)
    .join(":")}:`;

/** The template of a group's email: the collect-by reminder, or the one about charges. */
export const collectByTemplateOf = (
  group: Pick<CollectByGroup, "kind">,
): "collection-collect-by" | "collection-storage-charges" =>
  isCollectBy(group.kind) ? "collection-collect-by" : "collection-storage-charges";

/** The key of one reminder to one person: that prefix, and the lots the email is about. */
export const collectByKey = (group: CollectByGroup, userId: string): string =>
  `${collectByKeyPrefix(group, userId)}${lotSetStamp(group.lots)}`;

export type CollectByEmail =
  | EmailEnqueueInput<"collection-collect-by">
  | EmailEnqueueInput<"collection-storage-charges">;

/**
 * The email for one group to each person who hears about the account's purchases. Pure: it reads
 * nothing and sends nothing. The key names the person by their id, never their address, and the
 * lots it is about: a retry or another sweep sends nothing twice, and a lot that becomes eligible
 * later the same day (a check closes) is reminded about in an email of its own. Every sentence
 * about storage comes from the domain formatter, so it is what the buyer's page says.
 */
export function collectByEmailsFor(
  group: CollectByGroup,
  people: readonly (NoticeRecipient & { wonOnly?: boolean })[],
  config: { webOrigin: string; now: Date },
): CollectByEmail[] {
  const collectByLabel = formatCollectionDay(new Date(`${group.collectBy}T12:00:00Z`), config.now);
  const seen = new Set<string>();
  const emails: CollectByEmail[] = [];
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
    const common = {
      userName: person.firstName,
      collectByLabel,
      placeName: group.place.name,
      address: group.place.address,
      lots: own.lots.map(lotLine),
      lotIds,
      bookUrl: `${config.webOrigin}/purchases/collect?lots=${lotIds.slice(0, MAX_LOTS_IN_LINK).join(",")}`,
      storagePolicyUrl: `${config.webOrigin}/shipping#storage`,
      ...placeContact(group.place),
    };
    const envelope = {
      to: person.email,
      userId: person.userId,
      idempotencyKey: collectByKey(own, person.userId),
      category: "transactional" as const,
    };
    const { kind } = group;
    if (isCollectBy(kind)) {
      emails.push({
        template: "collection-collect-by",
        vars: {
          ...common,
          when: kind,
          lotRates: own.lots.map(({ priced }) =>
            formatStorageRateAfter(priced.charge, priced.terms, priced.band, config.now),
          ),
          quoteUrl: `${config.webOrigin}/purchases`,
        },
        ...envelope,
      });
      continue;
    }
    emails.push({
      template: "collection-storage-charges",
      vars: {
        ...common,
        kind,
        chargingOn: group.chargingOn,
        // While the place raises no storage invoices, no total is shown: nothing is billed.
        lotTotals: own.lots.map(({ priced }) =>
          group.chargingOn
            ? formatStorageRunningTotal(priced.charge, priced.terms, priced.band)
            : null,
        ),
      },
      ...envelope,
    });
  }
  return emails;
}

/** The London day of an instant, for the sweep. */
export const today = (at: Date): string => londonDateKey(at);
