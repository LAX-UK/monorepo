import type { IdentityDatabase } from "@auction/identity-db";
import { session } from "@auction/identity-db/schema";
import { and, inArray, notInArray } from "drizzle-orm";
import type {
  ExpiredSession,
  SessionExpiryStore,
} from "../services/session-expiry-sweep.service.js";
import { endLockedSessions } from "./drizzle-session-ending.js";
import { sweepScans } from "./session-lifetime.sql.js";

export class DrizzleSessionExpiryStore implements SessionExpiryStore {
  /**
   * `onlyUsers` limits the sweep to those people's records. The running service leaves it unset; it
   * is for tests that share a database, so one test's sweep never ends another's fixtures.
   */
  constructor(
    private readonly db: IdentityDatabase,
    private readonly onlyUsers?: readonly string[],
  ) {}

  async endExpired<T>(
    now: Date,
    limit: number,
    beforeDelete: (batch: readonly ExpiredSession[]) => Promise<T>,
  ): Promise<{ ended: number; prepared: T } | null> {
    return this.db.transaction(async (tx) => {
      // Each scan is selective on its own (see `sweepScans`); no ordering, since the records taken
      // here are deleted and a later run finds the rest.
      const rows: { id: string; userId: string }[] = [];
      for (const scan of sweepScans(now)) {
        if (rows.length >= limit) break;
        const taken = await tx
          .select({ id: session.id, userId: session.userId })
          .from(session)
          .where(
            and(
              scan,
              this.onlyUsers ? inArray(session.userId, [...this.onlyUsers]) : undefined,
              notInArray(session.id, rows.length > 0 ? rows.map((r) => r.id) : [""]),
            ),
          )
          .limit(limit - rows.length)
          .for("update", { skipLocked: true });
        rows.push(...taken);
      }
      if (rows.length === 0) return null;
      return endLockedSessions(tx, rows, beforeDelete);
    });
  }
}
