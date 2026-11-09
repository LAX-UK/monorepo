import {
  COLLECTION_VISIT_MINUTES,
  type CollectionRulesIssue,
  type ExceptionIssueCode,
  type HoursIssue,
  collectionRulesIssues,
  exceptionDraftIssues,
  weeklyHoursIssues,
} from "@auction/domain";
import type { StaffCollectionSettings } from "@auction/types";
import { RULE_ISSUE_MESSAGES } from "./collections.vm";

export { COLLECTION_VISIT_MINUTES };

/** One range of opening hours as it is edited: text, so half-typed times survive. */
export type HoursRangeDraft = {
  key: string;
  weekday: number;
  opensLocal: string;
  closesLocal: string;
};

/** The Hours and rules form as it is edited. Numbers are text until they are saved. */
export type SettingsDraft = {
  onlineBookingEnabled: boolean;
  visitMinutes: string;
  placesPerSlot: string;
  noticeCutoffLocal: string;
  noticeWorkingDays: string;
  windowDays: string;
  closeOnSaleDays: boolean;
  undoHandOverMinutes: string;
  maxActiveVisits: string;
  /** Empty: collections are never charged for storage. */
  freeStorageDays: string;
  bookingEmail: string;
  hours: HoursRangeDraft[];
};

let rangeCounter = 0;
export const newRangeKey = (): string => `added-${++rangeCounter}`;

export function draftFromSettings(settings: StaffCollectionSettings): SettingsDraft {
  return {
    onlineBookingEnabled: settings.onlineBookingEnabled,
    visitMinutes: String(settings.visitMinutes),
    placesPerSlot: String(settings.placesPerSlot),
    noticeCutoffLocal: settings.noticeCutoffLocal,
    noticeWorkingDays: String(settings.noticeWorkingDays),
    windowDays: String(settings.windowDays),
    closeOnSaleDays: settings.closeOnSaleDays,
    undoHandOverMinutes: String(settings.undoHandOverMinutes),
    maxActiveVisits: String(settings.maxActiveVisits),
    freeStorageDays: settings.freeStorageDays === null ? "" : String(settings.freeStorageDays),
    bookingEmail: settings.bookingEmail ?? "",
    // Keys are stable between server and browser; only rows added in the browser take a counter.
    hours: settings.hours.map((range, index) => ({ key: `saved-${index}`, ...range })),
  };
}

const whole = (text: string): number =>
  /^\d{1,4}$/.test(text.trim()) ? Number(text.trim()) : Number.NaN;

/** The body of a save; null where a number was not entered, so the form can say which. */
export function bodyFromDraft(draft: SettingsDraft, version: string) {
  const storage = draft.freeStorageDays.trim();
  return {
    version,
    onlineBookingEnabled: draft.onlineBookingEnabled,
    visitMinutes: whole(draft.visitMinutes),
    placesPerSlot: whole(draft.placesPerSlot),
    noticeCutoffLocal: draft.noticeCutoffLocal.trim(),
    noticeWorkingDays: whole(draft.noticeWorkingDays),
    windowDays: whole(draft.windowDays),
    closeOnSaleDays: draft.closeOnSaleDays,
    undoHandOverMinutes: whole(draft.undoHandOverMinutes),
    maxActiveVisits: whole(draft.maxActiveVisits),
    freeStorageDays: storage === "" ? null : whole(storage),
    bookingEmail: draft.bookingEmail.trim() === "" ? null : draft.bookingEmail.trim(),
    hours: draft.hours.map(({ weekday, opensLocal, closesLocal }) => ({
      weekday,
      opensLocal: opensLocal.trim(),
      closesLocal: closesLocal.trim(),
    })),
  };
}

export type SettingsErrors = {
  rules: Partial<Record<CollectionRulesIssue | "free_storage_days" | "booking_email", string>>;
  /** Issues by range key, so each row can say what is wrong with it. */
  hours: Record<string, HoursIssue["code"]>;
  count: number;
};

const FIELD_MESSAGES = {
  free_storage_days: "Enter a whole number of days up to 365, or leave it empty.",
  booking_email: "Enter an email address, or leave it empty.",
} as const;

/** What is wrong with the form before it is sent. The server checks again. */
export function validateSettingsDraft(draft: SettingsDraft): SettingsErrors {
  const body = bodyFromDraft(draft, "");
  const out: SettingsErrors = { rules: {}, hours: {}, count: 0 };
  for (const issue of collectionRulesIssues({
    visitMinutes: body.visitMinutes,
    placesPerSlot: body.placesPerSlot,
    noticeCutoffLocal: body.noticeCutoffLocal,
    noticeWorkingDays: body.noticeWorkingDays,
    windowDays: body.windowDays,
    closeOnSaleDays: body.closeOnSaleDays,
    undoHandOverMinutes: body.undoHandOverMinutes,
    maxActiveVisits: body.maxActiveVisits,
  })) {
    out.rules[issue] = RULE_ISSUE_MESSAGES[issue];
  }
  const storage = body.freeStorageDays;
  if (storage !== null && !(Number.isInteger(storage) && storage >= 0 && storage <= 365)) {
    out.rules.free_storage_days = FIELD_MESSAGES.free_storage_days;
  }
  if (body.bookingEmail !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.bookingEmail)) {
    out.rules.booking_email = FIELD_MESSAGES.booking_email;
  }
  // `index` counts within the weekday, in the order the rows are shown for that day.
  for (const issue of weeklyHoursIssues(body.hours)) {
    const row = draft.hours.filter((range) => range.weekday === issue.weekday)[issue.index];
    if (row) out.hours[row.key] = issue.code;
  }
  out.count = Object.keys(out.rules).length + Object.keys(out.hours).length;
  return out;
}

/** True when the form differs from what was loaded. */
export function isDirty(draft: SettingsDraft, settings: StaffCollectionSettings): boolean {
  const fresh = draftFromSettings(settings);
  const strip = (d: SettingsDraft) => ({
    ...d,
    hours: d.hours.map(({ weekday, opensLocal, closesLocal }) => ({
      weekday,
      opensLocal,
      closesLocal,
    })),
  });
  return JSON.stringify(strip(draft)) !== JSON.stringify(strip(fresh));
}

// ---- closures -------------------------------------------------------------------------------

export type ExceptionDraft = {
  kind: "closure" | "extra_opening";
  startsOn: string;
  endsOn: string;
  /** Whole day when off. */
  partDay: boolean;
  opensLocal: string;
  closesLocal: string;
  reason: string;
};

export const emptyExceptionDraft = (today: string): ExceptionDraft => ({
  kind: "closure",
  startsOn: today,
  endsOn: today,
  partDay: false,
  opensLocal: "",
  closesLocal: "",
  reason: "",
});

export function exceptionBody(draft: ExceptionDraft) {
  return {
    kind: draft.kind,
    startsOn: draft.startsOn,
    endsOn: draft.endsOn || draft.startsOn,
    opensLocal: draft.partDay ? draft.opensLocal.trim() : null,
    closesLocal: draft.partDay ? draft.closesLocal.trim() : null,
    reason: draft.reason.trim() === "" ? null : draft.reason.trim(),
  };
}

export function validateExceptionDraft(draft: ExceptionDraft, today: string): ExceptionIssueCode[] {
  const body = exceptionBody(draft);
  const issues = exceptionDraftIssues(body);
  if (issues.length === 0 && body.endsOn < today) issues.push("date_invalid");
  return issues;
}
