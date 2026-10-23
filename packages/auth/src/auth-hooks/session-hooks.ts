import { assertUserNotSuspendedForSession } from "../session-suspended-guard.js";
import type { AuthHookDeps } from "./auth-hook-deps.js";

/** Edge headers that carry a country code; a coarse signal, never an address. */
const REGION_HEADERS = ["cf-ipcountry", "x-vercel-ip-country"] as const;

export function buildSessionDatabaseHooks(deps: AuthHookDeps) {
  return {
    create: {
      before: async (sess: { userId: string }) => {
        await assertUserNotSuspendedForSession(deps.ports.subjectStatusReader, sess.userId);
      },
      after: async (
        sess: {
          userId: string;
          createdAt: Date;
          userAgent?: string | null | undefined;
        },
        context?: { request?: { headers: Headers } | undefined } | null,
      ) => {
        if (!deps.enableNewDeviceLoginEmail) return;
        const headers = context?.request?.headers;
        void deps.ports.securityNotices?.notify({
          kind: "sign_in",
          userId: sess.userId,
          at: new Date(sess.createdAt),
          userAgent: sess.userAgent ?? headers?.get("user-agent") ?? null,
          region: REGION_HEADERS.map((name) => headers?.get(name)?.trim()).find(Boolean) ?? null,
        });
      },
    },
  };
}
