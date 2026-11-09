import { formatStaffDate, formatStaffTime } from "@auction/staff-ui";
import type {
  StaffAffectedBooking,
  StaffCollectionException,
  StaffCollectionHours,
} from "@auction/types";

export const COLLECTIONS_PATH = "/admin/collections";

export const COLLECTION_TABS = ["day", "upcoming", "not_collected", "hours", "closures"] as const;
export type CollectionTab = (typeof COLLECTION_TABS)[number];

/** The desk tabs show visits; the others set the place up. */
export const DESK_TABS: readonly CollectionTab[] = ["day", "upcoming", "not_collected"];

/** The day is the page's first screen: who is coming to collect, and when. */
export function parseCollectionTab(value: string | string[] | undefined): CollectionTab {
  const wanted = Array.isArray(value) ? value[0] : value;
  return COLLECTION_TABS.find((tab) => tab === wanted) ?? "day";
}

export function collectionsHref(
  tab: CollectionTab,
  venueId?: string | null,
  date?: string | null,
): string {
  const query = new URLSearchParams();
  if (tab !== "day") query.set("tab", tab);
  if (venueId) query.set("venue", venueId);
  if (tab === "day" && date) query.set("date", date);
  const text = query.toString();
  return text ? `${COLLECTIONS_PATH}?${text}` : COLLECTIONS_PATH;
}

/** Monday first, as the week is read at the gallery. */
export const WEEKDAYS: ReadonlyArray<{ weekday: number; label: string }> = [
  { weekday: 1, label: "Monday" },
  { weekday: 2, label: "Tuesday" },
  { weekday: 3, label: "Wednesday" },
  { weekday: 4, label: "Thursday" },
  { weekday: 5, label: "Friday" },
  { weekday: 6, label: "Saturday" },
  { weekday: 7, label: "Sunday" },
];

export const weekdayLabel = (weekday: number): string =>
  WEEKDAYS.find((day) => day.weekday === weekday)?.label ?? "Day";

export const HOURS_ISSUE_MESSAGES = {
  time_invalid: "Enter a time such as 10:00.",
  closes_not_after_opens: "Closing must be after opening.",
  overlap: "This overlaps another opening time on the same day.",
  weekday_invalid: "Choose a day of the week.",
  too_many_ranges: "A day can have at most 4 opening times.",
} as const;

export const RULE_ISSUE_MESSAGES = {
  visit_minutes: "Choose one of the visit lengths.",
  places_per_slot: "Enter a whole number from 1 to 10.",
  notice_cutoff: "Enter a time such as 16:00.",
  notice_working_days: "Enter a whole number from 1 to 5.",
  window_days: "Enter a whole number from 7 to 90.",
  undo_hand_over_minutes: "Enter a whole number from 1 to 60.",
  max_active_visits: "Enter a whole number from 1 to 20.",
} as const;

export const EXCEPTION_ISSUE_MESSAGES = {
  date_invalid: "Choose a date from today on.",
  ends_before_start: "The last day can't be before the first.",
  time_invalid: "Enter a time such as 13:00.",
  closes_not_after_opens: "The end time must be after the start time.",
  hours_incomplete: "Enter both times, or neither for the whole day.",
  too_long: "Choose at most a year at a time.",
} as const;

export const AFFECTED_REASON_LABELS: Record<StaffAffectedBooking["reason"], string> = {
  closed: "Closed that day",
  outside_hours: "Outside the opening hours",
  over_capacity: "More visits than places",
};

export const EXCEPTION_SOURCE_LABELS: Record<StaffCollectionException["source"], string> = {
  staff: "Added by staff",
  bank_holiday: "Bank holiday",
  sale: "Sale day",
};

/** A London day key as a date to format; noon keeps it on the same day in any zone. */
const dayDate = (day: string): Date => new Date(`${day}T12:00:00Z`);

/** "Fri 13 Nov, 17:30–18:00 GMT" for a visit, in the one date style. */
export function formatVisitSlot(startIso: string, endIso: string, now: Date = new Date()): string {
  return `${formatStaffDate(startIso, now)}, ${formatStaffTime(startIso)}–${formatStaffTime(endIso, { zoneLabel: true })}`;
}

/** The days a closure or opening covers: "Fri 25 Dec" or "Fri 25 Dec to Sun 27 Dec". */
export function formatExceptionDays(
  exception: Pick<StaffCollectionException, "startsOn" | "endsOn">,
  now: Date = new Date(),
): string {
  const first = formatStaffDate(dayDate(exception.startsOn), now);
  return exception.startsOn === exception.endsOn
    ? first
    : `${first} to ${formatStaffDate(dayDate(exception.endsOn), now)}`;
}

/** What an exception does: "Closed all day", "Closed 13:00 to 14:00", "Open 10:00 to 16:00". */
export function describeException(e: StaffCollectionException): string {
  const part = e.opensLocal && e.closesLocal ? `${e.opensLocal} to ${e.closesLocal}` : null;
  if (e.kind === "closure") return part ? `Closed ${part}` : "Closed all day";
  return part ? `Open ${part}` : "Open the regular hours";
}

/** The hours of one weekday, in order, as the form edits them. */
export function hoursOfDay(hours: readonly StaffCollectionHours[], weekday: number) {
  return hours
    .filter((range) => range.weekday === weekday)
    .sort((a, b) => a.opensLocal.localeCompare(b.opensLocal));
}
