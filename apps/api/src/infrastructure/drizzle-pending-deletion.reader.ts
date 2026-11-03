import type { Database } from "@auction/db";
import { bidIdentityDirectory } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { IPendingDeletionReader } from "../services/interfaces/pending-deletion-reader.js";

/** Reads the deletion request Bid already mirrors from Identity; one primary-key lookup. */
export class DrizzlePendingDeletionReader implements IPendingDeletionReader {
  constructor(private readonly db: Database) {}

  async requestedAt(userId: string): Promise<Date | null> {
    const [row] = await this.db
      .select({ requestedAt: bidIdentityDirectory.deletionRequestedAt })
      .from(bidIdentityDirectory)
      .where(eq(bidIdentityDirectory.subjectId, userId))
      .limit(1);
    return row?.requestedAt ?? null;
  }
}
