import type { IdentityDatabase } from "@auction/identity-db";
import {
  oauthAccessToken,
  oidcRpSession,
  session,
  sessionLineage,
} from "@auction/identity-db/schema";
import { and, asc, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import type {
  NewSession,
  SessionSnapshot,
  SessionTakeoverStore,
  TakeoverWrite,
} from "../services/session-takeover.service.js";
import { clampedExpiresAt, sessionIsLive } from "./session-lifetime.sql.js";

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
    // The same person's records count only while they are still signed in: one that is over its
    // idle or absolute limit but not yet swept is neither carried (its `signed_in_at` would end the
    // new sign-in on arrival), nor renewed, nor are its earlier ids and product sessions re-bound.
    // Another person's record named by this request's own session cookie is ended with a
    // back-channel logout whatever state it is in: it is still that person's sign-in in this browser.
    const matches = [
      input.previousSessionId
        ? or(
            and(eq(session.id, input.previousSessionId), ne(session.userId, input.userId)),
            and(
              eq(session.id, input.previousSessionId),
              eq(session.userId, input.userId),
              sessionIsLive(input.now),
            ),
          )
        : undefined,
      input.deviceHash
        ? and(
            eq(session.deviceHash, input.deviceHash),
            eq(session.userId, input.userId),
            sessionIsLive(input.now),
          )
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
      .where(and(ne(session.id, input.excludeId), or(...matches)));
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
      // Locked in id order, the same order the cap takes a person's records in, so a sign-in and
      // a cap check of the same person queue up instead of deadlocking.
      await tx
        .select({ id: session.id })
        .from(session)
        .where(inArray(session.id, [...replacedIds, ...endedIds, write.newSessionId]))
        .orderBy(asc(session.id))
        .for("update");
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
          // The carried first sign-in time shortens the record's life: it never outlives the
          // person's absolute limit, so the issuer's own expiry check enforces it.
          expiresAt: clampedExpiresAt(sql`${session.expiresAt}`, write.signedInAt, write.now),
        })
        .where(eq(session.id, write.newSessionId));
      const evicted = (
        await tx
          .select({ previousSid: sessionLineage.previousSid })
          .from(sessionLineage)
          .where(eq(sessionLineage.sessionId, write.newSessionId))
          .orderBy(desc(sessionLineage.createdAt), desc(sessionLineage.previousSid))
          .offset(write.maxLineage)
      ).map((row) => row.previousSid);
      if (evicted.length === 0) return;
      // Tokens issued under a name that falls off the list move to the record itself, so a
      // sign-out of the record still finds them and their refresh still resolves to it.
      await tx
        .update(oauthAccessToken)
        .set({ sid: write.newSessionId })
        .where(
          and(eq(oauthAccessToken.userId, write.userId), inArray(oauthAccessToken.sid, evicted)),
        );
      await tx
        .delete(sessionLineage)
        .where(
          and(
            eq(sessionLineage.sessionId, write.newSessionId),
            inArray(sessionLineage.previousSid, evicted),
          ),
        );
    });
  }
}
