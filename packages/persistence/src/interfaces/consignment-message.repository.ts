import type {
  ConsignmentMessageSide,
  ConsignmentMessageVisibility,
  ConsignmentThreadMarkers,
} from "@auction/domain";
import type { LegalEntityStatus } from "@auction/types";

export type StaffPersonRecord = { userId: string; name: string };

/** The thread behind a consignment, once someone has written. */
export type ConsignmentThreadState = ConsignmentThreadMarkers & {
  id: string;
  closedBy: StaffPersonRecord | null;
};

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
  specialist: StaffPersonRecord | null;
  /** A colleague answering this thread while the specialist is away. */
  covering: StaffPersonRecord | null;
  /** When that cover ends and the thread goes back to the specialist; null runs until ended. */
  coveringUntil: Date | null;
  /** The sale the consignment's lot is in, once catalogued. */
  saleId: string | null;
  /** Null until the first message. */
  thread: ConsignmentThreadState | null;
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
  /** The author's place in the consignment's account, when the author is a client member. */
  authorMemberRole: string | null;
  /** The staff roles the author holds now, when the author is staff. */
  authorStaffRoles: string[];
  authorSide: ConsignmentMessageSide;
  visibility: ConsignmentMessageVisibility;
  body: string;
  createdAt: Date;
  /** A staff reply is held back from the client until this time. */
  deliverAfter: Date | null;
  /** When the other side first read it. */
  readAt: Date | null;
  attachments: ConsignmentMessageAttachmentRow[];
};

/**
 * Who is reading. A client reads only what staff have let them see: thread messages, and staff
 * replies not held any more. Staff read everything, notes and held replies included.
 */
export type ConsignmentMessageAudience = { kind: "client"; now: Date } | { kind: "staff" };

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
  visibility: ConsignmentMessageVisibility;
  body: string;
  at: Date;
  /** A staff reply is held from the client until then. */
  deliverAfter: Date | null;
  attachments: ReadonlyArray<{ uploadObjectId: string; fileName: string | null }>;
};

export type ConsignmentThreadEventKind =
  | "assigned"
  | "unassigned"
  | "covering"
  | "closed"
  | "reopened";

export type ConsignmentThreadEventRecord = {
  id: string;
  kind: ConsignmentThreadEventKind;
  actor: StaffPersonRecord | null;
  subject: StaffPersonRecord | null;
  at: Date;
};

export type AssignThreadInput = {
  submissionId: string;
  actorUserId: string;
  /** Null leaves the consignment (or the cover) without anyone. */
  assignedToUserId: string | null;
  /** Cover this thread only; the consignment keeps its specialist. */
  covering: boolean;
  /** When the cover ends; only for a cover, null runs until someone ends it. */
  coveringUntil: Date | null;
  at: Date;
};

/** A cover that ended: the thread is back with the consignment's specialist (if it has one). */
export type EndedCover = { submissionId: string; specialist: StaffPersonRecord | null };

export type AssignThreadResult =
  | { outcome: "changed"; event: ConsignmentThreadEventKind | null }
  | { outcome: "unchanged" }
  | { outcome: "no_thread" };

export type UndoHeldReplyResult =
  | { outcome: "deleted"; submissionId: string }
  | { outcome: "expired" }
  | { outcome: "not_found" };

/** A staff reply claimed for its notice to the account. */
export type ClaimedReplyNotice = {
  submissionId: string;
  authorName: string;
  body: string;
  fileCount: number;
};

/**
 * Threads and messages on consignments. Who may read or write is decided above this port; it
 * stores messages, keeps the thread's markers true and records the thread's history. Client reads
 * never include notes or replies still held back.
 */
export interface IConsignmentMessageRepository {
  findSubject(submissionId: string): Promise<ConsignmentThreadSubject | null>;
  /** Messages on the consignment as `audience` may read them, oldest first, with attachments. */
  listMessages(
    submissionId: string,
    audience: ConsignmentMessageAudience,
  ): Promise<ConsignmentMessageRow[]>;
  findUploads(uploadObjectIds: readonly string[]): Promise<AttachableUpload[]>;
  /**
   * Adds a message (opening the thread with the first), moves the markers the message moves, and
   * reopens a closed thread when it should (recording who reopened it).
   */
  append(input: NewConsignmentMessage): Promise<{ messageId: string; reopened: boolean }>;
  /**
   * Marks the other side's unread thread messages read; returns how many changed. The client
   * reads only what has been released to them.
   */
  markRead(input: {
    submissionId: string;
    readerSide: ConsignmentMessageSide;
    at: Date;
  }): Promise<number>;
  /** Makes the newest client message unread again; false when there is none. */
  markNewestClientMessageUnread(submissionId: string): Promise<boolean>;
  /**
   * Takes a staff reply back: only by its author, while it is still held. Removes the message
   * and its attachment rows (the uploads stay), and rebuilds the thread's markers.
   */
  deleteHeldReply(input: {
    messageId: string;
    authorUserId: string;
    now: Date;
  }): Promise<UndoHeldReplyResult>;
  /** Releases a held reply at once (when it could not be scheduled); false if it is gone. */
  releaseHeldReply(messageId: string, now: Date): Promise<boolean>;
  /**
   * Claims the account's notice for a staff reply that has been released: sets `notified_at`
   * where still unset, and answers with what the notice says. `null` when it was already sent,
   * was taken back, or is still held.
   */
  claimReplyNotice(messageId: string, now: Date): Promise<ClaimedReplyNotice | null>;
  /** Closes an open thread; false when it was closed already or has no thread. */
  closeThread(input: { submissionId: string; actorUserId: string; at: Date }): Promise<boolean>;
  /** Reopens a closed thread; false when it was open already or has no thread. */
  reopenThread(input: { submissionId: string; actorUserId: string; at: Date }): Promise<boolean>;
  /**
   * Moves ownership: the consignment's specialist (clearing any cover), or cover for this thread
   * only. One transaction, and the thread's history records it.
   */
  assignThread(input: AssignThreadInput): Promise<AssignThreadResult>;
  /**
   * Ends every cover whose end date has passed, returning each thread to its specialist and
   * recording it in the thread's history. One transaction; a second run finds nothing to end.
   */
  endElapsedCovers(now: Date): Promise<EndedCover[]>;
  /**
   * Staff replies whose hold ended at or before `cutoff` and whose account was never told, oldest
   * first, for the sweep that covers a lost delivery job.
   */
  listOverdueReplyNotices(cutoff: Date, limit: number): Promise<string[]>;
  listEvents(submissionId: string): Promise<ConsignmentThreadEventRecord[]>;
}
