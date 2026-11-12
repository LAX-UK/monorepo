import type { IdentityDatabase } from "@auction/identity-db";
import { session } from "@auction/identity-db/schema";
import { asc, eq, sql } from "drizzle-orm";
import type { SessionCapStore } from "../services/session-cap.service.js";
import type { ExpiredSession } from "../services/session-expiry-sweep.service.js";
import { SESSION_LIFETIME_POLICY } from "../services/session-lifetime-policy.js";
import { endLockedSessions } from "./drizzle-session-ending.js";
import { sessionPersonIsStaff } from "./session-lifetime.sql.js";

export class DrizzleSessionCapStore implements SessionCapStore {
  constructor(private readonly db: IdentityDatabase) {}

  /**
   * People with more records than their cap allows (counting records already over, which the cap
   * ignores, so this errs towards looking). The sweep checks each one properly.
   */
  async findOverCap(limit: number): Promise<string[]> {
    const { client, staff } = SESSION_LIFETIME_POLICY;
    const { rows } = await this.db.execute<{ user_id: string }>(sql`
      SELECT s."user_id" FROM "session" AS s
      GROUP BY s."user_id"
      HAVING count(*) > CASE WHEN EXISTS (
        SELECT 1 FROM "identity_access_marker" AS marker
        WHERE marker."subject_id" = s."user_id"
          AND marker."kind" = 'staff' AND marker."product" IN ('bid', 'shop'))
        THEN ${staff.maxBrowsers}::int ELSE ${client.maxBrowsers}::int END
      LIMIT ${limit}::int`);
    return rows.map((row) => row.user_id);
  }

  async endChosen<T>(
    userId: string,
    choose: Parameters<SessionCapStore["endChosen"]>[1],
    beforeDelete: (batch: readonly ExpiredSession[]) => Promise<T>,
  ): Promise<{ ended: number; prepared: T } | null> {
    return this.db.transaction(async (tx) => {
      // Locked in id order so two sign-ins of one person at once queue up rather than deadlock;
      // the second then sees the first's records and evicts accordingly.
      const rows = await tx
        .select({
          id: session.id,
          expiresAt: session.expiresAt,
          lastSeenAt: session.lastSeenAt,
          updatedAt: session.updatedAt,
          signedInAt: session.signedInAt,
          createdAt: session.createdAt,
          isStaff: sql<boolean>`${sessionPersonIsStaff}`,
        })
        .from(session)
        .where(eq(session.userId, userId))
        .orderBy(asc(session.id))
        .for("update");
      const chosen = new Set(
        choose({
          isStaff: rows.some((row) => row.isStaff),
          sessions: rows.map((row) => ({
            id: row.id,
            expiresAt: row.expiresAt,
            lastActiveAt: row.lastSeenAt ?? row.updatedAt,
            signedInAt: row.signedInAt ?? row.createdAt,
          })),
        }),
      );
      if (chosen.size === 0) return null;
      const ending = rows
        .filter((row) => chosen.has(row.id))
        .map((row) => ({ id: row.id, userId }));
      return endLockedSessions(tx, ending, beforeDelete);
    });
  }
}
