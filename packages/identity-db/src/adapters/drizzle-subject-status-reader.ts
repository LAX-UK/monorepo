import type { IdentityDatabase } from "./drizzle-consent-store.js";

export function createDrizzleSubjectStatusReader(db: IdentityDatabase) {
  return {
    async isDisabledOrMerged(subjectId: string) {
      const userRow = await db.query.user.findFirst({
        where: (u, { eq: eqFn }) => eqFn(u.id, subjectId),
        columns: { identityDisabledAt: true, mergedIntoSubjectId: true },
      });
      return !userRow || userRow.identityDisabledAt != null || userRow.mergedIntoSubjectId != null;
    },
  };
}
