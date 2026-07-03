import { session as sessionTable } from "@auction/db/schema";
import { count, eq } from "drizzle-orm";
import { assertUserNotSuspendedForSession } from "../session-suspended-guard.js";
import type { AuthHookDeps } from "./auth-hook-deps.js";

export function buildSessionDatabaseHooks(deps: AuthHookDeps) {
  return {
    create: {
      before: async (sess: { userId: string }) => {
        await assertUserNotSuspendedForSession(deps.db, sess.userId);
      },
      after: async (sess: {
        userId: string;
        createdAt: Date;
        userAgent?: string | null | undefined;
      }) => {
        if (!deps.enableNewDeviceLoginEmail) return;
        // Count all sessions for this user (the new one is already committed).
        // If count === 1 this is the very first session — the user just registered.
        // Don't send a "new device login" email in that case; they already receive
        // a welcome / email-verification email and the duplicate is confusing.
        const countResult = await deps.db
          .select({ value: count() })
          .from(sessionTable)
          .where(eq(sessionTable.userId, sess.userId));
        const sessionCount = countResult[0]?.value ?? 0;
        if (sessionCount <= 1) return;
        const userRow = await deps.db.query.user.findFirst({
          where: (u, { eq }) => eq(u.id, sess.userId),
          columns: { email: true, name: true },
        });
        if (!userRow) return;
        const when = new Date(sess.createdAt);
        deps.email
          ?.enqueue({
            template: "new-device-login",
            to: userRow.email,
            userId: sess.userId,
            category: "auth",
            vars: {
              userName: userRow.name,
              whenDisplay: when.toUTCString(),
              deviceSummary: sess.userAgent ?? null,
            },
          })
          .catch((err: unknown) => {
            console.error("[auth] enqueue new-device-login failed", {
              userId: sess.userId,
              error: err instanceof Error ? err.message : String(err),
            });
          });
      },
    },
  };
}
