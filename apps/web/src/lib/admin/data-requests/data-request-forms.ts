import {
  DATA_REQUEST_NOTE_MAX_LENGTH,
  type DataRequestChannel,
  type DataRequestExtensionMonths,
  type DataRequestOutcome,
  type DataRequestProduct,
  type DataRequestReason,
  calendarDaysBetween,
  dataRequestDueOn,
  extendedDueOn,
  isCalendarDate,
} from "@auction/identity-contracts/data-requests";
import type {
  DATA_REQUEST_EXTENSION_REASONS,
  DATA_REQUEST_TOLD_VIA,
} from "@auction/identity-contracts/data-requests";
import { formatStaffNumber } from "@auction/staff-ui";

/**
 * The checks each dialog makes on submit, kept out of the components. Each returns one message
 * per field, worded as the inline error and the error summary both show it.
 */

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export const NOTE_MAX_LENGTH = DATA_REQUEST_NOTE_MAX_LENGTH;

/** A received date older than this many days is allowed, with a warning. */
const OLD_RECEIVED_DAYS = 31;

// Log a manual request -----------------------------------------------------------------------

export type FoundAccount = { subjectId: string; name: string; status: string };

export type LogRequestDraft = {
  personMode: "account" | "contact";
  account: FoundAccount | null;
  contactName: string;
  contactDetail: string;
  reason: DataRequestReason;
  channel: DataRequestChannel;
  receivedOn: string | null;
  identity: "confirmed" | "asked_for_proof";
  products: readonly DataRequestProduct[];
  notes: string;
};

export type LogRequestField =
  | "person"
  | "contactName"
  | "contactDetail"
  | "receivedOn"
  | "products"
  | "notes";

export const LOG_REQUEST_MESSAGES = {
  person: 'Choose the person\'s LAX account, or switch to "No account".',
  contactName: "Enter the person's name.",
  contactDetail: "Enter an email address or postal address for the person.",
  receivedMissing: "Enter the date the request reached us.",
  receivedFuture: "Received date can't be in the future.",
  products: "Choose at least one product.",
  notes: 'Add a note for "Other".',
  notesLong: `Keep the note under ${formatStaffNumber(NOTE_MAX_LENGTH)} characters.`,
} as const;

export function emptyLogRequest(today: string): LogRequestDraft {
  return {
    personMode: "account",
    account: null,
    contactName: "",
    contactDetail: "",
    reason: "full_copy",
    channel: "email",
    receivedOn: today,
    identity: "confirmed",
    products: ["account", "bid", "shop"],
    notes: "",
  };
}

export function validateLogRequest(
  draft: LogRequestDraft,
  today: string,
): FieldErrors<LogRequestField> {
  const errors: FieldErrors<LogRequestField> = {};
  if (draft.personMode === "account") {
    if (!draft.account) errors.person = LOG_REQUEST_MESSAGES.person;
  } else {
    if (!draft.contactName.trim()) errors.contactName = LOG_REQUEST_MESSAGES.contactName;
    if (!draft.contactDetail.trim()) errors.contactDetail = LOG_REQUEST_MESSAGES.contactDetail;
  }
  if (!draft.receivedOn || !isCalendarDate(draft.receivedOn)) {
    errors.receivedOn = LOG_REQUEST_MESSAGES.receivedMissing;
  } else if (draft.receivedOn > today) {
    errors.receivedOn = LOG_REQUEST_MESSAGES.receivedFuture;
  }
  if (draft.products.length === 0) errors.products = LOG_REQUEST_MESSAGES.products;
  const notes = draft.notes.trim();
  if (draft.reason === "other" && !notes) errors.notes = LOG_REQUEST_MESSAGES.notes;
  else if (notes.length > NOTE_MAX_LENGTH) errors.notes = LOG_REQUEST_MESSAGES.notesLong;
  return errors;
}

/** The due date shown before saving: the ICO month rule from the received date, once ID is confirmed. */
export function previewDueOn(
  draft: Pick<LogRequestDraft, "receivedOn" | "identity">,
): string | null {
  if (draft.identity !== "confirmed") return null;
  return draft.receivedOn && isCalendarDate(draft.receivedOn)
    ? dataRequestDueOn(draft.receivedOn)
    : null;
}

/** A warning, not an error: the request reached us more than a month ago. */
export function oldReceivedWarning(receivedOn: string | null, today: string): string | null {
  if (!receivedOn || !isCalendarDate(receivedOn) || receivedOn > today) return null;
  return calendarDaysBetween(receivedOn, today) > OLD_RECEIVED_DAYS
    ? "This request reached us more than a month ago, so it may already be past its due date."
    : null;
}

