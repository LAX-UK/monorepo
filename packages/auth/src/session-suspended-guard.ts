import type { Database } from "@auction/db";
import { APIError } from "better-auth/api";

/** Rejects session creation when the user account is suspended. */
export async function assertUserNotSuspendedForSession(
  db: Database,
  userId: string,
): Promise<void> {
  const userRow = await db.query.user.findFirst({
    where: (u, { eq: eqFn }) => eqFn(u.id, userId),
    columns: { suspendedAt: true },
  });
  if (userRow?.suspendedAt != null) {
    throw new APIError("FORBIDDEN", {
      message: "Account suspended",
      code: "ACCOUNT_SUSPENDED",
    });
  }
}
