import type { Database } from "@auction/db";
import type {
  InboundDkimResult,
  InboundMatchMethod,
  InboundQuarantineReason,
  InboundSpfResult,
} from "@auction/domain";

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

/** What the receiving server recorded about the sender: SPF, and DKIM aligned with From. */
export type InboundAuthenticationResult = {
  spfResult: InboundSpfResult;
  dkimResult: InboundDkimResult;
};

export type NewInboundMessage = InboundAuthenticationResult & {
  enquiryId: string;
  providerMessageId: string;
  /** `staff` when a person attached it from quarantine. */
  matchedBy: InboundMatchMethod;
  /** Attached by staff only: why it was held, and the reason the person gave for attaching it. */
  heldReason?: InboundQuarantineReason | null;
  reviewReason?: string | null;
  fromEmailHash: string;
  subject: string;
  body: string;
  attachments: InboundAttachmentMetadata[];
};

export type NewQuarantinedMessage = InboundAuthenticationResult & {
  providerMessageId: string;
  reason: InboundQuarantineReason;
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
