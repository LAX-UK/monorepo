import type { Result } from "neverthrow";

/** Each refusal of a storage change: its status and the sentence staff read. */
const REFUSALS = {
  venue_not_found: [404, "We couldn't find that place."],
  terms_not_found: [404, "We couldn't find that change. Reload to see the current terms."],
  /** A change starts tomorrow at the earliest, in London. */
  start_not_in_future: [422, "Choose a date from tomorrow."],
  /** A change starts within two years, so a mistyped year cannot hold up every other change. */
  start_too_late: [422, "Choose a date within the next 2 years."],
  date_taken: [409, "Another change already starts on that day. Choose another date."],
  /** A place has one change waiting at a time, so staff edit it rather than stack another. */
  change_already_scheduled: [
    409,
    "A change is already scheduled. Edit it or cancel it before scheduling another.",
  ],
  /** The version has started or was cancelled, so it is history and cannot change. */
  not_scheduled: [
    409,
    "This change has already started or was cancelled. Reload to see the terms in force.",
  ],
  lot_not_found: [
    404,
    "We couldn't find that lot waiting at this place. Reload the list to see where it stands.",
  ],
  /** A lot's extensions together stop at 30 days; the message names what is left. */
  extension_cap_reached: [409, "This lot has had the most free days it can: 30."],
  already_waived: [409, "The storage charges on this lot are already waived."],
  vat_treatment_required: [
    409,
    "Storage invoices can be switched on once Finance chooses a VAT treatment for them.",
  ],
} as const;

export type CollectionStorageErrorCode = keyof typeof REFUSALS;

/** A field the refusal is about, by the name the request gave it. */
export type CollectionStorageIssue = { field: "effectiveFrom" | "days"; message: string };

export type CollectionStorageError = {
  code: CollectionStorageErrorCode;
  status: 404 | 409 | 422;
  message: string;
  issues?: CollectionStorageIssue[];
};

export type CollectionStorageResult<T> = Result<T, CollectionStorageError>;

/** An extension over the cap, naming the days the lot may still be given. */
export function extensionCapError(daysRemaining: number): CollectionStorageError {
  const message =
    daysRemaining > 0
      ? `This lot can have up to ${daysRemaining} more ${daysRemaining === 1 ? "day" : "days"}.`
      : REFUSALS.extension_cap_reached[1];
  return {
    code: "extension_cap_reached",
    status: 409,
    message,
    issues: [{ field: "days", message }],
  };
}

export function storageError(code: CollectionStorageErrorCode): CollectionStorageError {
  const [status, message] = REFUSALS[code];
  return code === "start_not_in_future" || code === "start_too_late" || code === "date_taken"
    ? { code, status, message, issues: [{ field: "effectiveFrom", message }] }
    : { code, status, message };
}
