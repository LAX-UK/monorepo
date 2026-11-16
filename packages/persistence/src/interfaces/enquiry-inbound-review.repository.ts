import type { Database } from "@auction/db";
import type {
  EnquiryIntent,
  InboundDkimResult,
  InboundMatchMethod,
  InboundQuarantineReason,
  InboundQuarantineStatus,
  InboundSpfResult,
} from "@auction/domain";
import type { InboundAttachmentMetadata } from "./enquiry-inbound.repository.js";

/** A reply the sender emailed back, as it sits on the thread. */
export type InboundThreadMessage = {
  id: string;
  receivedAt: Date;
  subject: string;
  /** Plain text, already stripped of HTML and size-limited when it was received. */
  body: string;
  attachments: InboundAttachmentMetadata[];
  matchedBy: InboundMatchMethod;
  /** Null for a reply received before the result was recorded. */
  spfResult: InboundSpfResult | null;
  dkimResult: InboundDkimResult | null;
  /** Attached by staff only: why the mail was held before a person attached it. */
  heldReason: InboundQuarantineReason | null;
  /** Attached by staff only: the reason the person gave for attaching it. */
  reviewReason: string | null;
  /** A hash of the From address (never the address), to compare with the enquirer's. */
  fromEmailHash: string | null;
};

/** The emailed replies on one enquiry thread. */
export interface IEnquiryInboundThreadReader {
  /** Oldest first, at most `limit`. */
  listInbound(enquiryId: string, limit: number): Promise<InboundThreadMessage[]>;
}

/**
 * The enquiry a held message's reply address named, if it named a real one that has not been
 * erased (mail naming an erased enquiry reads as unmatched).
 */
export type SuspectedEnquiry = { id: string; reference: string; intent: EnquiryIntent };

/** One held message in the staff list: enough to triage, not the text. */
export type QuarantinedMessageSummary = {
  id: string;
  reason: InboundQuarantineReason;
  status: InboundQuarantineStatus;
  fromAddress: string;
  subject: string;
  attachmentCount: number;
  suspectedEnquiry: SuspectedEnquiry | null;
  receivedAt: Date;
  purgeAt: Date;
  reviewedAt: Date | null;
};

/** One held message in full, for reading and review. */
export type QuarantinedMessageRecord = QuarantinedMessageSummary & {
  providerMessageId: string;
  body: string;
  attachments: InboundAttachmentMetadata[];
  spfResult: InboundSpfResult | null;
  dkimResult: InboundDkimResult | null;
  reviewedByUserId: string | null;
};

/** What the person looking at held mail may see, from their capabilities. */
export type QuarantineScope = { readsGeneral: boolean; readsPrivateSale: boolean };

export type QuarantineListFilter = {
  scope: QuarantineScope;
  /** Waiting for a person, or already attached or discarded (until purged). */
  view: "pending" | "reviewed";
  /** Continue after this message, newest first. */
  after?: { receivedAt: Date; id: string } | null | undefined;
  limit: number;
};

/**
 * Held inbound mail for staff review. Mail whose suspected enquiry is a private sale enquiry shows
 * only to people who read private sale enquiries; all other held mail to people who read general
 * enquiries. A held message is never changed apart from its review status.
 */
export interface IEnquiryQuarantineReviewRepository {
  /** Newest first; returns up to `limit + 1` so the caller can tell whether there is more. */
  list(filter: QuarantineListFilter): Promise<QuarantinedMessageSummary[]>;
  countPending(scope: QuarantineScope): Promise<number>;
  findById(id: string, scope: QuarantineScope): Promise<QuarantinedMessageRecord | null>;
  /** Locks the row for the review in the caller's transaction; null when it is gone. */
  lockInTransaction(tx: Database, id: string): Promise<QuarantinedMessageRecord | null>;
  /** Records the review: `linked` (attached to an enquiry) or `dismissed`. */
  markReviewedInTransaction(
    tx: Database,
    id: string,
    review: { status: "linked" | "dismissed"; byUserId: string; at: Date },
  ): Promise<void>;
}
