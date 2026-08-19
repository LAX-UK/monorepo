import { count, eq } from "drizzle-orm";
import { account } from "../schema/auth.js";
import type { IdentityDatabase } from "./drizzle-consent-store.js";

export function createDrizzleAccountLinkReader(db: IdentityDatabase) {
  return {
    async countAccountsForUser(userId: string) {
      const countResult = await db
        .select({ value: count() })
        .from(account)
        .where(eq(account.userId, userId));
      return countResult[0]?.value ?? 0;
    },
    async isEmailVerified(userId: string) {
      const userRow = await db.query.user.findFirst({
        where: (u, { eq: eqFn }) => eqFn(u.id, userId),
        columns: { emailVerified: true },
      });
      if (!userRow) return null;
      return userRow.emailVerified === true;
    },
    async findUserEmailProfile(userId: string) {
      const userRow = await db.query.user.findFirst({
        where: (u, { eq: eqFn }) => eqFn(u.id, userId),
        columns: { email: true, name: true, createdAt: true },
      });
      return userRow ?? null;
    },
  };
}
