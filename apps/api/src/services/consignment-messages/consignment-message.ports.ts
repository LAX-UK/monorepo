import type { ConsignmentMessageSide } from "@auction/domain";
import type { ConsignmentThreadSubject } from "@auction/persistence/interfaces";

/** A message as both sides read it over the API. */
export type ConsignmentMessageView = {
  id: string;
  side: ConsignmentMessageSide;
  author: { userId: string | null; name: string };
  body: string;
  createdAt: string;
  /** When the other side first read it. */
  readAt: string | null;
  attachments: Array<{
    id: string;
    fileName: string;
    contentType: string | null;
    byteSize: number | null;
    url: string;
  }>;
};

/** What a message notice says, whichever way it goes. */
export type ConsignmentMessageNotice = {
  subject: ConsignmentThreadSubject;
  authorName: string;
  body: string;
  fileCount: number;
};

/**
 * Tells people about a new message. Best effort: a notice that fails never undoes the message.
 * - a specialist's message goes to the consignment's people in the account (owners and admins,
 *   and the member who sent the work), as the account's notice;
 * - a client's message goes to the assigned specialist, linking to Bid admin.
 */
export interface IConsignmentMessageNotifier {
  specialistWrote(notice: ConsignmentMessageNotice): Promise<void>;
  clientWrote(notice: ConsignmentMessageNotice): Promise<void>;
}

/** Assigns the specialist on a consignment, through the submission's own assignment. */
export interface IConsignmentSpecialistAssigner {
  assign(input: {
    staffUserId: string;
    submissionId: string;
    assignedToUserId: string | null;
  }): Promise<{ ok: true } | { ok: false; status: number; message: string }>;
}

/** Turns stored object keys into links the reader can open (signed when storage is private). */
export interface IAttachmentLinks {
  linksFor(keys: readonly string[]): Promise<string[]>;
}
