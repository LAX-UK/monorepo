import type { SecurityNoticePublisher } from "@auction/auth";
import type {
  AccountSignInMethodError,
  AccountSignInMethodsResponse,
  SocialSignInProvider,
} from "@auction/identity-contracts";
import type { ReauthRequired } from "./account-contact.service.js";
import type { DurableSecurityEffects } from "./durable-security-effects.js";
import {
  IdentityOperationError,
  type IdentityOperationsService,
} from "./identity-operations.service.js";
import { RecentSessionGuard } from "./recent-session-guard.js";

const ACCOUNT_SIGN_IN_METHODS_PATH = "account-sign-in-methods";

/** The refusals the person can act on; the rate limit is applied before the service runs. */
export type AccountSignInMethodRefusal = Exclude<AccountSignInMethodError, "rate_limited">;

const REFUSALS: ReadonlySet<string> = new Set<AccountSignInMethodRefusal>([
  "last_sign_in_method",
  "not_linked",
]);

export type AccountSignInMethodsPorts = {
  operations: Pick<
    IdentityOperationsService,
    "listSessions" | "readSignInMethods" | "unlinkSocialSignIn"
  >;
  /** Ends relying-party sessions and tokens, retrying from the durable outbox if that fails. */
  durable: Pick<DurableSecurityEffects, "settle">;
  /** Tells the account's email about the change; it never throws and never undoes the change. */
  notices: SecurityNoticePublisher;
};

export type UnlinkSignInMethodResult =
  | { ok: true; unlinked: SocialSignInProvider; revokedSessions: number }
  | ReauthRequired
  | { ok: false; kind: AccountSignInMethodRefusal };

/**
 * Showing and removing the ways a person signs in, from LAX Account.
 *
 * Removing a social sign-in needs a recent sign-in, checked against the caller's own session
 * exactly as for the other sensitive changes, and it is refused when it would leave no password
 * or other provider behind. Every other sign-in is ended, because whoever else held the account
 * through that method must not keep access, while the sign-in making the change stays. The
 * person is emailed afterwards, naming the provider and the browser.
 */
export class AccountSignInMethodsService {
  private readonly sessions: RecentSessionGuard;

  constructor(
    private readonly ports: AccountSignInMethodsPorts,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.sessions = new RecentSessionGuard(ports.operations, now);
  }

  async read(subjectId: string): Promise<AccountSignInMethodsResponse> {
    const methods = await this.ports.operations.readSignInMethods(subjectId);
    return {
      hasPassword: methods.hasPassword,
      social: methods.social.map((method) => ({
        provider: method.provider,
        linkedAt: method.linkedAt.toISOString(),
      })),
    };
  }

  async unlink(
    subjectId: string,
    currentSessionId: string,
    provider: SocialSignInProvider,
  ): Promise<UnlinkSignInMethodResult> {
    const current = await this.sessions.findRecent(subjectId, currentSessionId);
    if (!current) return { ok: false, reason: "reauth_required" };
    let revokedSessionIds: string[];
    try {
      ({ revokedSessionIds } = await this.ports.operations.unlinkSocialSignIn(
        subjectId,
        provider,
        currentSessionId,
      ));
    } catch (error) {
      if (error instanceof IdentityOperationError && REFUSALS.has(error.code)) {
        return { ok: false, kind: error.code as AccountSignInMethodRefusal };
      }
      throw error;
    }
    // Relying-party sessions (Bid, Shop, Art) can outlive the issuer session they came from, so
    // they are ended even when no issuer session was left to delete.
    await this.ports.durable.settle(ACCOUNT_SIGN_IN_METHODS_PATH, {
      kind: "revoke_tokens_except_session",
      userId: subjectId,
      keepSessionId: currentSessionId,
    });
    void this.ports.notices.notify({
      kind: "sign_in_method_removed",
      userId: subjectId,
      at: this.now(),
      provider,
      userAgent: current.userAgent,
    });
    return { ok: true, unlinked: provider, revokedSessions: revokedSessionIds.length };
  }
}
