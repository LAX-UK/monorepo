import type { ConsignmentMessageSide } from "@auction/domain";
import type { LegalEntityStatus } from "@auction/types";

/** The consignment a thread belongs to, with what access and the inbox need to know about it. */
export type ConsignmentThreadSubject = {
  submissionId: string;
  title: string;
  referenceNumber: number;
  submittedByUserId: string | null;
  /** The account that sent it; `null` only for submissions from before accounts. */
  account: {
    id: string;
    name: string;
    kind: "individual" | "organisation";
    status: LegalEntityStatus;
  } | null;
  /** The specialist assigned to the consignment, who answers its messages. */
  specialist: { userId: string; name: string } | null;
  /** The sale the consignment's lot is in, once catalogued. */
  saleId: string | null;
};

export type ConsignmentMessageAttachmentRow = {
  id: string;
  uploadObjectId: string;
  fileName: string | null;
  key: string;
  contentType: string | null;
  byteSize: number | null;
};

export type ConsignmentMessageRow = {
  id: string;
  authorUserId: string | null;
  /** The author's name now; `null` once their account is gone. */
  authorName: string | null;
  authorSide: ConsignmentMessageSide;
  body: string;
  createdAt: Date;
  /** When the other side first read it. */
  readAt: Date | null;
  attachments: ConsignmentMessageAttachmentRow[];
};

/** What decides whether an upload may be attached: who uploaded it, for what, and its check. */
export type AttachableUpload = {
  id: string;
  ownerUserId: string;
  kind: string;
  status: string;
};

export type NewConsignmentMessage = {
  submissionId: string;
  authorUserId: string;
  side: ConsignmentMessageSide;
  body: string;
  at: Date;
  attachments: ReadonlyArray<{ uploadObjectId: string; fileName: string | null }>;
};

/** One thread in the staff inbox. */
export type ConsignmentThreadSummaryRow = {
  submissionId: string;
  title: string;
  referenceNumber: number;
  account: { id: string; name: string } | null;
  specialist: { userId: string; name: string } | null;
  saleId: string | null;
  lastMessageAt: Date;
  lastMessageSide: ConsignmentMessageSide;
  /** The newest message's text, for the inbox row. */
  lastMessageBody: string;
  /** Client messages LAX has not read yet. */
  unreadForStaff: number;
};

export type ConsignmentThreadInboxQuery = {
  /** Only threads whose newest message is the client's. */
  awaitingStaff: boolean;
  /** One specialist's threads, or the threads of consignments nobody is assigned to. */
  assigned?: { kind: "user"; userId: string } | { kind: "unassigned" } | undefined;
  saleId?: string | undefined;
  limit: number;
  /** Threads older than this one, newest first: the last row of the previous page. */
  before?: { lastMessageAt: Date; submissionId: string } | undefined;
};

/**
 * Threads and messages on consignments. Who may read or write is decided above this port; it
 * stores, lists and marks messages read.
 */
export interface IConsignmentMessageRepository {
  findSubject(submissionId: string): Promise<ConsignmentThreadSubject | null>;
  /** Every message on the consignment, oldest first, with attachments. */
  listMessages(submissionId: string): Promise<ConsignmentMessageRow[]>;
  findUploads(uploadObjectIds: readonly string[]): Promise<AttachableUpload[]>;
  /** Adds a message (opening the thread with the first) and moves the thread's newest marker. */
  append(input: NewConsignmentMessage): Promise<{ messageId: string }>;
  /** Marks the other side's unread messages read; returns how many changed. */
  markRead(input: {
    submissionId: string;
    readerSide: ConsignmentMessageSide;
    at: Date;
  }): Promise<number>;
  listThreadsForStaff(query: ConsignmentThreadInboxQuery): Promise<ConsignmentThreadSummaryRow[]>;
}
