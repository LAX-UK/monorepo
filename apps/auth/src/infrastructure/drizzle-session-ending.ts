import type { IdentityDatabase } from "@auction/identity-db";
import { session, sessionLineage } from "@auction/identity-db/schema";
import { inArray } from "drizzle-orm";
import type { ExpiredSession } from "../services/session-expiry-sweep.service.js";
import { deleteTokensIssuedUnder } from "./drizzle-oauth-token-sign-in.store.js";

export type Transaction = Parameters<Parameters<IdentityDatabase["transaction"]>[0]>[0];

/**
 * Ends records the caller already holds row locks on: reads the earlier ids each stands for, lets
 * `beforeDelete` make the sign-out durable, then deletes the records (and so their earlier ids)
 * and the OAuth tokens issued under them, all in the caller's transaction. When `beforeDelete`
 * throws nothing is deleted.
 */
export async function endLockedSessions<T>(
  tx: Transaction,
  rows: readonly { id: string; userId: string }[],
  beforeDelete: (batch: readonly ExpiredSession[]) => Promise<T>,
): Promise<{ ended: number; prepared: T }> {
  const ids = rows.map((row) => row.id);
  const lineage = await tx
    .select({ previousSid: sessionLineage.previousSid, sessionId: sessionLineage.sessionId })
    .from(sessionLineage)
    .where(inArray(sessionLineage.sessionId, ids));
  const batch = rows.map((row) => ({
    id: row.id,
    userId: row.userId,
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
}
