import { BUSINESS_TIME_ZONE } from "./calendar-year.js";
import type { CollectionRules } from "./collection-rules.js";
import {
  type DateKey,
  addDaysToKey,
  dateKeyParts,
  isoWeekday,
  londonDateKey,
  parseLocalTime,
} from "./collection-time.js";
import { englandAndWalesBankHolidays, zonedInstant } from "./working-hours.js";

/** One range of opening hours on a weekday (1 is Monday, 7 is Sunday), London wall-clock times. */
export type CollectionWeeklyHours = {
  weekday: number;
  opensLocal: string;
  closesLocal: string;
};

/** Where a closure or opening came from. Imported and sale rows can be overridden by staff. */
export type CollectionExceptionSource = "staff" | "bank_holiday" | "sale";

/**
 * A day or run of days that differs from the weekly hours. A closure with no hours closes the
 * whole day; with hours it closes just that part. An extra opening with hours adds those hours;
 * with none it keeps the day's regular hours and lifts any bank holiday or sale-day closure
 * ("open this day anyway").
 */
export type CollectionException = {
  kind: "closure" | "extra_opening";
  /** First day, inclusive. */
  startsOn: DateKey;
  /** Last day, inclusive. */
  endsOn: DateKey;
  opensLocal: string | null;
  closesLocal: string | null;
  source: CollectionExceptionSource;
};

/** Minutes after local midnight; the range is open at its end. */
export type MinuteRange = { opens: number; closes: number };

export type CollectionDayPlan =
  | {
      kind: "open";
      /** The hours the place is open: weekly hours plus extra openings. */
      ranges: MinuteRange[];
      /** Hours closed within the day, which remove any visit they overlap. */
      closedRanges: MinuteRange[];
    }
  | { kind: "closed"; reason: "closed" | "sale_day" };

export type CollectionCalendar = {
  /** What the place is doing on a London day. */
  plan(date: DateKey): CollectionDayPlan;
  /** Monday to Friday and not closed for the whole day. */
  isWorkingDay(date: DateKey): boolean;
};

export type CollectionCalendarInput = {
  hours: readonly CollectionWeeklyHours[];
  exceptions: readonly CollectionException[];
  rules: Pick<CollectionRules, "closeOnSaleDays">;
};

function toRange(opensLocal: string | null, closesLocal: string | null): MinuteRange | null {
  if (opensLocal === null || closesLocal === null) return null;
  const opens = parseLocalTime(opensLocal);
  const closes = parseLocalTime(closesLocal);
  return opens !== null && closes !== null && closes > opens ? { opens, closes } : null;
}

/** Closures from the England and Wales bank holidays of the given years, for the import. */
export function bankHolidayClosures(years: readonly number[]): CollectionException[] {
  return years.flatMap((year) =>
    englandAndWalesBankHolidays(year).map(
      (date): CollectionException => ({
        kind: "closure",
        startsOn: date,
        endsOn: date,
        opensLocal: null,
        closesLocal: null,
        source: "bank_holiday",
      }),
    ),
  );
}

/**
 * Precedence on a day: a staff closure beats everything; then any extra opening, which lifts the
 * automatic closures (bank holiday, sale day); then the automatic closures; then the weekly
 * hours. A sale-day closure applies only while the place closes on sale days.
 */
