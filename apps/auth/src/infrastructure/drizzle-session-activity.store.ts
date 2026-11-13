import type { IdentityDatabase } from "@auction/identity-db";
import { session } from "@auction/identity-db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { SessionActivityStore } from "../services/session-activity.service.js";
import { SESSION_LIFETIME_POLICY } from "../services/session-lifetime-policy.js";
import { clampedExpiresAt, sessionIsLive, signedInAtColumn } from "./session-lifetime.sql.js";

export class DrizzleSessionActivityStore implements SessionActivityStore {
  /**
   * `renewalMs` is how far ahead Better Auth keeps a record on use (its `session.expiresIn`).
   * `expires_at` follows use by that much but never past the person's idle or absolute limit.
   */
  constructor(
    private readonly db: IdentityDatabase,
    private readonly renewalMs: number = SESSION_LIFETIME_POLICY.client.idleMs,
  ) {}

  async touch(sessionId: string, now: Date, throttleMs: number): Promise<boolean> {
    const usedAt = sql`LEAST(${now.toISOString()}::timestamptz, clock_timestamp())`;
    const written = await this.db
      .update(session)
      // Never later than the database's own clock, so an instance whose clock runs ahead cannot
      // push idleness into the future or suppress other instances' writes.
      .set({
        lastSeenAt: usedAt,
        // Idle is counted from last use, so a person working only through products (which refresh
        // tokens here without visiting the issuer) is not signed out 12 hours after their last
        // issuer visit. It moves forward with use, and is always held to the person's idle and
        // absolute limits (it fails closed), which also trims a record written before they applied.
        expiresAt: clampedExpiresAt(
          sql`GREATEST(${session.expiresAt}, ${usedAt} + make_interval(secs => ${this.renewalMs / 1000}::double precision))`,
          signedInAtColumn,
          usedAt,
        ),
      })
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
