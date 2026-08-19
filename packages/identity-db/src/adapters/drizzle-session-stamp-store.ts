import { eq } from "drizzle-orm";
import { session } from "../schema/auth.js";
import type { IdentityDatabase } from "./drizzle-consent-store.js";

export function createDrizzleSessionStampStore(db: IdentityDatabase) {
  return {
    async stampPasswordAuth(sessionToken: string, at: Date) {
      await db
        .update(session)
        .set({ lastPasswordAuthAt: at, updatedAt: at })
        .where(eq(session.token, sessionToken));
    },
    async stampMfaCompleted(sessionToken: string, at: Date) {
      await db
        .update(session)
        .set({ mfaCompletedAt: at, updatedAt: at })
        .where(eq(session.token, sessionToken));
    },
  };
}