export function createCollectionCalendar(input: CollectionCalendarInput): CollectionCalendar {
  const { hours, exceptions, rules } = input;

  const covering = (date: DateKey) =>
    exceptions.filter((e) => e.startsOn <= date && date <= e.endsOn);

  const isWholeDay = (e: CollectionException) => toRange(e.opensLocal, e.closesLocal) === null;

  /** The automatic closures (bank holiday, sale day) that apply on the day. */
  const automaticClosures = (day: readonly CollectionException[]) =>
    day.filter(
      (e) =>
        e.kind === "closure" &&
        isWholeDay(e) &&
        e.source !== "staff" &&
        (e.source !== "sale" || rules.closeOnSaleDays),
    );

  const wholeDayClosure = (date: DateKey): CollectionDayPlan | null => {
    const day = covering(date);
    if (day.some((e) => e.kind === "closure" && isWholeDay(e) && e.source === "staff")) {
      return { kind: "closed", reason: "closed" };
    }
    const automatic = automaticClosures(day);
    if (automatic.length === 0 || day.some((e) => e.kind === "extra_opening")) return null;
    return {
      kind: "closed",
      reason: automatic.every((e) => e.source === "sale") ? "sale_day" : "closed",
    };
  };

  const plan = (date: DateKey): CollectionDayPlan => {
    const closed = wholeDayClosure(date);
    if (closed) return closed;
    const day = covering(date);
    const weekday = isoWeekday(date);
    const regular = hours
      .filter((h) => h.weekday === weekday)
      .map((h) => toRange(h.opensLocal, h.closesLocal));
    const extra = day
      .filter((e) => e.kind === "extra_opening")
      .map((e) => toRange(e.opensLocal, e.closesLocal));
    const opened = (list: (MinuteRange | null)[]) =>
      list.filter((range): range is MinuteRange => range !== null);
    // Opening a bank holiday or sale day with set hours means those hours, not the regular ones.
    const liftedWithHours = automaticClosures(day).length > 0 && opened(extra).length > 0;
    const ranges = liftedWithHours ? opened(extra) : opened([...regular, ...extra]);
    if (ranges.length === 0) return { kind: "closed", reason: "closed" };
    const closedRanges = opened(
      day.filter((e) => e.kind === "closure").map((e) => toRange(e.opensLocal, e.closesLocal)),
    );
    return { kind: "open", ranges, closedRanges };
  };

  return {
    plan,
    isWorkingDay: (date) => isoWeekday(date) <= 5 && wholeDayClosure(date) === null,
  };
}

/** Furthest back a working-day count looks, so a calendar closed for months cannot loop. */
const MAX_LOOKBACK_DAYS = 60;

/** The `count`th working day before `date`; `null` if the calendar has none that close. */
export function workingDayBefore(
  calendar: CollectionCalendar,
  date: DateKey,
  count: number,
): DateKey | null {
  let remaining = count;
  let day = date;
  for (let i = 0; i < MAX_LOOKBACK_DAYS; i++) {
    day = addDaysToKey(day, -1);
    if (calendar.isWorkingDay(day) && --remaining <= 0) return day;
  }
  return null;
}

export type NoticeWindow = {
  /** Whether it is still on or before the deadline. */
  open: boolean;
  /** The last moment to book, change or cancel; `null` when the calendar gives none. */
  deadline: Date | null;
};

/**
 * The one rule for booking, changing and cancelling: by the cut-off (16:00 London time) on the
 * working day before the visit. Friday 16:00 is the deadline for Monday; closures and bank
 * holidays are not working days. The deadline itself is still in time; a moment after it is not.
 */
export function noticeDeadline(
  slotStart: Date,
  rules: Pick<CollectionRules, "noticeCutoffLocal" | "noticeWorkingDays">,
  calendar: CollectionCalendar,
): Date | null {
  const cutoff = parseLocalTime(rules.noticeCutoffLocal);
  if (cutoff === null) return null;
  const day = workingDayBefore(calendar, londonDateKey(slotStart), rules.noticeWorkingDays);
  if (day === null) return null;
  return zonedInstant(dateKeyParts(day), cutoff, BUSINESS_TIME_ZONE);
}

/** Whether `now` is still within the notice window for the visit starting at `slotStart`. */
export function noticeWindow(
  now: Date,
  slotStart: Date,
  rules: Pick<CollectionRules, "noticeCutoffLocal" | "noticeWorkingDays">,
  calendar: CollectionCalendar,
): NoticeWindow {
  const deadline = noticeDeadline(slotStart, rules, calendar);
  return { open: deadline !== null && now.getTime() <= deadline.getTime(), deadline };
}
