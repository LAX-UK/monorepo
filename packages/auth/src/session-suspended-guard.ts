import type { Database } from "@auction/db";
import { APIError } from "better-auth/api";

/** Rejects session creation when the global Identity account is disabled or retired. */
export async function assertUserNotSuspendedForSession(
  db: Database,
  userId: string,
): Promise<void> {
  const userRow = await db.query.user.findFirst({
    where: (u, { eq: eqFn }) => eqFn(u.id, userId),
    columns: { identityDisabledAt: true, mergedIntoSubjectId: true },
  });
  if (userRow?.identityDisabledAt != null || userRow?.mergedIntoSubjectId != null) {
    throw new APIError("FORBIDDEN", {
      message: "Identity account disabled",
      code: "IDENTITY_DISABLED",
    });
  }
}
