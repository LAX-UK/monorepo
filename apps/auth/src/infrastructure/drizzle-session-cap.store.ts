import type { IdentityDatabase } from "@auction/identity-db";
import { session } from "@auction/identity-db/schema";
import { asc, eq, sql } from "drizzle-orm";
import type { SessionCapStore } from "../services/session-cap.service.js";
import type { ExpiredSession } from "../services/session-expiry-sweep.service.js";
import { endLockedSessions } from "./drizzle-session-ending.js";
import { sessionPersonIsStaff } from "./session-lifetime.sql.js";

export class DrizzleSessionCapStore implements SessionCapStore {
  constructor(private readonly db: IdentityDatabase) {}

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
