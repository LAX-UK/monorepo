import { APIError, getOAuthState } from "better-auth/api";
import {
  assertCanUnlinkAccount,
  recordSignInMethodChange,
  shouldNotifySocialAccountLinked,
} from "../account-linking.js";
import { readProviderAddress } from "../provider-address.js";
import {
  SOCIAL_SIGN_IN_ERROR_CODES,
  decideImplicitLink,
  isSocialProviderId,
  mayUseSocialSignIn,
} from "../social-sign-in-policy.js";
import type { AuthHookDeps } from "./auth-hook-deps.js";
import { readSocialSubjectReporting, recordStaffRefusal, socialFlow } from "./social-flow.js";

type EndpointContext =
  | { path?: string | undefined; context?: { adapter?: unknown } | undefined }
  | null
  | undefined;

/** The library's own link endpoint, which also links by ID token without any redirect. */
const LINK_SOCIAL_PATH = "/link-social";

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
const LINK_NOT_FROM_ACCOUNT_MESSAGE = "Add Google or Apple from LAX Account, under Security.";

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
    // The ID-token form of the library's link endpoint writes the account row inside that
    // request, with no provider redirect and so no hand-off mark. The route is switched off over
    // HTTP; this is the second guard, for any server-side call that still reaches it.
    if (context?.path === LINK_SOCIAL_PATH) {
      throw new APIError("FORBIDDEN", {
        message: LINK_NOT_FROM_ACCOUNT_MESSAGE,
        code: SOCIAL_SIGN_IN_ERROR_CODES.linkNotStartedFromAccount,
      });
    }
    const flow = socialFlow(context);
    if (flow.newUser) return; // a first sign-up creates its own account; nothing to join
    // A link made on the person's say-so (state.link) is only ever started by the issuer's
    // account-action hand-off, which marks it. A link without the mark did not come through the
    // ticket, the recent sign-in or the one email, so it is refused here too: with different
    // addresses allowed, the library's own link endpoint being switched off must not be the only
    // thing standing between a live session and a new way in.
    const state = await getOAuthState().catch(() => null);
    if (state?.link && (state as { accountAction?: unknown }).accountAction !== true) {
      throw new APIError("FORBIDDEN", {
        message: LINK_NOT_FROM_ACCOUNT_MESSAGE,
        code: SOCIAL_SIGN_IN_ERROR_CODES.linkNotStartedFromAccount,
      });
    }
    const subject = await readSocialSubjectReporting(deps, acct.userId);
    if (!mayUseSocialSignIn(subject)) {
      flow.blockedLink = "staff";
      await recordStaffRefusal(deps, {
        userId: acct.userId,
        provider: acct.providerId,
        attempt: "link",
      });
      throw new APIError("FORBIDDEN", {
        message: STAFF_MESSAGE,
        code: SOCIAL_SIGN_IN_ERROR_CODES.staffNotAllowed,
      });
    }
    // A link the person started themselves from Security, after confirming it is them, is
    // theirs to make; only the staff rule above applies to it.
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
      before: async (
        acct: { userId: string; providerId: string; idToken?: string | null | undefined },
        context: EndpointContext,
      ) => {
        await applySocialLinkPolicy(acct, context);
        if (!isSocialProviderId(acct.providerId)) return;
        // SM3: keep the address the provider reported (and whether Apple hid it) with the link, so
        // the row can say which Google or Apple account this is. The LAX email never changes.
        const address = readProviderAddress(acct.idToken);
        return {
          data: { ...acct, providerEmail: address.email, providerEmailHidden: address.hidden },
        };
      },
      after: async (acct: {
        userId: string;
        providerId: string;
        createdAt: Date;
        providerEmail?: string | null | undefined;
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
        await recordSignInMethodChange({
          notices: deps.ports.securityNotices,
          events: deps.ports.events,
          userId: acct.userId,
          providerId: acct.providerId,
          change: "added",
          at: new Date(acct.createdAt),
          providerEmail: acct.providerEmail ?? null,
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
        await recordSignInMethodChange({
          notices: deps.ports.securityNotices,
          events: deps.ports.events,
          userId: acct.userId,
          providerId: acct.providerId,
          change: "removed",
        });
      },
    },
  };
}
