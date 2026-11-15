import { type CollectionCalendar, nextOpenDay } from "./collection-calendar.js";
import { type DateKey, addDaysToKey, londonDateKey } from "./collection-time.js";
import type { FulfilmentFacts } from "./purchase-delivery-stage.js";

/** How long a bought work waits at the gallery before the buyer is asked to collect it. */
export type CollectByPolicy = {
  /** Days after clearance a work is stored free. 30 until the storage terms are set. */
  freeStorageDays: number;
  /** Days before the date a reminder goes. */
  reminderLeadDays: number;
};

export const DEFAULT_COLLECT_BY_POLICY: CollectByPolicy = {
  freeStorageDays: 30,
  reminderLeadDays: 7,
};

/**
 * The policy for a place: its own free storage period, or the 30 days of a place with no storage
 * terms. Nothing is charged under it; "storage charges may apply" is wording only.
 */
export function collectByPolicyFor(freeStorageDays: number | null): CollectByPolicy {
  return {
    ...DEFAULT_COLLECT_BY_POLICY,
    freeStorageDays: freeStorageDays ?? DEFAULT_COLLECT_BY_POLICY.freeStorageDays,
  };
}

/** The days a place is open, which decide where a "please collect by" day on a closed day moves. */
export type CollectByCalendar = Pick<CollectionCalendar, "plan">;

export type CollectBy = {
  /** "Please collect by" day, in London. */
  date: DateKey;
  /** The days a reminder goes: the lead time before, and the day itself. */
  reminderDates: [DateKey, DateKey];
};

/**
 * The "Please collect by" day: the London day payment cleared plus the free storage period, moved
 * to the next open day when it falls on a closed one. Without a calendar the day does not move.
 */
export function collectBy(
  clearedAt: Date,
  policy: CollectByPolicy = DEFAULT_COLLECT_BY_POLICY,
  calendar?: CollectByCalendar,
): CollectBy {
  const free = addDaysToKey(londonDateKey(clearedAt), policy.freeStorageDays);
  const date = calendar ? nextOpenDay(calendar, free) : free;
  return { date, reminderDates: [addDaysToKey(date, -policy.reminderLeadDays), date] };
}

/** The longest free storage period a place can set, in days. */
export const MAX_FREE_STORAGE_DAYS = 365;

export type CollectByReminderKind = "lead" | "day";

/** A storage reminder a purchase is due, and the deadline it is about. */
export type CollectByReminder = {
  kind: CollectByReminderKind;
  /** The "please collect by" day, a London day. */
  collectBy: DateKey;
};

/**
 * The storage reminder a purchase is due on `today` (a London day), or none. The early reminder is
 * due on any day from a week before the deadline until the day itself, so a sweep that missed a
 * day still sends it; the reminder on the day is due on the deadline only. Each is keyed by its
 * deadline, so a purchase is reminded once for each however often the sweep runs. A free period no
 * longer than the lead has no early reminder, because it would fall on or before the day payment
 * cleared.
 */
export function collectByReminderFor(
  clearedAt: Date,
  today: DateKey,
  policy: CollectByPolicy = DEFAULT_COLLECT_BY_POLICY,
  calendar?: CollectByCalendar,
): CollectByReminder | null {
  const { date, reminderDates } = collectBy(clearedAt, policy, calendar);
  if (today === date) return { kind: "day", collectBy: date };
  const early = policy.freeStorageDays > policy.reminderLeadDays;
  if (early && today >= reminderDates[0] && today < date) return { kind: "lead", collectBy: date };
  return null;
}

/**
 * The London days payment must have cleared on for a purchase to be due a reminder on `today`,
 * first to last: from the free period ago to the free period less the lead ago. A deadline that
 * moves to an open day can be later than the free period, so a caller using a calendar passes the
 * longest it can move (`slackDays`) and the range starts that much earlier.
 */
export function collectByClearedRange(
  today: DateKey,
  policy: CollectByPolicy = DEFAULT_COLLECT_BY_POLICY,
  slackDays = 0,
): { from: DateKey; to: DateKey } {
  const early = policy.freeStorageDays > policy.reminderLeadDays;
  return {
    from: addDaysToKey(today, -policy.freeStorageDays - slackDays),
    to: addDaysToKey(
      today,
      -(early ? policy.freeStorageDays - policy.reminderLeadDays : policy.freeStorageDays),
    ),
  };
}

/** Where a purchase waiting for collection stands against its "please collect by" day. */
export type PurchaseCollectByState = "upcoming" | "soon" | "overdue";

/** The "please collect by" notice a purchase carries while it waits to be collected. */
export type PurchaseCollectBy = {
  /** The "please collect by" day, a London day: the one the reminder email names. */
  date: DateKey;
  /** `soon` from the lead before the day through the day itself; `overdue` once it has passed. */
  state: PurchaseCollectByState;
};

/**
 * The notice a purchase shows on `today` (a London day), from the same day the reminder email
 * names. The caller decides whether the purchase is waiting at a place that takes bookings and
 * is not yet booked or collected; this only reads the day.
 */
export function purchaseCollectBy(
  clearedAt: Date,
  today: DateKey,
  policy: CollectByPolicy = DEFAULT_COLLECT_BY_POLICY,
  calendar?: CollectByCalendar,
): PurchaseCollectBy {
  const { date, reminderDates } = collectBy(clearedAt, policy, calendar);
  if (today > date) return { date, state: "overdue" };
  const early = policy.freeStorageDays > policy.reminderLeadDays;
  return { date, state: today >= (early ? reminderDates[0] : date) ? "soon" : "upcoming" };
}

/** Fulfilment states in which a paid work is no longer waiting to be collected, or not yet. */
const NOT_AWAITING_COLLECTION: ReadonlySet<FulfilmentFacts["status"]> = new Set([
  "awaiting_payment",
  "delivered",
  "cancelled",
  "in_transit",
]);

/** What decides whether a paid purchase still waits at its collection place to be collected. */
export type CollectionWaitFacts = {
  fulfilment: FulfilmentFacts | null;
  /** The lot's sale was soft-deleted. */
  saleDeleted: boolean;
  /** The sale venue's collection place takes online bookings. */
  bookingOpen: boolean;
  /** The lot is in a live (active) collection booking. */
  booked: boolean;
};

/**
 * Whether a purchase whose payment has cleared still waits to be collected, so it carries the
 * "please collect by" notice. The same exclusions as the reminder email's reader
 * (`apps/worker/src/repositories/drizzle-collect-by.reader.ts`), which is tested against this:
 * not handed over, cancelled, on its way or still unpaid; not going by courier; not in a deleted
 * sale; at a place that takes online bookings; and not already booked. The invoice is not read:
 * a refund that leaves the fulfilment open still leaves the work waiting, as the email does.
 */
export function awaitsCollection(facts: CollectionWaitFacts): boolean {
  const { fulfilment } = facts;
  if (!fulfilment || NOT_AWAITING_COLLECTION.has(fulfilment.status)) return false;
  if (fulfilment.method === "shipping") return false;
  return facts.bookingOpen && !facts.booked && !facts.saleDeleted;
}