/** Whether the draft differs from a fresh one, so closing it asks first. */
export function isLogRequestDirty(draft: LogRequestDraft, today: string): boolean {
  const fresh = emptyLogRequest(today);
  return (
    draft.account !== null ||
    draft.contactName.trim() !== "" ||
    draft.contactDetail.trim() !== "" ||
    draft.notes.trim() !== "" ||
    draft.reason !== fresh.reason ||
    draft.channel !== fresh.channel ||
    draft.receivedOn !== fresh.receivedOn ||
    draft.identity !== fresh.identity ||
    draft.products.length !== fresh.products.length
  );
}

// Extend --------------------------------------------------------------------------------------

export type ExtendDraft = {
  months: DataRequestExtensionMonths;
  reason: (typeof DATA_REQUEST_EXTENSION_REASONS)[number];
  note: string;
  personToldOn: string | null;
  personToldVia: (typeof DATA_REQUEST_TOLD_VIA)[number] | null;
};

export type ExtendField = "note" | "personToldOn" | "personToldVia";

export function validateExtend(
  draft: ExtendDraft,
  limits: { originalDueOn: string; today: string },
): FieldErrors<ExtendField> {
  const errors: FieldErrors<ExtendField> = {};
  if (!draft.note.trim()) errors.note = "Say why the request needs more time.";
  else if (draft.note.trim().length > NOTE_MAX_LENGTH) {
    errors.note = `Keep the note under ${formatStaffNumber(NOTE_MAX_LENGTH)} characters.`;
  }
  if (!draft.personToldOn || !isCalendarDate(draft.personToldOn)) {
    errors.personToldOn = "Enter the date the person was told.";
  } else if (draft.personToldOn > limits.today) {
    errors.personToldOn = "The date the person was told can't be in the future.";
  } else if (draft.personToldOn > limits.originalDueOn) {
    errors.personToldOn = "The person must be told on or before the original due date.";
  }
  if (!draft.personToldVia) errors.personToldVia = "Choose how the person was told.";
  return errors;
}

/** The two new due dates the dialog offers, counted from the original due date. */
export function extensionChoices(
  originalDueOn: string,
): Record<DataRequestExtensionMonths, string> {
  return { 1: extendedDueOn(originalDueOn, 1), 2: extendedDueOn(originalDueOn, 2) };
}

// Close ----------------------------------------------------------------------------------------

export type CloseDraft = {
  outcome: DataRequestOutcome | null;
  note: string;
  complaintRightTold: boolean;
};

export type CloseField = "outcome" | "note" | "complaintRightTold";

/** What the note field asks for under each outcome; null when no note is needed. */
export const CLOSE_NOTE_FIELD: Readonly<
  Record<DataRequestOutcome, { label: string; required: boolean; hint: string } | null>
> = {
  sent: { label: "Note", required: false, hint: "Internal. Don't paste the person's data." },
  sent_partial: {
    label: "Exemption",
    required: true,
    hint: "Name the exemption that applies, for example other people's information.",
  },
  nothing_held: { label: "Note", required: false, hint: "Internal. Say where you looked." },
  refused: {
    label: "Why",
    required: true,
    hint: "Say why the request is manifestly unfounded or excessive.",
  },
  withdrawn: { label: "Note", required: false, hint: "Internal. How the person withdrew it." },
};

const NOTE_REQUIRED_MESSAGES: Partial<Record<DataRequestOutcome, string>> = {
  sent_partial: "Name the exemption that applies.",
  refused: "Say why the request is manifestly unfounded or excessive.",
};

export function validateClose(draft: CloseDraft): FieldErrors<CloseField> {
  const errors: FieldErrors<CloseField> = {};
  if (!draft.outcome) {
    errors.outcome = "Choose an outcome.";
    return errors;
  }
  const rule = CLOSE_NOTE_FIELD[draft.outcome];
  const note = draft.note.trim();
  if (rule?.required && !note) {
    errors.note = NOTE_REQUIRED_MESSAGES[draft.outcome] ?? "Add a note.";
  } else if (note.length > NOTE_MAX_LENGTH) {
    errors.note = `Keep the note under ${formatStaffNumber(NOTE_MAX_LENGTH)} characters.`;
  }
  if (draft.outcome === "refused" && !draft.complaintRightTold) {
    errors.complaintRightTold = "Confirm the person was told before closing.";
  }
  return errors;
}

// ID received -----------------------------------------------------------------------------------

export function validateIdReceived(
  receivedOn: string | null,
  limits: { requestReceivedOn: string; today: string },
): string | null {
  if (!receivedOn || !isCalendarDate(receivedOn)) return "Enter the date the proof arrived.";
  if (receivedOn > limits.today) return "The date can't be in the future.";
  if (receivedOn < limits.requestReceivedOn) {
    return "The proof can't have arrived before the request.";
  }
  return null;
}
