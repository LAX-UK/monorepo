import type { Database } from "@auction/db";

/** What an emailed reply needs to know about the thread it may belong to. */
export type InboundEnquiryTarget = {
  id: string;
  reference: string;
  intent: string;
  topic: string;
  name: string;
  /** The enquirer's address, to check that the reply comes from them. */
  email: string;
  status: string;
};

export type InboundAttachmentMetadata = { name: string; contentType: string; sizeBytes: number };

export type NewInboundMessage = {
  enquiryId: string;
  providerMessageId: string;
  matchedBy: "token" | "in_reply_to";
  fromEmailHash: string;
  subject: string;
  body: string;
  attachments: InboundAttachmentMetadata[];
};

export type NewQuarantinedMessage = {
  providerMessageId: string;
  reason: "unmatched" | "bad_token" | "sender_mismatch" | "spf_failed" | "auto_reply";
  fromAddress: string;
  subject: string;
  body: string;
  attachments: InboundAttachmentMetadata[];
  suspectedEnquiryId?: string | undefined;
};

/** Storage for mail received on the Postmark inbound webhook. */
export interface IEnquiryInboundRepository {
  findTargetById(id: string): Promise<InboundEnquiryTarget | null>;
  /**
   * The enquiry a staff reply belongs to, found from the provider message ids a reply's
   * In-Reply-To or References header quotes. Null when none is a staff reply on a thread.
   */
  findTargetByOutboundMessageIds(
    providerMessageIds: readonly string[],
  ): Promise<InboundEnquiryTarget | null>;
  /** Stores the sender's reply; null when this provider message id is already stored (a replay). */
  insertInboundMessageInTransaction(
    tx: Database,
    input: NewInboundMessage,
  ): Promise<{ id: string } | null>;
  /**
   * Marks the thread as waiting for staff: sets `awaiting_reply_since` (keeping an earlier value),
   * returns a thread waiting on the client to in progress and bumps the version. A closed or
   * converted thread keeps its status.
   */
  markAwaitingReplyInTransaction(tx: Database, enquiryId: string, at: Date): Promise<void>;
  /** Holds a message for review; null when this provider message id is already held. */
  insertQuarantineInTransaction(
    tx: Database,
    input: NewQuarantinedMessage,
  ): Promise<{ id: string } | null>;
  /** Whether a message with this provider id is already stored on a thread or held. */
  isKnownProviderMessage(providerMessageId: string): Promise<boolean>;
}
