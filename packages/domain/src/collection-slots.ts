import { BUSINESS_TIME_ZONE } from "./calendar-year.js";
import {
  type CollectionCalendar,
  type CollectionException,
  type CollectionWeeklyHours,
  type MinuteRange,
  createCollectionCalendar,
  noticeDeadline,
} from "./collection-calendar.js";
import type { CollectionRules } from "./collection-rules.js";
import { type DateKey, addDaysToKey, dateKeyParts, londonDateKey } from "./collection-time.js";
import { zonedInstant } from "./working-hours.js";

const MINUTE_MS = 60_000;

export type CollectionSlotState =
  /** At least one place is free and the notice window is open. */
  | "open"
  /** Every place is taken. */
  | "full"
  /** The notice deadline has passed. */
  | "too_soon";

export type CollectionSlot = {
  start: Date;
  end: Date;
  placesLeft: number;
  state: CollectionSlotState;
};

/** How a day reads on the booking calendar. */
export type CollectionDayState = "open" | "full" | "closed" | "sale_day" | "too_soon";

export type CollectionDay = {
  date: DateKey;
  state: CollectionDayState;
  /** Visits a buyer can book that day ("7 times"). */
  openSlots: number;
  slots: CollectionSlot[];
};

export type CollectionSlotsInput = {
  hours: readonly CollectionWeeklyHours[];
  exceptions: readonly CollectionException[];
  rules: CollectionRules;
  now: Date;
  /** Places already taken by active bookings, keyed by the visit's start in epoch milliseconds. */
  takenPlaces?: ReadonlyMap<number, number>;
};

/** The instants of the visits one range holds: each ends by closing time, on real elapsed time. */
function visitsIn(date: DateKey, range: MinuteRange, visitMinutes: number): [Date, Date][] {
  const parts = dateKeyParts(date);
  const closes = zonedInstant(parts, range.closes, BUSINESS_TIME_ZONE).getTime();
  const visits: [Date, Date][] = [];
  let start = zonedInstant(parts, range.opens, BUSINESS_TIME_ZONE).getTime();
  while (start + visitMinutes * MINUTE_MS <= closes) {
    visits.push([new Date(start), new Date(start + visitMinutes * MINUTE_MS)]);
    start += visitMinutes * MINUTE_MS;
  }
  return visits;
}

function overlaps(visit: [Date, Date], closed: [Date, Date][]): boolean {
  return closed.some(([from, to]) => visit[0] < to && from < visit[1]);
}

function visitsOnDay(
  calendar: CollectionCalendar,
  date: DateKey,
  visitMinutes: number,
): [Date, Date][] {
  const plan = calendar.plan(date);
  if (plan.kind === "closed") return [];
  const parts = dateKeyParts(date);
  const closed = plan.closedRanges.map((r): [Date, Date] => [
    zonedInstant(parts, r.opens, BUSINESS_TIME_ZONE),
    zonedInstant(parts, r.closes, BUSINESS_TIME_ZONE),
  ]);
  const byStart = new Map<number, [Date, Date]>();
  for (const range of plan.ranges) {
    for (const visit of visitsIn(date, range, visitMinutes)) {
      if (!overlaps(visit, closed)) byStart.set(visit[0].getTime(), visit);
    }
  }
  return [...byStart.values()].sort((a, b) => a[0].getTime() - b[0].getTime());
}

function dayState(plan: CollectionDay["state"], slots: CollectionSlot[]): CollectionDayState {
  if (slots.length === 0) return plan;
  if (slots.every((s) => s.state === "too_soon")) return "too_soon";
  return slots.some((s) => s.state === "open") ? "open" : "full";
}

/**
 * The booking calendar: every day from today (London) for the booking window, each with its
 * visits. Visits come from the weekly hours, plus extra openings, minus closures; a visit exists
 * only if it ends by closing time. A visit is `too_soon` once its notice deadline has passed, and
 * `full` when every place is taken. Days beyond the window are not returned.
 */
export function collectionSlots(input: CollectionSlotsInput): CollectionDay[] {
  const { hours, exceptions, rules, now, takenPlaces } = input;
  const calendar = createCollectionCalendar({ hours, exceptions, rules });
  const today = londonDateKey(now);
  const days: CollectionDay[] = [];
  for (let i = 0; i < rules.windowDays; i++) {
    const date = addDaysToKey(today, i);
    const plan = calendar.plan(date);
    const slots = visitsOnDay(calendar, date, rules.visitMinutes).map(([start, end]) => {
      const placesLeft = Math.max(
        0,
        rules.placesPerSlot - (takenPlaces?.get(start.getTime()) ?? 0),
      );
      const deadline = noticeDeadline(start, rules, calendar);
      const state: CollectionSlotState =
        deadline === null || now.getTime() > deadline.getTime()
          ? "too_soon"
          : placesLeft === 0
            ? "full"
            : "open";
      return { start, end, placesLeft, state };
    });
    const base: CollectionDayState = plan.kind === "closed" ? plan.reason : "closed";
    days.push({
      date,
      state: dayState(base, slots),
      openSlots: slots.filter((s) => s.state === "open").length,
      slots,
    });
  }
  return days;
}

/** The first visit a buyer can book, or `null` when the window has none ("No times left"). */
export function earliestOpenSlot(days: readonly CollectionDay[]): CollectionSlot | null {
  for (const day of days) {
    const slot = day.slots.find((s) => s.state === "open");
    if (slot) return slot;
  }
  return null;
}

export type SlotRefusal =
  /** The start is not a visit the place offers in the window. */
  | "unknown_slot"
  /** The notice deadline has passed. */
  | "notice_passed"
  /** Every place is taken. */
  | "slot_full";

/** Why the requested start cannot be booked, or `null` when it can. */
export function slotRefusal(days: readonly CollectionDay[], start: Date): SlotRefusal | null {
  for (const day of days) {
    const slot = day.slots.find((s) => s.start.getTime() === start.getTime());
    if (!slot) continue;
    if (slot.state === "too_soon") return "notice_passed";
    return slot.state === "full" ? "slot_full" : null;
  }
  return "unknown_slot";
}
