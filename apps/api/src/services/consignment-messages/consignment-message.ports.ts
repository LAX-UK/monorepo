import type { ConsignmentMessageSide } from "@auction/domain";
import type { ConsignmentThreadSubject } from "@auction/persistence/interfaces";

/** A message as the account reads it over the API. */
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
 * - a client's message goes to whoever has the thread (a covering colleague, else the
 *   specialist), linking to Bid admin; an unassigned consignment tells no one.
 */
export interface IConsignmentMessageNotifier {
  specialistWrote(notice: ConsignmentMessageNotice): Promise<void>;
  clientWrote(notice: ConsignmentMessageNotice): Promise<void>;
}

/** Turns stored object keys into links the reader can open (signed when storage is private). */
export interface IAttachmentLinks {
  linksFor(keys: readonly string[]): Promise<string[]>;
}

/** Turns stored image references (keys or addresses) into links the reader can open. */
export interface IImageLinks {
  resolveAll(values: readonly string[]): Promise<string[]>;
}

/**
 * Lets a staff reply reach the account after its short hold: `schedule` says when, `cancel`
 * forgets it (the reply was taken back). Scheduling may fail (the queue is away); the caller
 * then releases the reply at once instead.
 */
export interface IConsignmentReplyDelivery {
  schedule(messageId: string, at: Date): Promise<void>;
  cancel(messageId: string): Promise<void>;
}
