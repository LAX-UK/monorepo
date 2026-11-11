import type { IdentityDatabase } from "@auction/identity-db";
import { session } from "@auction/identity-db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { SessionActivityStore } from "../services/session-activity.service.js";
import { sessionIsLive } from "./session-lifetime.sql.js";

export class DrizzleSessionActivityStore implements SessionActivityStore {
  constructor(private readonly db: IdentityDatabase) {}

  async touch(sessionId: string, now: Date, throttleMs: number): Promise<boolean> {
    const written = await this.db
      .update(session)
      .set({ lastSeenAt: now })
      .where(
        and(
          eq(session.id, sessionId),
          // One write per throttle window per record, decided by the database so that instances
          // racing each other still write once. The comparison is on the stored value.
          sql`(${session.lastSeenAt} IS NULL OR ${session.lastSeenAt} <= ${new Date(now.getTime() - throttleMs).toISOString()}::timestamptz)`,
          // A record that is already over is never brought back by being used.
          sessionIsLive(now),
        ),
      )
      .returning({ id: session.id });
    return written.length > 0;
  }
}
