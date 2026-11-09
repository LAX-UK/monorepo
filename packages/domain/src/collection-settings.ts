import { BUSINESS_TIME_ZONE } from "./calendar-year.js";
import {
  type CollectionException,
  type CollectionWeeklyHours,
  createCollectionCalendar,
} from "./collection-calendar.js";
import type { CollectionRules } from "./collection-rules.js";
import { dateKeyParts, londonDateKey, parseLocalTime } from "./collection-time.js";
import { zonedInstant } from "./working-hours.js";

// ---- weekly hours --------------------------------------------------------------------------

/** The most opening ranges one weekday can have (a morning, an afternoon, an evening). */
export const MAX_RANGES_PER_WEEKDAY = 4;

export type HoursIssueCode =
  /** The time is not a 24-hour "HH:MM". */
  | "time_invalid"
  /** Closing must be after opening. */
  | "closes_not_after_opens"
  /** Two ranges on the same day overlap or touch. */
  | "overlap"
  | "weekday_invalid"
  | "too_many_ranges";

export type HoursIssue = {
  weekday: number;
  /** Which of the day's ranges (in the order given), from 0. */
  index: number;
  code: HoursIssueCode;
};

/**
 * What is wrong with a week of opening hours, each problem with the day and range it belongs to
 * so the form can mark that row. Empty when the week can be saved.
 */
export function weeklyHoursIssues(hours: readonly CollectionWeeklyHours[]): HoursIssue[] {
  const issues: HoursIssue[] = [];
  const perDay = new Map<number, { opens: number; closes: number; index: number }[]>();
  const seenOnDay = new Map<number, number>();
  for (const range of hours) {
    const index = seenOnDay.get(range.weekday) ?? 0;
    seenOnDay.set(range.weekday, index + 1);
    if (!Number.isInteger(range.weekday) || range.weekday < 1 || range.weekday > 7) {
      issues.push({ weekday: range.weekday, index, code: "weekday_invalid" });
      continue;
    }
    if (index >= MAX_RANGES_PER_WEEKDAY) {
      issues.push({ weekday: range.weekday, index, code: "too_many_ranges" });
      continue;
    }
    const opens = parseLocalTime(range.opensLocal);
    const closes = parseLocalTime(range.closesLocal);
    if (opens === null || closes === null) {
      issues.push({ weekday: range.weekday, index, code: "time_invalid" });
      continue;
    }
    if (closes <= opens) {
      issues.push({ weekday: range.weekday, index, code: "closes_not_after_opens" });
      continue;
    }
    perDay.set(range.weekday, [...(perDay.get(range.weekday) ?? []), { opens, closes, index }]);
  }
  for (const [weekday, ranges] of perDay) {
    const ordered = [...ranges].sort((a, b) => a.opens - b.opens);
    for (let i = 1; i < ordered.length; i += 1) {
      const previous = ordered[i - 1];
      const current = ordered[i];
      if (previous && current && current.opens <= previous.closes) {
        issues.push({ weekday, index: current.index, code: "overlap" });
      }
    }
  }
  return issues;
}

/** The week with each day's ranges in time order, so equal weeks compare equal. */
export function normaliseWeeklyHours(
  hours: readonly CollectionWeeklyHours[],
): CollectionWeeklyHours[] {
  return [...hours].sort(
    (a, b) => a.weekday - b.weekday || a.opensLocal.localeCompare(b.opensLocal),
  );
}

// ---- closures and extra openings -----------------------------------------------------------

export type ExceptionIssueCode =
  | "date_invalid"
  | "ends_before_start"
  | "time_invalid"
  | "closes_not_after_opens"
  /** Only one of the two times was given. */
  | "hours_incomplete"
  /** The run of days is longer than a year. */
  | "too_long";

/** The longest run of days one closure or opening may cover. */
export const MAX_EXCEPTION_DAYS = 366;

export type ExceptionDraft = Pick<
  CollectionException,
  "kind" | "startsOn" | "endsOn" | "opensLocal" | "closesLocal"
