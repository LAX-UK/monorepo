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
        if (deps.onAccountCreated) {
          try {
            await deps.onAccountCreated({
              userId: acct.userId,
              providerId: acct.providerId,
            });
          } catch (err) {
            console.error("[auth.account.create.after] onAccountCreated failed", {
              userId: acct.userId,
              providerId: acct.providerId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        if (acct.providerId === "credential") return;
        const userRow = await deps.ports.accountLinkReader.findUserEmailProfile(acct.userId);
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
          accounts: deps.ports.accountLinkReader,
          email: deps.ports.email,
          userId: acct.userId,
          providerId: acct.providerId,
          template: "social-account-linked",
        });
      },
    },
    delete: {
      before: async (acct: { userId: string }) => {
        await assertCanUnlinkAccount({
          accounts: deps.ports.accountLinkReader,
          userId: acct.userId,
        });
      },
      after: async (acct: { userId: string; providerId: string }) => {
        if (acct.providerId === "credential") return;
        await notifySocialAccountChange({
          accounts: deps.ports.accountLinkReader,
          email: deps.ports.email,
          userId: acct.userId,
          providerId: acct.providerId,
          template: "social-account-unlinked",
        });
      },
    },
  };
}
