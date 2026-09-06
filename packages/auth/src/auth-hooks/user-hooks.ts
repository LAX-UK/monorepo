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
          await deps.onUserCreated({
            id: authUser.id,
            email: authUser.email,
            name: authUser.name,
          });
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
        if (!deps.onUserUpdated) return;
        await deps.onUserUpdated({
          id: authUser.id,
          email: authUser.email,
          name: authUser.name,
          phoneNumber: authUser.phoneNumber ?? null,
          image: authUser.image ?? null,
        });
      },
    },
  };
}
