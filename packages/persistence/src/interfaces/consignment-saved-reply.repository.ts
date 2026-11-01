import type { StaffPersonRecord } from "./consignment-message.repository.js";

export type SavedReplyRecord = {
  id: string;
  title: string;
  body: string;
  updatedAt: Date;
  updatedBy: StaffPersonRecord | null;
};

export type SavedReplyWriteResult =
  | { outcome: "saved"; reply: SavedReplyRecord }
  | { outcome: "duplicate_title" }
  | { outcome: "limit_reached" }
  | { outcome: "not_found" };

/** The team's saved replies. Titles are unique ignoring case; the count is capped. */
export interface IConsignmentSavedReplyRepository {
  list(): Promise<SavedReplyRecord[]>;
  /** Adds a reply unless the title is taken or `limit` replies exist (checked together). */
  create(input: {
    title: string;
    body: string;
    byUserId: string;
    at: Date;
    limit: number;
  }): Promise<SavedReplyWriteResult>;
  update(input: {
    id: string;
    title: string;
    body: string;
    byUserId: string;
    at: Date;
  }): Promise<SavedReplyWriteResult>;
  /** Removes a reply; false when it was not there. */
  remove(id: string): Promise<boolean>;
}
