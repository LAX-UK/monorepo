import type { AuthHookDeps } from "./auth-hook-deps.js";

export function buildUserDatabaseHooks(deps: AuthHookDeps) {
  const pendingProfileUpdates = new Map<string, number>();
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
        deps.ports.email
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
        if (
          "email" in userData ||
          "name" in userData ||
          "phoneNumber" in userData ||
          "image" in userData
        ) {
          pendingProfileUpdates.set(userId, (pendingProfileUpdates.get(userId) ?? 0) + 1);
        }
        if (!("phoneNumber" in userData)) return;
        const existingPhone = await deps.ports.phoneNumberStore.findPhoneNumber(userId);
        const nextPhone =
          userData.phoneNumber === null || userData.phoneNumber === undefined
            ? null
            : String(userData.phoneNumber);
        await deps.ports.phoneNumberStore.resetPhoneVerifiedIfNumberChanged(
          userId,
          existingPhone,
          nextPhone,
        );
      },
      after: async (authUser: {
        id: string;
        email: string;
        name: string;
        phoneNumber?: string | null;
        image?: string | null | undefined;
      }) => {
        const pending = pendingProfileUpdates.get(authUser.id) ?? 0;
        if (pending === 0) return;
        if (pending === 1) pendingProfileUpdates.delete(authUser.id);
        else pendingProfileUpdates.set(authUser.id, pending - 1);
        if (!deps.onUserUpdated) return;
        try {
          await deps.onUserUpdated({
            id: authUser.id,
            email: authUser.email,
            name: authUser.name,
            phoneNumber: authUser.phoneNumber ?? null,
            image: authUser.image ?? null,
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
