import type { IdentityDatabase } from "@auction/identity-db";
import { oauthAccessToken, session } from "@auction/identity-db/schema";
import { and, desc, eq, ne, or } from "drizzle-orm";
import type {
  IIdentitySessionRepository,
  IdentityOperationTransaction,
  IdentitySessionRecord,
} from "../services/identity-operations.ports.js";
import { identityOperationDb } from "./drizzle-identity-unit-of-work.js";

export class DrizzleIdentitySessionRepository implements IIdentitySessionRepository {
  constructor(private readonly db: IdentityDatabase) {}

  async listForSubject(
    subjectId: string,
    currentSessionToken?: string,
  ): Promise<IdentitySessionRecord[]> {
    const rows = await this.db
      .select({
        id: session.id,
        token: session.token,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        lastPasswordAuthAt: session.lastPasswordAuthAt,
      })
      .from(session)
      .where(eq(session.userId, subjectId))
      .orderBy(desc(session.createdAt));
    return rows.map(({ token, ...row }) => ({
      ...row,
      isCurrent: Boolean(currentSessionToken) && token === currentSessionToken,
    }));
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
      .returning({ id: session.id });
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
    const deleted = await tx.delete(session).where(where).returning({ id: session.id });
    return deleted.length;
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
