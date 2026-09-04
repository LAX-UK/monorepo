import { count, eq } from "drizzle-orm";
import { session } from "../schema/auth.js";
import type { IdentityDatabase } from "./drizzle-consent-store.js";

export function createDrizzleSessionCountReader(db: IdentityDatabase) {
  return {
    async countSessionsForUser(userId: string) {
      const countResult = await db
        .select({ value: count() })
        .from(session)
        .where(eq(session.userId, userId));
      return countResult[0]?.value ?? 0;
    },
  };
}
