import type { Database } from "@auction/db";
import { shopUserProfile } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { PendingDeletionReader } from "../application/ports/pending-deletion.reader.js";

/** Reads the deletion request Shop mirrors from Identity; one primary-key lookup. */
export function createDrizzlePendingDeletionReader(db: Database): PendingDeletionReader {
  return {
    async requestedAt(identitySubjectId) {
      const [row] = await db
        .select({ requestedAt: shopUserProfile.deletionRequestedAt })
        .from(shopUserProfile)
        .where(eq(shopUserProfile.identitySubjectId, identitySubjectId))
        .limit(1);
      return row?.requestedAt ?? null;
    },
  };
}