>;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function validDay(value: string): boolean {
  if (!DATE_KEY.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** What is wrong with a closure or extra opening a staff member wants to add. */
export function exceptionDraftIssues(draft: ExceptionDraft): ExceptionIssueCode[] {
  const issues: ExceptionIssueCode[] = [];
  if (!validDay(draft.startsOn) || !validDay(draft.endsOn)) return ["date_invalid"];
  if (draft.endsOn < draft.startsOn) issues.push("ends_before_start");
  else {
    const days = (Date.parse(draft.endsOn) - Date.parse(draft.startsOn)) / 86_400_000 + 1;
    if (days > MAX_EXCEPTION_DAYS) issues.push("too_long");
  }
  const hasOpens = draft.opensLocal !== null;
  const hasCloses = draft.closesLocal !== null;
  if (hasOpens !== hasCloses) issues.push("hours_incomplete");
  else if (draft.opensLocal !== null && draft.closesLocal !== null) {
    const opens = parseLocalTime(draft.opensLocal);
    const closes = parseLocalTime(draft.closesLocal);
    if (opens === null || closes === null) issues.push("time_invalid");
    else if (closes <= opens) issues.push("closes_not_after_opens");
  }
  return issues;
}

// ---- sale days -----------------------------------------------------------------------------

export type SaleForClosure = {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  deliveryMode: "online" | "onsite" | "hybrid";
  status: "draft" | "scheduled" | "active" | "ended" | "cancelled";
};

export type SaleDayClosure = CollectionException & { saleId: string; saleTitle: string };

/**
 * The days a sale at this place closes collections: live and hybrid sales that are not draft or
 * cancelled, for every London day from the sale's start to its end. Online-only sales close
 * nothing. They are worked out when read, so a sale that moves or is cancelled needs no clean-up.
 */
export function saleDayClosures(sales: readonly SaleForClosure[]): SaleDayClosure[] {
  return sales
    .filter(
      (sale) =>
        (sale.deliveryMode === "onsite" || sale.deliveryMode === "hybrid") &&
        sale.status !== "draft" &&
        sale.status !== "cancelled",
    )
    .map((sale) => {
      const startsOn = londonDateKey(sale.startTime);
      const last = londonDateKey(sale.endTime);
      return {
        kind: "closure" as const,
        startsOn,
        endsOn: last < startsOn ? startsOn : last,
        opensLocal: null,
        closesLocal: null,
        source: "sale" as const,
        saleId: sale.id,
        saleTitle: sale.title,
      };
    });
}

// ---- what a change does to bookings already made -------------------------------------------

export type LiveBooking = {
  id: string;
  reference: string;
  slotStart: Date;
  slotEnd: Date;
  seat: number;
  overCapacity: boolean;
};

export type AffectedReason =
  /** The day is closed. */
  | "closed"
  /** The day is open but the visit is outside the opening hours, or inside a closed part. */
  | "outside_hours"
  /** The place now has fewer places at once than the seat this booking holds. */
  | "over_capacity";

export type AffectedBooking = { bookingId: string; reference: string; reason: AffectedReason };

export type CollectionConfiguration = {
  hours: readonly CollectionWeeklyHours[];
  exceptions: readonly CollectionException[];
  rules: Pick<CollectionRules, "closeOnSaleDays" | "placesPerSlot">;
};

/**
 * The live bookings that would no longer fit if the place were set up as `next`. A booking is
 * judged on where it sits (its day open, its whole visit inside the opening hours and clear of any
 * closed hours) and on its place number against the new places at once; a staff booking made over
 * capacity on purpose is left alone. A change never cancels anything by itself: this is what staff
 * are shown before they decide.
 */
export function bookingsAffectedBy(
  bookings: readonly LiveBooking[],
  next: CollectionConfiguration,
): AffectedBooking[] {
  const calendar = createCollectionCalendar({
    hours: next.hours,
    exceptions: next.exceptions,
    rules: next.rules,
  });
  const affected: AffectedBooking[] = [];
  for (const booking of bookings) {
    const reason = reasonFor(booking, calendar.plan(londonDateKey(booking.slotStart)), next);
    if (reason) {
      affected.push({ bookingId: booking.id, reference: booking.reference, reason });
    }
  }
  return affected.sort((a, b) => a.reference.localeCompare(b.reference));
}

function reasonFor(
  booking: LiveBooking,
  plan: ReturnType<ReturnType<typeof createCollectionCalendar>["plan"]>,
  next: CollectionConfiguration,
): AffectedReason | null {
  if (plan.kind === "closed") return "closed";
  const date = londonDateKey(booking.slotStart);
  const parts = dateKeyParts(date);
  const at = (minutes: number) => zonedInstant(parts, minutes, BUSINESS_TIME_ZONE).getTime();
  const start = booking.slotStart.getTime();
  const end = booking.slotEnd.getTime();
  const inside = plan.ranges.some((range) => at(range.opens) <= start && end <= at(range.closes));
  const clashes = plan.closedRanges.some(
    (range) => start < at(range.closes) && at(range.opens) < end,
  );
  if (!inside || clashes) return "outside_hours";
  if (!booking.overCapacity && booking.seat > next.rules.placesPerSlot) return "over_capacity";
  return null;
}

/** The years a bank holiday import covers from `now`: this year and the next `ahead`. */
export function bankHolidayYears(now: Date, ahead = 2): number[] {
  const year = Number(londonDateKey(now).slice(0, 4));
  return Array.from({ length: ahead + 1 }, (_, i) => year + i);
}
