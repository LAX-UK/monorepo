import type { ProductSubjectUsageProbe } from "@auction/auth";
import type { Database } from "@auction/db";
import { bidUserProfile, externalAccount } from "@auction/db/schema";
import { eq } from "drizzle-orm";

// Last intentional cross-boundary read in apps/auth. Keep this adapter on the
// product database handle until Identity boundary exit criterion 5 is complete.
export function createDrizzleProductSubjectUsageProbe(db: Database): ProductSubjectUsageProbe {
  return {
    async hasProductProfile(subjectId) {
      const [row] = await db
        .select({ userId: bidUserProfile.userId })
        .from(bidUserProfile)
        .where(eq(bidUserProfile.userId, subjectId))
        .limit(1);
      return Boolean(row);
    },
    async hasExternalLink(subjectId) {
      const [row] = await db
        .select({ id: externalAccount.id })
        .from(externalAccount)
        .where(eq(externalAccount.userId, subjectId))
        .limit(1);
      return Boolean(row);
    },
  };
}
