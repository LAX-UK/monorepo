import type { Database } from "@auction/db";
import { session } from "@auction/db/schema";
import { and, desc, eq, ne } from "drizzle-orm";

/** Deletes Better Auth `session` rows (auth DB). Used after password reset / email change / suspension. */
export class SessionRevocationService {
  constructor(private readonly authDb: Database) {}

  async revokeAllForUser(userId: string): Promise<number> {
    const rows = await this.authDb
      .delete(session)
      .where(eq(session.userId, userId))
      .returning({ id: session.id });
    return rows.length;
  }

  /** Revoke all sessions except the current one (e.g. after email change while keeping this browser signed in). */
  async revokeAllForUserExcept(userId: string, exceptSessionId: string): Promise<void> {
    await this.authDb
      .delete(session)
      .where(and(eq(session.userId, userId), ne(session.id, exceptSessionId)));
  }

  async listForUser(userId: string): Promise<
    {
      id: string;
      token: string;
      createdAt: Date;
      expiresAt: Date;
      ipAddress: string | null;
      userAgent: string | null;
      lastPasswordAuthAt: Date | null;
    }[]
  > {
    return this.authDb
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
      .where(eq(session.userId, userId))
      .orderBy(desc(session.createdAt));
  }

  async deleteSessionForUser(userId: string, sessionId: string): Promise<boolean> {
    const rows = await this.authDb
      .delete(session)
      .where(and(eq(session.userId, userId), eq(session.id, sessionId)))
      .returning({ id: session.id });
    return rows.length > 0;
  }

  async getSessionIdForCookieToken(userId: string, token: string): Promise<string | null> {
    const [row] = await this.authDb
      .select({ id: session.id })
      .from(session)
      .where(and(eq(session.userId, userId), eq(session.token, token)))
      .limit(1);
    return row?.id ?? null;
  }
}
