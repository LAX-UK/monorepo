import { eq, lt } from "drizzle-orm";
import { user, verification } from "../schema/auth.js";
import type { IdentityDatabase } from "./drizzle-consent-store.js";

export function createDrizzlePhoneNumberStore(db: IdentityDatabase) {
  return {
    async purgeExpiredVerifications() {
      const now = new Date();
      await db.delete(verification).where(lt(verification.expiresAt, now));
    },
    async findPhoneNumber(userId: string) {
      const userRow = await db.query.user.findFirst({
        where: (u, { eq: eqFn }) => eqFn(u.id, userId),
        columns: { phoneNumber: true },
      });
      return userRow?.phoneNumber ?? null;
    },
    async resetPhoneVerifiedIfNumberChanged(
      userId: string,
      previousPhone: string | null | undefined,
      nextPhone: string | null | undefined,
    ) {
      const prev = previousPhone?.trim() ?? null;
      const next = nextPhone?.trim() ?? null;
      if (prev === next) return;
      await db
        .update(user)
        .set({ phoneNumberVerified: false, updatedAt: new Date() })
        .where(eq(user.id, userId));
    },
  };
}
