import { APIError, getOAuthState } from "better-auth/api";
import {
  assertCanUnlinkAccount,
  notifySocialAccountChange,
  shouldNotifySocialAccountLinked,
} from "../account-linking.js";
import {
  SOCIAL_SIGN_IN_ERROR_CODES,
  decideImplicitLink,
  isSocialProviderId,
  mayUseSocialSignIn,
} from "../social-sign-in-policy.js";
import type { AuthHookDeps } from "./auth-hook-deps.js";
import { readSocialSubject, socialFlow } from "./social-flow.js";

type EndpointContext = { context?: { adapter?: unknown } | undefined } | null | undefined;

/** The raw adapter of this request: it skips the sign-in-method guard on removing an account. */
function rawAdapter(context: EndpointContext) {
  return context?.context?.adapter as
    | {
        deleteMany(input: {
          model: string;
          where: { field: string; value: string }[];
        }): Promise<number>;
      }
    | undefined;
}

const NOT_LINKED_MESSAGE =
  "There is already a LAX Account for this email. Sign in the way you usually do.";
const STAFF_MESSAGE = "Staff accounts cannot sign in with Google or Apple.";

export function buildAccountDatabaseHooks(deps: AuthHookDeps) {
  /**
   * The rules for a Google or Apple account meeting an existing LAX account (SM4, SM5, SM14).
   * Runs before the provider account row is written, so a refusal leaves nothing behind.
   */
  async function applySocialLinkPolicy(
    acct: { userId: string; providerId: string },
    context: EndpointContext,
  ): Promise<void> {
    if (!isSocialProviderId(acct.providerId)) return;
    const flow = socialFlow(context);
    if (flow.newUser) return; // a first sign-up creates its own account; nothing to join
    const subject = await readSocialSubject(deps.ports, acct.userId);
    if (!mayUseSocialSignIn(subject)) {
      flow.blockedLink = "staff";
      throw new APIError("FORBIDDEN", {
        message: STAFF_MESSAGE,
        code: SOCIAL_SIGN_IN_ERROR_CODES.staffNotAllowed,
      });
    }
    // A link the person started themselves from Security, after confirming it is them, is
    // theirs to make; only the staff rule above applies to it.
    const state = await getOAuthState().catch(() => null);
    if (state?.link) return;
    const decision = decideImplicitLink(subject);
    if (decision.kind === "block") {
      flow.blockedLink = decision.reason;
      throw new APIError("FORBIDDEN", {
        message: NOT_LINKED_MESSAGE,
        code: SOCIAL_SIGN_IN_ERROR_CODES.accountNotLinked,
      });
    }
    if (decision.kind === "link_and_secure") await dropUnconfirmedPassword(acct.userId, context);
  }

  /**
   * SM5. The provider is about to prove an email nobody confirmed, so a password set before
   * that proof may belong to whoever registered the address first. The password goes, and so
   * does every session and token already issued, before the provider is joined and before the
   * new session exists. A failure here stops the link, so the old password is never left standing
   * beside a verified email.
   */
  async function dropUnconfirmedPassword(userId: string, context: EndpointContext): Promise<void> {
    const adapter = rawAdapter(context);
    if (!adapter) throw new Error("cannot remove the unconfirmed password: no adapter");
    // Sessions first: if either step fails the link stops, and ending sessions alone leaves the
    // account as it was.
    await deps.revokeAllSessions?.(userId);
    const removed = await adapter.deleteMany({
      model: "account",
      where: [
        { field: "userId", value: userId },
        { field: "providerId", value: "credential" },
      ],
    });
    if (removed > 0) socialFlow(context).secureUserId = userId;
  }

  return {
    create: {
      before: applySocialLinkPolicy,
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
