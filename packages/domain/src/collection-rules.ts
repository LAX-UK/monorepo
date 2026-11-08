/**
 * The rules a place sets for its collection visits. Staff own every value; the defaults are the
 * gallery's: 30-minute visits, two at a time, book or change by 16:00 on the working day before,
 * four weeks ahead.
 */
export type CollectionRules = {
  /** Length of one visit, in minutes. */
  visitMinutes: number;
  /** Visits that can run at the same time. */
  placesPerSlot: number;
  /** London wall-clock time of the cut-off on the notice day ("16:00"). */
  noticeCutoffLocal: string;
  /** Working days before the visit that the cut-off falls on (1 is the day before). */
  noticeWorkingDays: number;
  /** How many days ahead, counting today, a visit can be booked. */
  windowDays: number;
  /** Whether a sale day at the place closes collections for the whole day. */
  closeOnSaleDays: boolean;
  /** Minutes after a hand-over that staff can still undo it (the toast's Undo). */
  undoHandOverMinutes: number;
};

export const DEFAULT_COLLECTION_RULES: CollectionRules = {
  visitMinutes: 30,
  placesPerSlot: 2,
  noticeCutoffLocal: "16:00",
  noticeWorkingDays: 1,
  windowDays: 28,
  closeOnSaleDays: true,
  undoHandOverMinutes: 10,
};

/** The gallery's hours until staff change them: Monday to Friday, 10:00 to 19:00 (London time). */
export const DEFAULT_COLLECTION_WEEKLY_HOURS: readonly {
  weekday: number;
  opensLocal: string;
  closesLocal: string;
}[] = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, opensLocal: "10:00", closesLocal: "19:00" }));

/** The most lots one booking can hold. */
export const MAX_LOTS_PER_COLLECTION = 20;

/** Visit lengths staff can choose, in minutes. */
export const COLLECTION_VISIT_MINUTES = [15, 20, 30, 45, 60] as const;
export const MIN_PLACES_PER_SLOT = 1;
export const MAX_PLACES_PER_SLOT = 10;
export const MIN_NOTICE_WORKING_DAYS = 1;
export const MAX_NOTICE_WORKING_DAYS = 5;
export const MIN_WINDOW_DAYS = 7;
export const MAX_WINDOW_DAYS = 90;
export const MIN_UNDO_HAND_OVER_MINUTES = 1;
export const MAX_UNDO_HAND_OVER_MINUTES = 60;

export type CollectionRulesIssue =
  | "visit_minutes"
  | "places_per_slot"
  | "notice_cutoff"
  | "notice_working_days"
  | "window_days"
  | "undo_hand_over_minutes";

const CUTOFF = /^([01]\d|2[0-3]):[0-5]\d$/;

const within = (value: number, min: number, max: number) =>
  Number.isInteger(value) && value >= min && value <= max;

/** The fields of `rules` outside what staff may set; empty when the rules are valid. */
export function collectionRulesIssues(rules: CollectionRules): CollectionRulesIssue[] {
  const issues: CollectionRulesIssue[] = [];
  if (!(COLLECTION_VISIT_MINUTES as readonly number[]).includes(rules.visitMinutes)) {
    issues.push("visit_minutes");
  }
  if (!within(rules.placesPerSlot, MIN_PLACES_PER_SLOT, MAX_PLACES_PER_SLOT)) {
    issues.push("places_per_slot");
  }
  if (!CUTOFF.test(rules.noticeCutoffLocal)) issues.push("notice_cutoff");
  if (!within(rules.noticeWorkingDays, MIN_NOTICE_WORKING_DAYS, MAX_NOTICE_WORKING_DAYS)) {
    issues.push("notice_working_days");
  }
  if (!within(rules.windowDays, MIN_WINDOW_DAYS, MAX_WINDOW_DAYS)) issues.push("window_days");
  if (!within(rules.undoHandOverMinutes, MIN_UNDO_HAND_OVER_MINUTES, MAX_UNDO_HAND_OVER_MINUTES)) {
    issues.push("undo_hand_over_minutes");
  }
  return issues;
}
