/**
 * Email delivery for one person: the sends to their address, the block on it (if any) and how
 * staff lift a block. This is the contract between the API and the Bid admin screen.
 */

/** Why an address is blocked. One to one with the stored suppression reasons. */
export const EMAIL_BLOCK_REASONS = [
  "hard_bounce",
  "soft_bounce_threshold",
  "complaint",
  "manual",
  "unsubscribe",
  "unsubscribed_marketing",
] as const;
export type EmailBlockReason = (typeof EMAIL_BLOCK_REASONS)[number];

/** What a staff member says when lifting a block. Which ones apply depends on the block. */
export const EMAIL_LIFT_REASONS = [
  "mailbox_fixed",
  "address_confirmed",
  "blocked_by_mistake",
  "asked_to_receive_again",
  "other",
] as const;
export type EmailLiftReason = (typeof EMAIL_LIFT_REASONS)[number];

/** What a send shows as. Opens and clicks are not tracked. */
export const EMAIL_SEND_STATUSES = [
  "delivered",
  "sent",
  "queued",
  "bounced",
  "complaint",
  "not_sent_blocked",
  "failed",
] as const;
export type EmailSendStatus = (typeof EMAIL_SEND_STATUSES)[number];

export const EMAIL_SEND_HISTORY_LIMIT = 20;

export type EmailSendEvent = {
  type: "delivered" | "bounce" | "soft_bounce" | "complaint" | "unsubscribe";
  receivedAt: string;
};

export type EmailSendView = {
  id: string;
  /** The email in plain words, never the template id. */
  label: string;
  essential: boolean;
  product: "bid" | "shop" | "art" | "account";
  status: EmailSendStatus;
  createdAt: string;
  sentAt: string | null;
  events: EmailSendEvent[];
};

export type EmailAddressStatus = "ok" | "bounced" | "complained";

/** The lift decision the server made for the signed-in person; the screen only renders it. */
export type EmailLiftAvailability = { allowed: true } | { allowed: false; reason: string };

export type EmailBlockView = {
  reason: EmailBlockReason;
  since: string;
  /** The provider's own words, for anyone who needs them. */
  providerDetail: string | null;
  stopsEssentialEmail: boolean;
  /** Lift reasons this block accepts, in display order. Empty when it cannot be lifted. */
  liftReasons: EmailLiftReason[];
  noteRequired: boolean;
  writtenRequestRequired: boolean;
  lift: EmailLiftAvailability;
};

/** Alert emails are owned by the alert engine; null until it is live. */
export type EmailAlertState = { state: "on" | "off" | "stopped_after_complaint" } | null;

export type PersonEmailDeliveryView = {
  addressStatus: EmailAddressStatus;
  lastDeliveredAt: string | null;
  alerts: EmailAlertState;
  block: EmailBlockView | null;
  sends: EmailSendView[];
};

export type LiftEmailBlockBody = {
  reason: EmailLiftReason;
  note?: string | undefined;
  /** Complaints only: the person asked in writing to receive email again. */
  writtenRequest?: boolean | undefined;
  /** When the block started, as the screen saw it. A different value means it changed. */
  expectedSince: string;
};

export type EmailProviderResult =
  | { status: "queued" }
  | { status: "not_needed" }
  | { status: "still_blocked"; message: string };

export const POSTMARK_STILL_BLOCKS_MESSAGE = "Postmark still blocks this address";

export type LiftEmailBlockResult = {
  provider: EmailProviderResult;
};
