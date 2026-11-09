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

export type CollectByReminderKind = "lead" | "day";

/** A storage reminder that goes today, and for which purchases. */
export type CollectByReminderDue = {
  kind: CollectByReminderKind;
  /** The London day payment must have cleared on for this reminder to be today's. */
  clearedOn: DateKey;
  /** The "please collect by" day those purchases share. */
  collectBy: DateKey;
};

/**
 * The storage reminders that go on `today` (a London day): the one a week before the deadline and
 * the one on the day. Each is for the purchases that cleared on one particular day, so a lot is
 * reminded once for each, however often the sweep runs. A free period no longer than the lead has
 * no early reminder, because it would fall on or before the day payment cleared.
 */
export function collectByRemindersDue(
  today: DateKey,
  policy: CollectByPolicy = DEFAULT_COLLECT_BY_POLICY,
): CollectByReminderDue[] {
  const due: CollectByReminderDue[] = [];
  if (policy.freeStorageDays > policy.reminderLeadDays) {
    due.push({
      kind: "lead",
      clearedOn: addDaysToKey(today, -(policy.freeStorageDays - policy.reminderLeadDays)),
      collectBy: addDaysToKey(today, policy.reminderLeadDays),
    });
  }
  due.push({
    kind: "day",
    clearedOn: addDaysToKey(today, -policy.freeStorageDays),
    collectBy: today,
  });
  return due;
}
