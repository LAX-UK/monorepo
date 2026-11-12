import type { IdentityDatabase } from "@auction/identity-db";
import { session } from "@auction/identity-db/schema";
import { eq, sql } from "drizzle-orm";
import { clampExpiry } from "../services/session-lifetime-policy.js";
import {
  lastActiveAtColumn,
  sessionPersonIsStaff,
  signedInAtColumn,
} from "./session-lifetime.sql.js";

/**
 * Holds a session's `expires_at` to the person's idle and absolute limits (the policy in
 * `session-lifetime-policy.ts`), so Better Auth's own expiry check, and with it `getSession` and
 * `/oauth2/authorize`, refuse a record that is over without waiting for the sweep.
 */
export class DrizzleSessionExpiryClamp {
  constructor(
    private readonly db: IdentityDatabase,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async clamp(input: { userId: string; sessionId: string | null; expiresAt: Date }): Promise<Date> {
    const now = this.now();
    const [row] = input.sessionId
      ? await this.db
          .select({
            userId: session.userId,
            lastActiveAt: sql<string>`${lastActiveAtColumn}`,
            signedInAt: sql<string>`${signedInAtColumn}`,
            isStaff: sql<boolean>`${sessionPersonIsStaff}`,
          })
          .from(session)
          .where(eq(session.id, input.sessionId))
          .limit(1)
      : [];
    if (row) {
      return clampExpiry(
        input.expiresAt,
        { lastActiveAt: new Date(row.lastActiveAt), signedInAt: new Date(row.signedInAt) },
        row.isStaff,
      );
    }
    // A session being created starts its clocks now.
    const { rows } = await this.db.execute<{ is_staff: boolean }>(
      sql`SELECT EXISTS (
        SELECT 1 FROM "identity_access_marker" AS marker
        WHERE marker."subject_id" = ${input.userId}
          AND marker."kind" = 'staff' AND marker."product" IN ('bid', 'shop')) AS is_staff`,
    );
    return clampExpiry(
      input.expiresAt,
      { lastActiveAt: now, signedInAt: now },
      rows[0]?.is_staff === true,
    );
  }
}
