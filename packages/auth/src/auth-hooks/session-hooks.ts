import { assertUserNotSuspendedForSession } from "../session-suspended-guard.js";
import type { AuthHookDeps } from "./auth-hook-deps.js";

export function buildSessionDatabaseHooks(deps: AuthHookDeps) {
  return {
    create: {
      before: async (sess: { userId: string }) => {
        await assertUserNotSuspendedForSession(deps.ports.subjectStatusReader, sess.userId);
      },
      after: async (sess: {
        userId: string;
        createdAt: Date;
        userAgent?: string | null | undefined;
      }) => {
        if (!deps.enableNewDeviceLoginEmail) return;
        const sessionCount = await deps.ports.sessionCountReader.countSessionsForUser(sess.userId);
        if (sessionCount <= 1) return;
        const userRow = await deps.ports.accountLinkReader.findUserEmailProfile(sess.userId);
        if (!userRow) return;
        const when = new Date(sess.createdAt);
        deps.ports.email
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
