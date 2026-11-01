import { randomUUID } from "node:crypto";
import type {
  IConsignmentSavedReplyRepository,
  SavedReplyRecord,
  SavedReplyWriteResult,
} from "@auction/persistence/interfaces";

/** The team's saved replies in memory, with the same title and count rules as the database. */
export class InMemoryConsignmentSavedReplies implements IConsignmentSavedReplyRepository {
  readonly replies: SavedReplyRecord[] = [];

  async list(): Promise<SavedReplyRecord[]> {
    return [...this.replies].sort((a, b) =>
      a.title.toLowerCase().localeCompare(b.title.toLowerCase()),
    );
  }

  async create(input: {
    title: string;
    body: string;
    byUserId: string;
    at: Date;
    limit: number;
  }): Promise<SavedReplyWriteResult> {
    if (this.replies.length >= input.limit) return { outcome: "limit_reached" };
    if (this.titleTaken(input.title)) return { outcome: "duplicate_title" };
    const reply: SavedReplyRecord = {
      id: randomUUID(),
      title: input.title,
      body: input.body,
      updatedAt: input.at,
      updatedBy: { userId: input.byUserId, name: input.byUserId },
    };
    this.replies.push(reply);
    return { outcome: "saved", reply };
  }

  async update(input: {
    id: string;
    title: string;
    body: string;
    byUserId: string;
    at: Date;
  }): Promise<SavedReplyWriteResult> {
    const reply = this.replies.find((r) => r.id === input.id);
    if (!reply) return { outcome: "not_found" };
    if (this.titleTaken(input.title, input.id)) return { outcome: "duplicate_title" };
    Object.assign(reply, {
      title: input.title,
      body: input.body,
      updatedAt: input.at,
      updatedBy: { userId: input.byUserId, name: input.byUserId },
    });
    return { outcome: "saved", reply };
  }

  async remove(id: string): Promise<boolean> {
    const index = this.replies.findIndex((r) => r.id === id);
    if (index < 0) return false;
    this.replies.splice(index, 1);
    return true;
  }

  private titleTaken(title: string, exceptId?: string): boolean {
    return this.replies.some(
      (r) => r.id !== exceptId && r.title.toLowerCase() === title.toLowerCase(),
    );
  }
}
