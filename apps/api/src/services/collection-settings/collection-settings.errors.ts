import type { ExceptionIssueCode, HoursIssue } from "@auction/domain";
import type { CollectionRulesIssue } from "@auction/domain";
import type { StaffAffectedBooking } from "@auction/types";
import type { Result } from "neverthrow";

const REFUSALS = {
  venue_not_found: [404, "We couldn't find that place."],
  exception_not_found: [404, "We couldn't find that closure or opening."],
  /** The hours or rules cannot be saved as they are; `issues` says which field. */
  settings_invalid: [422, "Check the highlighted fields."],
  exception_invalid: [422, "Check the dates and times."],
  /** Someone else saved since the settings were read. */
  settings_changed: [
    409,
    "These settings were changed by someone else. Reload them and try again.",
  ],
  /** The change leaves bookings outside what the place offers; staff choose what happens to them. */
  bookings_affected: [
    409,
    "Some bookings fall outside this change. Choose to keep them or to cancel them and ask the clients to rebook.",
  ],
  unavailable: [503, "We couldn't reach the collection settings just now. Try again in a moment."],
} as const;

export type CollectionSettingsErrorCode = keyof typeof REFUSALS;

export type SettingsIssues = {
  hours?: HoursIssue[];
  rules?: CollectionRulesIssue[];
  exception?: ExceptionIssueCode[];
};

export type CollectionSettingsError = {
  code: CollectionSettingsErrorCode;
  status: 404 | 409 | 422 | 503;
  message: string;
  issues?: SettingsIssues;
  /** For `bookings_affected`: the bookings, so staff see them before they choose. */
  affected?: StaffAffectedBooking[];
};

export type CollectionSettingsResult<T> = Result<T, CollectionSettingsError>;

export function settingsError(
  code: CollectionSettingsErrorCode,
  extra: Partial<Omit<CollectionSettingsError, "code" | "status" | "message">> = {},
): CollectionSettingsError {
  const [status, message] = REFUSALS[code];
  return { code, status, message, ...extra };
}
