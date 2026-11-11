import type { IdentityDatabase } from "@auction/identity-db";
import { session, sessionLineage } from "@auction/identity-db/schema";
import { asc, inArray, lte } from "drizzle-orm";
import type {
  ExpiredSession,
  SessionExpiryStore,
} from "../services/session-expiry-sweep.service.js";
import { deleteTokensIssuedUnder } from "./drizzle-oauth-token-sign-in.store.js";

export class DrizzleSessionExpiryStore implements SessionExpiryStore {
  constructor(private readonly db: IdentityDatabase) {}

  async endExpired<T>(
    now: Date,
    limit: number,
    beforeDelete: (batch: readonly ExpiredSession[]) => Promise<T>,
  ): Promise<{ ended: number; prepared: T } | null> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select({ id: session.id, userId: session.userId })
        .from(session)
        .where(lte(session.expiresAt, now))
        .orderBy(asc(session.expiresAt), asc(session.id))
        .limit(limit)
        .for("update", { skipLocked: true });
      if (rows.length === 0) return null;
      const ids = rows.map((row) => row.id);
      const lineage = await tx
        .select({ previousSid: sessionLineage.previousSid, sessionId: sessionLineage.sessionId })
        .from(sessionLineage)
        .where(inArray(sessionLineage.sessionId, ids));
      const batch = rows.map((row) => ({
        ...row,
        previousSids: lineage
          .filter((entry) => entry.sessionId === row.id)
          .map((entry) => entry.previousSid),
      }));
      const prepared = await beforeDelete(batch);
      await tx.delete(session).where(inArray(session.id, ids));
      for (const entry of batch) {
        await deleteTokensIssuedUnder(tx, entry.userId, [entry.id, ...entry.previousSids]);
      }
      return { ended: batch.length, prepared };
    });
  }
}
