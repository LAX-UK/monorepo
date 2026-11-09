import type { SessionSignInMethod } from "@auction/identity-contracts";
import { eq, sql } from "drizzle-orm";
import { session } from "../schema/auth.js";
import type { IdentityDatabase } from "./drizzle-consent-store.js";

/** The session's `amr` with `method` added once, however often the session is stamped. */
function withMethod(method: SessionSignInMethod) {
  return sql`CASE WHEN ${method} = ANY(${session.amr}) THEN ${session.amr} ELSE array_append(${session.amr}, ${method}) END`;
}

export function createDrizzleSessionStampStore(db: IdentityDatabase) {
  return {
    /** A password sign-in, which also records that the session was signed in with a password. */
    async stampPasswordAuth(sessionToken: string, at: Date) {
      await db
        .update(session)
        .set({ lastPasswordAuthAt: at, updatedAt: at, amr: withMethod("password") })
        .where(eq(session.token, sessionToken));
    },
    async stampMfaCompleted(sessionToken: string, at: Date) {
      await db
        .update(session)
        .set({ mfaCompletedAt: at, updatedAt: at })
        .where(eq(session.token, sessionToken));
    },
    /** A Google or Apple callback, which records that the session was signed in by a provider. */
    async stampSocialAuth(sessionToken: string, at: Date) {
      await db
        .update(session)
        .set({ socialAuthAt: at, updatedAt: at, amr: withMethod("provider") })
        .where(eq(session.token, sessionToken));
    },
  };
}
