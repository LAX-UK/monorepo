import type { QuarantineMessage } from "@/lib/data/http/admin-enquiries.schema";
import {
  QUARANTINE_REVIEW_REASON_MAX,
  QUARANTINE_REVIEW_REASON_MIN,
  isHeldMailSenderUnverified,
} from "@auction/domain";
import type { KeyValueItem } from "@auction/staff-ui";
import { ENQUIRIES_PATH } from "./enquiries.vm";
import {
  AUTH_NOT_RECORDED,
  DKIM_LABELS,
  QUARANTINE_COPY,
  QUARANTINE_REASON_COPY,
  SPF_LABELS,
} from "./enquiry-email-copy";

/** The held-email list and record live under Enquiries. */
export const QUARANTINE_PATH = `${ENQUIRIES_PATH}/quarantine`;

export const QUARANTINE_VIEWS = ["pending", "reviewed"] as const;
export type QuarantineView = (typeof QUARANTINE_VIEWS)[number];

export function quarantineHref(id: string): string {
  return `${QUARANTINE_PATH}/${encodeURIComponent(id)}`;
}

/** The list address for a view and an optional cursor; the default view has no query. */
export function quarantineListHref(view: QuarantineView, cursor?: string | null): string {
  const query = new URLSearchParams();
  if (view !== "pending") query.set("view", view);
  if (cursor) query.set("cursor", cursor);
  const text = query.toString();
  return text ? `${QUARANTINE_PATH}?${text}` : QUARANTINE_PATH;
}

/** The view a search asks for; anything unknown is the default. */
export function quarantineViewOf(value: string | string[] | undefined): QuarantineView {
  return value === "reviewed" ? "reviewed" : "pending";
}

/** What the receiving server recorded about the sender, in words. */
export function senderCheckItems(message: QuarantineMessage): KeyValueItem[] {
  return [
    { label: "SPF", value: message.spfResult ? SPF_LABELS[message.spfResult] : AUTH_NOT_RECORDED },
    {
      label: "DKIM",
      value: message.dkimResult ? DKIM_LABELS[message.dkimResult] : AUTH_NOT_RECORDED,
    },
  ];
}

export function reasonCopy(message: Pick<QuarantineMessage, "reason">) {
  return QUARANTINE_REASON_COPY[message.reason];
}

/** The subject as a line of text, never empty. */
export function subjectLine(subject: string): string {
  return subject.trim() || QUARANTINE_COPY.noSubject;
}

/** "E-1042" or "e-1042 " as the reference the API accepts; null when it is not one. */
export function normaliseEnquiryReference(value: string): string | null {
  const reference = value.trim().toUpperCase();
  return /^E-\d{4,}$/.test(reference) ? reference : null;
}

/** The enquiry an attach goes to: the suspected one, or the reference a person typed. */
export function attachTarget(
  choice: "suspect" | "other",
  suspectReference: string | null,
  typed: string,
): string | null {
  if (choice === "suspect") return suspectReference;
  return normaliseEnquiryReference(typed);
}

/** A reason staff give for a review, trimmed; null when it is too short or too long. */
export function reviewReasonOf(value: string): string | null {
  const reason = value.trim();
  return reason.length >= QUARANTINE_REVIEW_REASON_MIN &&
    reason.length <= QUARANTINE_REVIEW_REASON_MAX
    ? reason
    : null;
}

/** What is wrong with a typed reason, in words; null when it is fine. */
export function reviewReasonError(value: string): string | null {
  const reason = value.trim();
  if (reason.length > QUARANTINE_REVIEW_REASON_MAX) return QUARANTINE_COPY.attach.reasonTooLong;
  if (reason.length < QUARANTINE_REVIEW_REASON_MIN) return QUARANTINE_COPY.attach.reasonInvalid;
  return null;
}

/**
 * Whether the held mail's own facts already say its sender is not verified, so the attach dialog
 * asks for an explicit confirmation up front (the API may still ask for one when the mail is from
 * an address other than the chosen enquiry's client).
 */
export function senderUnverified(
  message: Pick<QuarantineMessage, "reason" | "spfResult" | "dkimResult">,
): boolean {
  return isHeldMailSenderUnverified(message);
}

/** The sentence for a refused review, from the Bid API's error code. */
export function quarantineErrorMessage(
  code: string | undefined,
  status: number | undefined,
): string {
  const errors = QUARANTINE_COPY.errors as Readonly<Record<string, string>>;
  if (code && code in errors) return errors[code] as string;
  if (status === 403) return QUARANTINE_COPY.errors.forbidden;
  return QUARANTINE_COPY.errors.unavailable;
}
