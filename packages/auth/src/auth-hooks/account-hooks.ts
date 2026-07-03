import {
  assertCanUnlinkAccount,
  notifySocialAccountChange,
  shouldNotifySocialAccountLinked,
} from "../account-linking.js";
import type { AuthHookDeps } from "./auth-hook-deps.js";

export function buildAccountDatabaseHooks(deps: AuthHookDeps) {
  return {
    create: {
      after: async (acct: {
        userId: string;
        providerId: string;
        createdAt: Date;
      }) => {
        if (acct.providerId === "credential") return;
        const userRow = await deps.db.query.user.findFirst({
          where: (u, { eq }) => eq(u.id, acct.userId),
          columns: { createdAt: true },
        });
        if (!userRow) return;
        if (
          !shouldNotifySocialAccountLinked({
            userCreatedAt: userRow.createdAt,
            accountCreatedAt: acct.createdAt,
          })
        ) {
          return;
        }
        await notifySocialAccountChange({
          db: deps.db,
          email: deps.email,
          userId: acct.userId,
          providerId: acct.providerId,
          template: "social-account-linked",
        });
      },
    },
    delete: {
      before: async (acct: { userId: string }) => {
        await assertCanUnlinkAccount({ db: deps.db, userId: acct.userId });
      },
      after: async (acct: { userId: string; providerId: string }) => {
        if (acct.providerId === "credential") return;
        await notifySocialAccountChange({
          db: deps.db,
          email: deps.email,
          userId: acct.userId,
          providerId: acct.providerId,
          template: "social-account-unlinked",
        });
      },
    },
  };
}
