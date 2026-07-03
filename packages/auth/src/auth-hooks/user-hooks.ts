import { resetPhoneVerifiedIfNumberChanged } from "../phone-number-plugin.js";
import type { AuthHookDeps } from "./auth-hook-deps.js";

export function buildUserDatabaseHooks(deps: AuthHookDeps) {
  return {
    create: {
      after: async (authUser: {
        id: string;
        email: string;
        name: string;
        emailVerified: boolean;
      }) => {
        if (deps.onUserCreated) {
          try {
            await deps.onUserCreated({
              id: authUser.id,
              email: authUser.email,
              name: authUser.name,
            });
          } catch (err) {
            console.error("[auth.user.create.after] onUserCreated failed", {
              userId: authUser.id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        if (!authUser.emailVerified) return;
        deps.email
          ?.enqueue({
            template: "welcome",
            to: authUser.email,
            userId: authUser.id,
            category: "transactional",
            vars: { userName: authUser.name },
          })
          .catch((err: unknown) => {
            console.error("[auth] enqueue welcome failed", {
              userId: authUser.id,
              error: err instanceof Error ? err.message : String(err),
            });
          });
      },
    },
    update: {
      before: async (
        userData: Record<string, unknown> & { id?: string; phoneNumber?: unknown },
      ) => {
        if (!("phoneNumber" in userData)) return;
        const userId = (userData as { id?: string }).id;
        if (!userId) return;
        const existing = await deps.db.query.user.findFirst({
          where: (u, { eq }) => eq(u.id, userId),
          columns: { phoneNumber: true },
        });
        const nextPhone =
          userData.phoneNumber === null || userData.phoneNumber === undefined
            ? null
            : String(userData.phoneNumber);
        await resetPhoneVerifiedIfNumberChanged(deps.db, userId, existing?.phoneNumber, nextPhone);
      },
    },
  };
}
