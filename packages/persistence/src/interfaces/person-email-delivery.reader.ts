import type { EmailEventType, EmailOutboxStatus, EmailSuppressionReason } from "@auction/db/schema";

export type PersonEmailAddressStatus = "ok" | "bounced" | "complained";

export type PersonEmailSendRecord = {
  id: string;
  template: string;
  /** Template variables; the service reads the product from them and never forwards them. */
  vars: Record<string, unknown>;
  outboxStatus: EmailOutboxStatus;
  createdAt: Date;
  sentAt: Date | null;
  events: { type: EmailEventType; receivedAt: Date }[];
};

export type PersonEmailBlockRecord = {
  emailHash: string;
  reason: EmailSuppressionReason;
  since: Date;
  /** What the provider reported when it raised the block. */
  providerDetail: string | null;
};

export type PersonEmailDeliveryRecord = {
  addressStatus: PersonEmailAddressStatus;
  lastDeliveredAt: Date | null;
  block: PersonEmailBlockRecord | null;
  /** Newest first. */
  sends: PersonEmailSendRecord[];
};

/** Reads one person's email delivery: their sends, provider reports and any block. */
export interface IPersonEmailDeliveryReader {
  /** The person's current address, or null when they have none on record. */
  findAddress(userId: string): Promise<{ email: string } | null>;
  read(input: {
    userId: string;
    emailHash: string;
    sendLimit: number;
  }): Promise<PersonEmailDeliveryRecord>;
}
