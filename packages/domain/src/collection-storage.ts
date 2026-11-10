import { type DateKey, addDaysToKey, londonDateKey } from "./collection-time.js";

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

export type CollectBy = {
  /** "Please collect by" day, in London. */
  date: DateKey;
  /** The days a reminder goes: the lead time before, and the day itself. */
  reminderDates: [DateKey, DateKey];
};

/** The "Please collect by" day: the London day payment cleared plus the free storage period. */
export function collectBy(
  clearedAt: Date,
  policy: CollectByPolicy = DEFAULT_COLLECT_BY_POLICY,
): CollectBy {
  const date = addDaysToKey(londonDateKey(clearedAt), policy.freeStorageDays);
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
): CollectByReminder | null {
  const { date, reminderDates } = collectBy(clearedAt, policy);
  if (today === date) return { kind: "day", collectBy: date };
  const early = policy.freeStorageDays > policy.reminderLeadDays;
  if (early && today >= reminderDates[0] && today < date) return { kind: "lead", collectBy: date };
  return null;
}

/**
 * The London days payment must have cleared on for a purchase to be due a reminder on `today`,
 * first to last: from the free period ago to the free period less the lead ago.
 */
export function collectByClearedRange(
  today: DateKey,
  policy: CollectByPolicy = DEFAULT_COLLECT_BY_POLICY,
): { from: DateKey; to: DateKey } {
  const early = policy.freeStorageDays > policy.reminderLeadDays;
  return {
    from: addDaysToKey(today, -policy.freeStorageDays),
    to: addDaysToKey(
      today,
      -(early ? policy.freeStorageDays - policy.reminderLeadDays : policy.freeStorageDays),
    ),
  };
}
