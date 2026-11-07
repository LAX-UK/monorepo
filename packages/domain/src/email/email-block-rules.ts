import type { EmailBlockReason, EmailLiftReason, EmailSendStatus } from "@auction/types";

/** Who may lift a block: staff with the lift rule, only email administrators, or nobody. */
export type EmailBlockLiftBy = "support" | "administrator" | "nobody";

/** Whether lifting also asks the email provider to stop blocking the address. */
export type EmailProviderReactivation = "request" | "unavailable" | "none";

export type EmailBlockRule = {
  liftBy: EmailBlockLiftBy;
  /** Stops invoices and account mail too, not just optional email. */
  stopsEssentialEmail: boolean;
  /** Lift reasons accepted, in display order. */
  liftReasons: readonly EmailLiftReason[];
  /** A note is always needed, whatever the reason. Otherwise only "other" needs one. */
  noteAlwaysRequired: boolean;
  /** The person must have asked in writing. */
  writtenRequestRequired: boolean;
  /** A complaint risks sender reputation for every client. */
  isComplaint: boolean;
  providerReactivation: EmailProviderReactivation;
};

const ADDRESS_FIXES = [
  "mailbox_fixed",
  "address_confirmed",
  "blocked_by_mistake",
  "other",
] as const satisfies readonly EmailLiftReason[];

/** One row per block reason. Panel, dialog and routes all read this table. */
export const EMAIL_BLOCK_RULES: Readonly<Record<EmailBlockReason, EmailBlockRule>> = {
  hard_bounce: {
    liftBy: "support",
    stopsEssentialEmail: true,
    liftReasons: ADDRESS_FIXES,
    noteAlwaysRequired: false,
    writtenRequestRequired: false,
    isComplaint: false,
    providerReactivation: "request",
  },
  soft_bounce_threshold: {
    liftBy: "support",
    stopsEssentialEmail: true,
    liftReasons: ADDRESS_FIXES,
    noteAlwaysRequired: false,
    writtenRequestRequired: false,
    isComplaint: false,
    // The provider never blocked the address; the threshold is ours.
    providerReactivation: "none",
  },
  manual: {
    liftBy: "support",
    stopsEssentialEmail: true,
    liftReasons: ADDRESS_FIXES,
    noteAlwaysRequired: false,
    writtenRequestRequired: false,
    isComplaint: false,
    providerReactivation: "request",
  },
  complaint: {
    liftBy: "administrator",
    stopsEssentialEmail: true,
    liftReasons: ["asked_to_receive_again"],
    noteAlwaysRequired: true,
    writtenRequestRequired: true,
    isComplaint: true,
    providerReactivation: "unavailable",
  },
  unsubscribe: {
    liftBy: "nobody",
    stopsEssentialEmail: false,
    liftReasons: [],
    noteAlwaysRequired: false,
    writtenRequestRequired: false,
    isComplaint: false,
    providerReactivation: "none",
  },
  // A marketing opt-out recorded from Zoho Campaigns: the person's own choice, made there.
  unsubscribed_marketing: {
    liftBy: "nobody",
    stopsEssentialEmail: false,
    liftReasons: [],
    noteAlwaysRequired: false,
    writtenRequestRequired: false,
    isComplaint: false,
    providerReactivation: "none",
  },
};

export type EmailLiftActor = {
  /** Holds the lift rule (client services, administrators). */
  canLift: boolean;
  /** Holds the email administrator rule (administrators). */
  isEmailAdmin: boolean;
};

export type EmailLiftRefusal =
  | "unsubscribe_not_liftable"
  | "administrator_only"
  | "not_allowed"
  | "reason_not_accepted"
  | "note_required"
  | "written_request_required";

const REFUSAL_WORDS: Readonly<Record<EmailLiftRefusal, string>> = {
  unsubscribe_not_liftable:
    "Only the person can turn optional email back on, from their own settings",
  administrator_only: "Only an administrator can lift a complaint block",
  not_allowed: "You do not have access to lift email blocks",
  reason_not_accepted: "Choose one of the reasons offered for this block",
  note_required: "Add a note",
  written_request_required: "Confirm the person asked in writing",
};

export function emailLiftRefusalWords(refusal: EmailLiftRefusal): string {
  return REFUSAL_WORDS[refusal];
}

/** Whether this person may lift this block at all, before any reason is chosen. */
export function emailLiftAccessRefusal(
  reason: EmailBlockReason,
  actor: EmailLiftActor,
): EmailLiftRefusal | null {
  const rule = EMAIL_BLOCK_RULES[reason];
  if (rule.liftBy === "nobody") return "unsubscribe_not_liftable";
  if (rule.liftBy === "administrator") return actor.isEmailAdmin ? null : "administrator_only";
  return actor.canLift || actor.isEmailAdmin ? null : "not_allowed";
}

export type EmailLiftInput = {
  reason: EmailLiftReason;
  note?: string | undefined;
  writtenRequest?: boolean | undefined;
};

/** Whether the reason, note and written-request tick satisfy the block's rule. */
export function emailLiftInputRefusal(
  blockReason: EmailBlockReason,
  input: EmailLiftInput,
): EmailLiftRefusal | null {
  const rule = EMAIL_BLOCK_RULES[blockReason];
  if (!rule.liftReasons.includes(input.reason)) return "reason_not_accepted";
  const noteNeeded = rule.noteAlwaysRequired || input.reason === "other";
  if (noteNeeded && !input.note?.trim()) return "note_required";
  if (rule.writtenRequestRequired && input.writtenRequest !== true) {
    return "written_request_required";
  }
  return null;
}

export type EmailSendFacts = {
  outbox: "pending" | "sending" | "sent" | "failed" | "suppressed";
  events: ReadonlySet<string>;
};

/** What a send shows as. A complaint outranks a bounce, which outranks a delivery report. */
export function emailSendStatus(facts: EmailSendFacts): EmailSendStatus {
  switch (facts.outbox) {
    case "pending":
    case "sending":
      return "queued";
    case "failed":
      return "failed";
    case "suppressed":
      return "not_sent_blocked";
    case "sent":
      if (facts.events.has("complaint")) return "complaint";
      if (facts.events.has("bounce")) return "bounced";
      if (facts.events.has("delivered")) return "delivered";
      return "sent";
  }
}
