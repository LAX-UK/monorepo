import type { IdentityDatabase } from "@auction/identity-db";
import { oidcRpSession, session, sessionLineage } from "@auction/identity-db/schema";
import { and, desc, eq, gt, inArray, ne, or } from "drizzle-orm";
import type {
  NewSession,
  SessionSnapshot,
  SessionTakeoverStore,
  TakeoverWrite,
} from "../services/session-takeover.service.js";

export class DrizzleSessionTakeoverStore implements SessionTakeoverStore {
  constructor(private readonly db: IdentityDatabase) {}

  async findSession(sessionId: string): Promise<NewSession | null> {
    const [row] = await this.db
      .select({ id: session.id, userId: session.userId, createdAt: session.createdAt })
      .from(session)
      .where(eq(session.id, sessionId))
      .limit(1);
    return row ?? null;
  }

  async findLive(input: {
    userId: string;
    previousSessionId: string | null;
    deviceHash: string | null;
    excludeId: string;
    now: Date;
  }): Promise<SessionSnapshot[]> {
    const matches = [
      input.previousSessionId ? eq(session.id, input.previousSessionId) : undefined,
      input.deviceHash
        ? and(eq(session.deviceHash, input.deviceHash), eq(session.userId, input.userId))
        : undefined,
    ].filter((match) => match !== undefined);
    if (matches.length === 0) return [];
    const rows = await this.db
      .select({
        id: session.id,
        userId: session.userId,
        createdAt: session.createdAt,
        signedInAt: session.signedInAt,
      })
      .from(session)
      .where(
        and(gt(session.expiresAt, input.now), ne(session.id, input.excludeId), or(...matches)),
      );
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
      id: row.id,
      userId: row.userId,
      signedInAt: row.signedInAt ?? row.createdAt,
      previousSids: lineage
        .filter((entry) => entry.sessionId === row.id)
        .map((entry) => entry.previousSid),
    }));
  }

  async replace(write: TakeoverWrite): Promise<void> {
    const replacedIds = write.sameSubject.map((old) => old.id);
    const endedIds = write.otherSubject.map((old) => old.id);
    await this.db.transaction(async (tx) => {
      if (replacedIds.length > 0) {
        // Names the old records already stood for now point at the new one, and the products
        // that signed in through an old record are re-bound to it before the old row goes (its
        // foreign key would otherwise clear them).
        await tx
          .update(sessionLineage)
          .set({ sessionId: write.newSessionId })
          .where(inArray(sessionLineage.sessionId, replacedIds));
        await tx
          .insert(sessionLineage)
          .values(
            replacedIds.map((previousSid) => ({
              previousSid,
              sessionId: write.newSessionId,
              userId: write.userId,
              createdAt: write.now,
            })),
          )
          .onConflictDoUpdate({
            target: sessionLineage.previousSid,
            set: { sessionId: write.newSessionId, userId: write.userId },
          });
        await tx
          .update(oidcRpSession)
          .set({ identitySessionId: write.newSessionId })
          .where(inArray(oidcRpSession.identitySessionId, replacedIds));
      }
      const gone = [...replacedIds, ...endedIds];
      if (gone.length > 0) await tx.delete(session).where(inArray(session.id, gone));
      await tx
        .update(session)
        .set({
          deviceHash: write.deviceHash,
          signedInAt: write.signedInAt,
          lastSeenAt: write.now,
          country: write.country,
        })
        .where(eq(session.id, write.newSessionId));
      await tx
        .delete(sessionLineage)
        .where(
          and(
            eq(sessionLineage.sessionId, write.newSessionId),
            inArray(
              sessionLineage.previousSid,
              tx
                .select({ previousSid: sessionLineage.previousSid })
                .from(sessionLineage)
                .where(eq(sessionLineage.sessionId, write.newSessionId))
                .orderBy(desc(sessionLineage.createdAt), desc(sessionLineage.previousSid))
                .offset(write.maxLineage),
            ),
          ),
        );
    });
  }
}
