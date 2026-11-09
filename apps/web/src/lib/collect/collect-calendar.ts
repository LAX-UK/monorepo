import { formatCollectionDay, isoWeekday } from "@auction/domain";
import type { CollectionDayView, CollectionSlotView } from "@auction/types";
import { COLLECT_COPY } from "./collect-copy";

/** The instant a day key names, at noon UTC: the same London day in winter and in summer. */
const noon = (date: string): Date => new Date(`${date}T12:00:00.000Z`);

/** One day of the 4-week calendar, as a choice. */
export type CalendarDay = {
  date: string;
  /** The day of the month, "12". */
  number: string;
  state: CollectionDayView["state"];
  /** What the day says under its number: "7 times", "Full", "Sale day", "Closed", "Too soon". */
  caption: string;
  /** Read out in full: "Thu 12 Nov, 7 times". */
  label: string;
  /** Only a day with a time to book can be chosen. */
  selectable: boolean;
  slots: CollectionSlotView[];
};

export const WEEKDAY_HEADINGS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function captionOf(day: CollectionDayView): string {
  switch (day.state) {
    case "open":
      return `${day.openSlots} ${day.openSlots === 1 ? "time" : "times"}`;
    case "full":
      return COLLECT_COPY.day.full;
    case "sale_day":
      return COLLECT_COPY.day.saleDay;
    case "too_soon":
      return COLLECT_COPY.day.tooSoon;
    case "closed":
      return COLLECT_COPY.day.closed;
  }
}

/** A day, ready to draw. `now` decides whether the year is written (only when it is not this year). */
export function calendarDay(day: CollectionDayView, now: Date): CalendarDay {
  const caption = captionOf(day);
  return {
    date: day.date,
    number: String(Number(day.date.slice(8, 10))),
    state: day.state,
    caption,
    label: `${formatCollectionDay(noon(day.date), now)}, ${caption}`,
    selectable: day.state === "open" && day.openSlots > 0,
    slots: day.slots,
  };
}

/**
 * The window as one run of days, Monday first, with how many empty cells come before the first so
 * the days fall under their weekday. A weekend reads "Closed" in its place instead of vanishing.
 */
export function calendarCells(
  days: readonly CollectionDayView[],
  now: Date,
): { blanks: number; days: CalendarDay[] } {
  const first = days[0];
  if (!first) return { blanks: 0, days: [] };
  return { blanks: isoWeekday(first.date) - 1, days: days.map((day) => calendarDay(day, now)) };
}

/** The first day with a time to book, which the page selects for the person. */
export function firstOpenDay(days: readonly CollectionDayView[]): string | null {
  return days.find((day) => day.state === "open" && day.openSlots > 0)?.date ?? null;
}

/** The day a time falls on, from the days the API sent. */
export function dayOfSlot(days: readonly CollectionDayView[], slotStart: string): string | null {
  return days.find((day) => day.slots.some((slot) => slot.start === slotStart))?.date ?? null;
}

/** A month heading for the window: "November 2026", or "November – December 2026". */
export function windowHeading(days: readonly CollectionDayView[]): string {
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return "";
  const month = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" });
  const year = new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: "UTC" });
  const a = noon(first.date);
  const b = noon(last.date);
  const sameMonth = month.format(a) === month.format(b) && year.format(a) === year.format(b);
  if (sameMonth) return `${month.format(a)} ${year.format(a)}`;
  return year.format(a) === year.format(b)
    ? `${month.format(a)} – ${month.format(b)} ${year.format(a)}`
    : `${month.format(a)} ${year.format(a)} – ${month.format(b)} ${year.format(b)}`;
}
