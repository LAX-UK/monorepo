import { resetPhoneVerifiedIfNumberChanged } from "../phone-number-plugin.js";
import type { AuthHookDeps } from "./auth-hook-deps.js";

export function buildUserDatabaseHooks(deps: AuthHookDeps) {
  const profileUpdateSubjects = new Set<string>();
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
        const userId = (userData as { id?: string }).id;
        if (!userId) return;
        if ("email" in userData || "name" in userData || "phoneNumber" in userData) {
          profileUpdateSubjects.add(userId);
        }
        if (!("phoneNumber" in userData)) return;
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
      after: async (authUser: {
        id: string;
        email: string;
        name: string;
        phoneNumber?: string | null;
      }) => {
        if (!profileUpdateSubjects.delete(authUser.id) || !deps.onUserUpdated) return;
        try {
          await deps.onUserUpdated({
            id: authUser.id,
            email: authUser.email,
            name: authUser.name,
            phoneNumber: authUser.phoneNumber ?? null,
          });
        } catch (err) {
          console.error("[auth.user.update.after] onUserUpdated failed", {
            userId: authUser.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    },
  };
}
