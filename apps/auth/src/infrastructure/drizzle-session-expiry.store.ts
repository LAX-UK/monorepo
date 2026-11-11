import type { IdentityDatabase } from "@auction/identity-db";
import { session } from "@auction/identity-db/schema";
import type {
  ExpiredSession,
  SessionExpiryStore,
} from "../services/session-expiry-sweep.service.js";
import { endLockedSessions } from "./drizzle-session-ending.js";
import { sessionHasEnded } from "./session-lifetime.sql.js";

export class DrizzleSessionExpiryStore implements SessionExpiryStore {
  constructor(private readonly db: IdentityDatabase) {}

  async endExpired<T>(
    now: Date,
    limit: number,
    beforeDelete: (batch: readonly ExpiredSession[]) => Promise<T>,
  ): Promise<{ ended: number; prepared: T } | null> {
    return this.db.transaction(async (tx) => {
      // No ordering: the records taken here are deleted, so a later run finds the rest.
      const rows = await tx
        .select({ id: session.id, userId: session.userId })
        .from(session)
        .where(sessionHasEnded(now))
        .limit(limit)
        .for("update", { skipLocked: true });
      if (rows.length === 0) return null;
      return endLockedSessions(tx, rows, beforeDelete);
    });
  }
}
