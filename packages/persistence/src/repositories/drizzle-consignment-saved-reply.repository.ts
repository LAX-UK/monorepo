import type { Database } from "@auction/db";
import { bidIdentityDirectory, consignmentSavedReply } from "@auction/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import type {
  IConsignmentSavedReplyRepository,
  SavedReplyRecord,
  SavedReplyWriteResult,
} from "../interfaces/consignment-saved-reply.repository.js";

/** Serialises changes to the team's replies so the count and the titles stay true together. */
const SAVED_REPLY_LOCK_KEY = "consignment_saved_replies";

const columns = {
  id: consignmentSavedReply.id,
  title: consignmentSavedReply.title,
  body: consignmentSavedReply.body,
  updatedAt: consignmentSavedReply.updatedAt,
  updatedById: consignmentSavedReply.updatedByUserId,
  updatedByName: bidIdentityDirectory.name,
};

type Row = {
  id: string;
  title: string;
  body: string;
  updatedAt: Date;
  updatedById: string | null;
  updatedByName: string | null;
};

function toRecord(row: Row): SavedReplyRecord {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedById
      ? { userId: row.updatedById, name: row.updatedByName ?? "A colleague" }
      : null,
  };
}

function isTitleClash(error: unknown): boolean {
  const code = (error as { code?: string; cause?: { code?: string } }).code;
  const causeCode = (error as { cause?: { code?: string } }).cause?.code;
  return code === "23505" || causeCode === "23505";
}

export class DrizzleConsignmentSavedReplyRepository implements IConsignmentSavedReplyRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<SavedReplyRecord[]> {
    const rows = await this.selectAll().orderBy(asc(sql`lower(${consignmentSavedReply.title})`));
    return rows.map(toRecord);
  }

  async create(input: {
    title: string;
    body: string;
    byUserId: string;
    at: Date;
    limit: number;
  }): Promise<SavedReplyWriteResult> {
    try {
      return await this.db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${SAVED_REPLY_LOCK_KEY}))`);
        const [counted] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(consignmentSavedReply);
        if (Number(counted?.count ?? 0) >= input.limit) return { outcome: "limit_reached" };
        const [created] = await tx
          .insert(consignmentSavedReply)
          .values({
            title: input.title,
            body: input.body,
            createdByUserId: input.byUserId,
            updatedByUserId: input.byUserId,
            createdAt: input.at,
            updatedAt: input.at,
          })
          .returning({ id: consignmentSavedReply.id });
        if (!created) throw new Error("saved reply was not written");
        return { outcome: "saved", reply: await this.read(created.id, tx) };
      });
    } catch (error) {
      if (isTitleClash(error)) return { outcome: "duplicate_title" };
      throw error;
    }
  }

  async update(input: {
    id: string;
    title: string;
    body: string;
    byUserId: string;
    at: Date;
  }): Promise<SavedReplyWriteResult> {
    try {
      const [updated] = await this.db
        .update(consignmentSavedReply)
        .set({
          title: input.title,
          body: input.body,
          updatedByUserId: input.byUserId,
          updatedAt: input.at,
        })
        .where(eq(consignmentSavedReply.id, input.id))
        .returning({ id: consignmentSavedReply.id });
      if (!updated) return { outcome: "not_found" };
      return { outcome: "saved", reply: await this.read(updated.id, this.db) };
    } catch (error) {
      if (isTitleClash(error)) return { outcome: "duplicate_title" };
      throw error;
    }
  }

  async remove(id: string): Promise<boolean> {
    const removed = await this.db
      .delete(consignmentSavedReply)
      .where(eq(consignmentSavedReply.id, id))
      .returning({ id: consignmentSavedReply.id });
    return removed.length > 0;
  }

  private selectAll(db: Database = this.db) {
    return db
      .select(columns)
      .from(consignmentSavedReply)
      .leftJoin(
        bidIdentityDirectory,
        eq(bidIdentityDirectory.subjectId, consignmentSavedReply.updatedByUserId),
      );
  }

  private async read(id: string, db: Database): Promise<SavedReplyRecord> {
    const [row] = await this.selectAll(db).where(eq(consignmentSavedReply.id, id)).limit(1);
    if (!row) throw new Error("saved reply was not read back");
    return toRecord(row);
  }
}
