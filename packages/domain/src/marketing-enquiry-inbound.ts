import type { EnquiryStatus } from "./marketing-enquiry-vocabulary.js";

/**
 * Replies a sender emails back to an enquiry (received on the Postmark inbound webhook), and the
 * mail held back from a thread for staff to review. The vocabulary and the rules live here so the
 * webhook, the staff routes and the staff screens agree.
 */

/** How a received reply was tied to its thread: its reply address, a quoted message id, or staff. */
export const INBOUND_MATCH_METHODS = ["token", "in_reply_to", "staff"] as const;
export type InboundMatchMethod = (typeof INBOUND_MATCH_METHODS)[number];

/** Why a received mail was held back from a thread. */
export const INBOUND_QUARANTINE_REASONS = [
  "unmatched",
  "bad_token",
  "sender_mismatch",
  "spf_failed",
  "auto_reply",
  "unauthenticated",
] as const;
export type InboundQuarantineReason = (typeof INBOUND_QUARANTINE_REASONS)[number];

/** Where a held mail stands: waiting for a person, discarded, or attached to an enquiry. */
export const INBOUND_QUARANTINE_STATUSES = ["pending", "dismissed", "linked"] as const;
export type InboundQuarantineStatus = (typeof INBOUND_QUARANTINE_STATUSES)[number];

/** The SPF result the receiving server recorded for a received mail (RFC 7208 results). */
export const INBOUND_SPF_RESULTS = [
  "pass",
  "fail",
  "softfail",
  "neutral",
  "none",
  "temperror",
  "permerror",
] as const;
export type InboundSpfResult = (typeof INBOUND_SPF_RESULTS)[number];

/**
 * The DKIM result of a received mail: `pass` only when a signature passed for a domain aligned
 * with the From address; a passing signature for another domain is `pass_unaligned`.
 */
export const INBOUND_DKIM_RESULTS = ["pass", "pass_unaligned", "fail", "none"] as const;
export type InboundDkimResult = (typeof INBOUND_DKIM_RESULTS)[number];

export type InboundAuthentication = { spf: InboundSpfResult; dkim: InboundDkimResult };

/**
 * Whether the sender of a mail is authenticated well enough for it to join a thread on its own:
 * SPF passed, or a DKIM signature aligned with the From domain passed. Anything else is held for
 * a person to look at.
 */
export function isInboundSenderAuthenticated(auth: InboundAuthentication): boolean {
  return auth.spf === "pass" || auth.dkim === "pass";
}

/**
 * Whether staff moving an enquiry to `status` answers the client, so it no longer waits for a
 * reply: waiting on the client, closed and converted all mean someone has dealt with it.
 */
export function enquiryStatusAnswersClient(status: EnquiryStatus): boolean {
  return status === "waiting_on_client" || status === "closed" || status === "converted";
}

export type QuarantineReviewRefusal = "already_reviewed";

/** A held mail is reviewed once: only a pending one can be attached or discarded. */
export function quarantineReviewRefusal(
  status: InboundQuarantineStatus,
): QuarantineReviewRefusal | null {
  return status === "pending" ? null : "already_reviewed";
}
