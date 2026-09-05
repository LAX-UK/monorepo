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
          await deps.onAccountCreated({
            userId: acct.userId,
            providerId: acct.providerId,
          });
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
