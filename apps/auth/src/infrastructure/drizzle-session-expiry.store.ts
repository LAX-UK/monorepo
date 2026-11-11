import type { IdentityDatabase } from "@auction/identity-db";
import { session, sessionLineage } from "@auction/identity-db/schema";
import { and, asc, inArray, lte } from "drizzle-orm";
import type {
  ExpiredSession,
  SessionExpiryStore,
} from "../services/session-expiry-sweep.service.js";
import { deleteTokensIssuedUnder } from "./drizzle-oauth-token-sign-in.store.js";

export class DrizzleSessionExpiryStore implements SessionExpiryStore {
  constructor(private readonly db: IdentityDatabase) {}

  async findExpired(now: Date, limit: number): Promise<ExpiredSession[]> {
    const rows = await this.db
      .select({ id: session.id, userId: session.userId })
      .from(session)
      .where(lte(session.expiresAt, now))
      .orderBy(asc(session.expiresAt), asc(session.id))
      .limit(limit);
    if (rows.length === 0) return [];
    const lineage = await this.db
      .select({ previousSid: sessionLineage.previousSid, sessionId: sessionLineage.sessionId })
      .from(sessionLineage)
      .where(
        inArray(
          sessionLineage.sessionId,
          rows.map((row) => row.id),
        ),
      );
    return rows.map((row) => ({
      ...row,
      previousSids: lineage
        .filter((entry) => entry.sessionId === row.id)
        .map((entry) => entry.previousSid),
    }));
  }

  async deleteExpired(sessions: readonly ExpiredSession[], now: Date): Promise<ExpiredSession[]> {
    if (sessions.length === 0) return [];
    return this.db.transaction(async (tx) => {
      const gone = await tx
        .delete(session)
        .where(
          and(
            inArray(
              session.id,
              sessions.map((entry) => entry.id),
            ),
            lte(session.expiresAt, now),
          ),
        )
        .returning({ id: session.id });
      const goneIds = new Set(gone.map((row) => row.id));
      const deleted = sessions.filter((entry) => goneIds.has(entry.id));
      for (const entry of deleted) {
        await deleteTokensIssuedUnder(tx, entry.userId, [entry.id, ...entry.previousSids]);
      }
      return deleted;
    });
  }
}
