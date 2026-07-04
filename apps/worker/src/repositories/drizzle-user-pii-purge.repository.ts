import type { Database } from "@auction/db";
import { user } from "@auction/db/schema";
import { and, isNotNull, lt } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { IUserPiiPurgeRepository } from "../interfaces/user-pii-purge.repository.js";

export class DrizzleUserPiiPurgeRepository implements IUserPiiPurgeRepository {
  constructor(private readonly db: Database) {}

  async listDeletionCandidates(graceDays: number, batchLimit: number): Promise<string[]> {
    const cutoff = new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000);
    const candidates = await this.db
      .select({ id: user.id })
      .from(user)
      .where(and(isNotNull(user.deletionRequestedAt), lt(user.deletionRequestedAt, cutoff)))
      .limit(batchLimit);
    return candidates.map((row) => row.id);
  }

  async purgeUser(userId: string): Promise<void> {
    await this.db.execute(sql`SELECT user_pii_purge(${userId})`);
  }
}
