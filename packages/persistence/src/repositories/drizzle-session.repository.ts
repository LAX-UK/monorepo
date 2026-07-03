import type { Database } from "@auction/db";
import { session } from "@auction/db/schema";
import { and, desc, eq, ne } from "drizzle-orm";
import type { ISessionRepository } from "../interfaces/session.repository.js";
import type { AuthSessionListRow } from "../interfaces/session.types.js";

export class DrizzleSessionRepository implements ISessionRepository {
  constructor(private readonly authDb: Database) {}

  async deleteAllForUser(userId: string): Promise<number> {
    const rows = await this.authDb
      .delete(session)
      .where(eq(session.userId, userId))
      .returning({ id: session.id });
    return rows.length;
  }

  async deleteAllForUserExcept(userId: string, exceptSessionId: string): Promise<void> {
    await this.authDb
      .delete(session)
      .where(and(eq(session.userId, userId), ne(session.id, exceptSessionId)));
  }

  async listForUser(userId: string): Promise<AuthSessionListRow[]> {
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
