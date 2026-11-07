import type { StaffStatusTone } from "@auction/staff-ui";
import type {
  EmailBlockReason,
  EmailLiftReason,
  EmailSendEvent,
  EmailSendStatus,
  EmailSendView,
} from "@auction/types";

/**
 * The words staff read for email delivery, in one place: what a block is called, what it stops,
 * what a send shows as. Screens look these up by key, so a new reason or status is one row here.
 */

type BlockCopy = {
  /** The headline of the block, "Email is blocked: bounced". */
  title: string;
  /** Short name of the block, for the dialog summary. */
  name: string;
  /** What happened and what it stops. `who` is the person's first name. */
  body: (who: string) => string;
};

export const BLOCK_COPY: Record<EmailBlockReason, BlockCopy> = {
  hard_bounce: {
    title: "Email is blocked: bounced",
    name: "Bounced",
    body: (who) =>
      `The receiving server says this mailbox doesn’t exist. No email reaches ${who}, including invoices and payment reminders.`,
  },
  soft_bounce_threshold: {
    title: "Email is blocked: repeated soft bounces",
    name: "Repeated soft bounces",
    body: (who) =>
      `Several temporary failures in a row, such as a full mailbox. No email reaches ${who}, including invoices and payment reminders.`,
  },
  manual: {
    title: "Email is blocked: blocked by staff",
    name: "Blocked by staff",
    body: (who) =>
      `A member of staff blocked this address. No email reaches ${who}, including invoices and payment reminders.`,
  },
  complaint: {
    title: "Email is blocked: marked as spam",
    name: "Marked as spam",
    body: (who) =>
      `${who} marked an email from LAX as spam. No email reaches ${who}, including invoices and payment reminders.`,
  },
  unsubscribe: {
    title: "Optional email is off",
    name: "Optional email off",
    body: (who) =>
      `${who} unsubscribed. Invoices, receipts and account email still go. Only ${who} can turn optional email back on, from their own settings.`,
  },
  unsubscribed_marketing: {
    title: "Marketing and alert email is off",
    name: "Marketing email off",
    body: (who) =>
      `${who} unsubscribed from LAX marketing email. Alert email stops too. Invoices, receipts and account email still go. Only ${who} can turn it back on.`,
  },
};

export const SEND_STATUS: Record<EmailSendStatus, { label: string; tone: StaffStatusTone }> = {
  delivered: { label: "Delivered", tone: "success" },
  sent: { label: "Sent", tone: "neutral" },
  queued: { label: "Queued", tone: "info" },
  bounced: { label: "Bounced", tone: "danger" },
  complaint: { label: "Complaint", tone: "danger" },
  not_sent_blocked: { label: "Not sent: blocked", tone: "warning" },
  failed: { label: "Failed", tone: "danger" },
};

export const PRODUCT_LABEL: Record<EmailSendView["product"], string> = {
  bid: "LAX Bid",
  shop: "LAX Shop",
  art: "lax.art",
  account: "LAX Account",
};

export const EVENT_COPY: Record<EmailSendEvent["type"], { title: string; tone: StaffStatusTone }> =
  {
    delivered: { title: "Delivered to the mailbox", tone: "success" },
    bounce: { title: "Bounced: the address was refused", tone: "danger" },
    soft_bounce: { title: "Temporary failure: will be tried again", tone: "warning" },
    complaint: { title: "Marked as spam by the recipient", tone: "danger" },
    unsubscribe: { title: "Unsubscribed from optional email", tone: "neutral" },
  };

export const LIFT_REASON_COPY: Record<EmailLiftReason, { label: string; hint?: string }> = {
  mailbox_fixed: { label: "The client fixed their mailbox" },
  address_confirmed: { label: "The client confirmed the address works" },
  blocked_by_mistake: { label: "Blocked by mistake" },
  asked_to_receive_again: { label: "The client asked to receive email again" },
  other: { label: "Other", hint: "A note is required" },
};

export const ALERT_STATE_COPY = {
  on: "On",
  off: "Off",
  stopped_after_complaint: "Stopped after a complaint",
} as const;

/** The first word of a name, for sentences like "No email reaches Ana". */
export function firstNameOf(name: string | null | undefined): string {
  const first = name?.trim().split(/\s+/)[0];
  return first && !first.includes("@") ? first : "this person";
}
