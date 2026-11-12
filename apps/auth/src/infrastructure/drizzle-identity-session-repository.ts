import type { IdentityDatabase } from "@auction/identity-db";
import { oauthAccessToken, session, sessionLineage } from "@auction/identity-db/schema";
import { and, desc, eq, gt, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import type {
  IIdentitySessionRepository,
  IdentityOperationTransaction,
  IdentitySessionRecord,
} from "../services/identity-operations.ports.js";
import { identityOperationDb } from "./drizzle-identity-unit-of-work.js";
import { retireRevokedBrowserMarkers } from "./drizzle-known-device.store.js";
import {
  lastActiveAtColumn,
  sessionPersonIsStaff,
  signedInAtColumn,
} from "./session-lifetime.sql.js";

export class DrizzleIdentitySessionRepository implements IIdentitySessionRepository {
  constructor(
    private readonly db: IdentityDatabase,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async listForSubject(
    subjectId: string,
    currentSessionToken?: string,
  ): Promise<IdentitySessionRecord[]> {
    const rows = await this.db
      .select({
        id: session.id,
        token: session.token,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        lastPasswordAuthAt: session.lastPasswordAuthAt,
        lastActiveAt: sql<Date>`${lastActiveAtColumn}`.mapWith(session.createdAt),
        signedInAt: sql<Date>`${signedInAtColumn}`.mapWith(session.createdAt),
        isStaff: sql<boolean>`${sessionPersonIsStaff}`,
        amr: session.amr,
        country: session.country,
      })
      .from(session)
      .where(eq(session.userId, subjectId))
      .orderBy(desc(session.createdAt));
    const lineage = await this.db
      .select({ previousSid: sessionLineage.previousSid, sessionId: sessionLineage.sessionId })
      .from(sessionLineage)
      .where(eq(sessionLineage.userId, subjectId));
    const clientsBySid = await this.liveClientsBySid(subjectId);
    return rows.map(({ token, ...row }) => {
      const previousIds = lineage
        .filter((entry) => entry.sessionId === row.id)
        .map((entry) => entry.previousSid);
      return {
        ...row,
        previousIds,
        clientIds: [
          ...new Set([row.id, ...previousIds].flatMap((sid) => clientsBySid.get(sid) ?? [])),
        ],
        isCurrent: Boolean(currentSessionToken) && token === currentSessionToken,
      };
    });
  }

  /**
   * The OAuth clients holding live tokens for each sign-in id, for the person's own tokens. Live
   * means the refresh token is unexpired and has not been rotated out: rotation keeps the
   * predecessor with `refresh_consumed_at` set, and introspection already treats it as inactive.
   * Revoked tokens are deleted, so they never reach this query.
   */
  private async liveClientsBySid(subjectId: string): Promise<Map<string, string[]>> {
    const tokens = await this.db
      .selectDistinct({ sid: oauthAccessToken.sid, clientId: oauthAccessToken.clientId })
      .from(oauthAccessToken)
      .where(
        and(
          eq(oauthAccessToken.userId, subjectId),
          isNotNull(oauthAccessToken.sid),
          gt(oauthAccessToken.refreshTokenExpiresAt, sql`now()`),
          isNull(oauthAccessToken.refreshConsumedAt),
        ),
      );
    const bySid = new Map<string, string[]>();
    for (const { sid, clientId } of tokens) {
      if (sid) bySid.set(sid, [...(bySid.get(sid) ?? []), clientId]);
    }
    return bySid;
  }

  async findStamp(
    subjectId: string,
    sessionToken: string,
  ): Promise<{ lastPasswordAuthAt: Date | null } | null> {
    const [row] = await this.db
      .select({ lastPasswordAuthAt: session.lastPasswordAuthAt })
      .from(session)
      .where(
        and(
          eq(session.userId, subjectId),
          or(eq(session.token, sessionToken), eq(session.id, sessionToken)),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async stampPasswordAuth(
    transaction: IdentityOperationTransaction | null,
    input: { subjectId: string; sessionToken: string; now: Date; stepUp: boolean },
  ): Promise<boolean> {
    const db = identityOperationDb(this.db, transaction);
    const rows = await db
      .update(session)
      .set({
        lastPasswordAuthAt: input.now,
        ...(input.stepUp ? { lastStepUpAt: input.now } : {}),
        updatedAt: input.now,
      })
      .where(
        and(
          eq(session.userId, input.subjectId),
          or(eq(session.token, input.sessionToken), eq(session.id, input.sessionToken)),
        ),
      )
      .returning({ id: session.id });
    return Boolean(rows[0]);
  }

  async ownsSession(subjectId: string, sessionId: string): Promise<boolean> {
    const [owned] = await this.db
      .select({ id: session.id })
      .from(session)
      .where(and(eq(session.userId, subjectId), eq(session.id, sessionId)))
      .limit(1);
    return Boolean(owned);
  }

  async deleteSession(
    transaction: IdentityOperationTransaction,
    subjectId: string,
    sessionId: string,
  ): Promise<boolean> {
    const tx = identityOperationDb(this.db, transaction);
    const deleted = await tx
      .delete(session)
      .where(and(eq(session.userId, subjectId), eq(session.id, sessionId)))
      .returning({ id: session.id, deviceHash: session.deviceHash });
    await this.retireMarkers(tx, subjectId, deleted);
    return deleted.length > 0;
  }

  async deleteAllSessions(
    transaction: IdentityOperationTransaction,
    subjectId: string,
    exceptSessionToken?: string,
  ): Promise<number> {
    const tx = identityOperationDb(this.db, transaction);
    const where = exceptSessionToken
      ? and(eq(session.userId, subjectId), ne(session.token, exceptSessionToken))
      : eq(session.userId, subjectId);
    const deleted = await tx
      .delete(session)
      .where(where)
      .returning({ id: session.id, deviceHash: session.deviceHash });
    await this.retireMarkers(tx, subjectId, deleted);
    return deleted.length;
  }

  async deleteOtherSessions(
    transaction: IdentityOperationTransaction,
    subjectId: string,
    keepSessionId: string,
  ): Promise<string[]> {
    const tx = identityOperationDb(this.db, transaction);
    const deleted = await tx
      .delete(session)
      .where(and(eq(session.userId, subjectId), ne(session.id, keepSessionId)))
      .returning({ id: session.id, deviceHash: session.deviceHash });
    await this.retireMarkers(tx, subjectId, deleted);
    return deleted.map((row) => row.id);
  }

  /** Browsers signed out here stop being known and owe a new sign-in email (see retireRevokedBrowserMarkers). */
  private retireMarkers(
    tx: Pick<IdentityDatabase, "delete" | "insert">,
    subjectId: string,
    deleted: readonly { deviceHash: string | null }[],
  ): Promise<void> {
    return retireRevokedBrowserMarkers(tx, {
      userId: subjectId,
      deviceHashes: deleted.map((row) => row.deviceHash),
      at: this.now(),
    });
  }

  async purgeSubjectSessionsAndTokens(
    transaction: IdentityOperationTransaction | null,
    subjectId: string,
  ): Promise<void> {
    const db = identityOperationDb(this.db, transaction);
    await db.delete(session).where(eq(session.userId, subjectId));
    await db.delete(oauthAccessToken).where(eq(oauthAccessToken.userId, subjectId));
  }
}
