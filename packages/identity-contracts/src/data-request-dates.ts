import { z } from "zod";
import { addUtcMonthsClamped, subjectExportDueAt } from "./subject-export.js";

/**
 * The clock for a request for a copy of someone's data, kept in one place: the list, the nav
 * badge, the deadline schedule and the record all count days with these functions.
 *
 * Dates here are London calendar dates written `YYYY-MM-DD`, because a legal deadline is a
 * calendar day, not a moment.
 */

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** Open requests due within this many days are "due soon". */
export const DATA_REQUEST_DUE_SOON_DAYS = 7;

/** The longest extension Article 12(3) allows, in months. */
export const DATA_REQUEST_EXTENSION_MONTHS = [1, 2] as const;
export type DataRequestExtensionMonths = (typeof DATA_REQUEST_EXTENSION_MONTHS)[number];

export function isCalendarDate(value: string): boolean {
  const match = CALENDAR_DATE.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return formatCalendarDate(parsed) === value;
}

/** A real calendar day such as `2026-11-02`; `2026-02-30` is refused. */
export const calendarDateSchema = z
  .string()
  .refine(isCalendarDate, { message: "Enter a real date as YYYY-MM-DD" });

/** UTC midnight of a calendar date. */
export function parseCalendarDate(value: string): Date {
  if (!isCalendarDate(value)) throw new RangeError(`Not a calendar date: ${value}`);
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatCalendarDate(at: Date): string {
  return at.toISOString().slice(0, 10);
}

const LONDON_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The calendar day in London at a moment: 23:30 UTC on a summer evening is already tomorrow. */
export function londonCalendarDate(at: Date): string {
  return LONDON_DAY.format(at);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function calendarDaysBetween(from: string, to: string): number {
  return Math.round((parseCalendarDate(to).getTime() - parseCalendarDate(from).getTime()) / DAY_MS);
}

/**
 * The legal due date for a request whose clock starts on `startOn`: the ICO month rule that the
 * automatic downloads already use ({@link subjectExportDueAt}).
 */
export function dataRequestDueOn(startOn: string): string {
  return formatCalendarDate(subjectExportDueAt(parseCalendarDate(startOn)));
}

/**
 * The due date after an Article 12(3) extension: `months` more months counted from the original
 * due date, landing on the last day of a shorter month rather than overflowing into the next.
 */
export function extendedDueOn(dueOn: string, months: DataRequestExtensionMonths): string {
  return formatCalendarDate(addUtcMonthsClamped(parseCalendarDate(dueOn), months));
}

export type DueStateKind = "none" | "ok" | "due_soon" | "overdue";

export type DueState = {
  state: DueStateKind;
  /** Days until the due date; 0 on the day, negative once overdue. Null when there is no due date. */
  daysLeft: number | null;
};

/**
 * Where a request stands against its deadline. `none` is a request whose clock has not started
 * (waiting for ID); a request due today has 0 days left and is due soon, not overdue.
 */
export function dueState(dueOn: string | null, today: string): DueState {
  if (dueOn === null) return { state: "none", daysLeft: null };
  const daysLeft = calendarDaysBetween(today, dueOn);
  if (daysLeft < 0) return { state: "overdue", daysLeft };
  if (daysLeft <= DATA_REQUEST_DUE_SOON_DAYS) return { state: "due_soon", daysLeft };
  return { state: "ok", daysLeft };
}

/** How the answer compared with the deadline: days late (0 when on time or early). */
export function daysLate(dueOn: string, answeredOn: string): number {
  return Math.max(0, calendarDaysBetween(dueOn, answeredOn));
}

export const dueStateSchema = z.object({
  state: z.enum(["none", "ok", "due_soon", "overdue"]),
  daysLeft: z.number().int().nullable(),
});
