import type { SecurityNoticePublisher } from "@auction/auth";
import type { AccountPasswordError } from "@auction/identity-contracts";
import type { ReauthRequired } from "./account-contact.service.js";
import type { DurableSecurityEffects } from "./durable-security-effects.js";
import {
  IdentityOperationError,
  type IdentityOperationsService,
} from "./identity-operations.service.js";
import { RecentSessionGuard } from "./recent-session-guard.js";

const ACCOUNT_PASSWORD_PATH = "account-password";

/** The refusals the person can act on; the rate limit is applied before the service runs. */
export type AccountPasswordRefusal = Exclude<AccountPasswordError, "rate_limited">;

const REFUSALS: ReadonlySet<string> = new Set<AccountPasswordRefusal>([
  "invalid_password",
  "invalid_password_policy",
  "password_breached",
  "same_password",
]);

export type AccountPasswordPorts = {
  operations: Pick<IdentityOperationsService, "listSessions" | "changeAccountPassword">;
  /** Ends relying-party sessions and tokens, retrying from the durable outbox if that fails. */
  durable: Pick<DurableSecurityEffects, "settle">;
  /** Tells the account's email about the change; it never throws and never undoes the change. */
  notices: SecurityNoticePublisher;
};

export type ChangePasswordResult =
  | { ok: true; created: boolean }
  | ReauthRequired
  | { ok: false; kind: AccountPasswordRefusal };

/**
 * Changing the password (or setting the first one) for the signed-in person, from LAX Account.
 *
 * It needs a recent sign-in, checked against the caller's own session exactly as for the other
 * sensitive changes, and the current password on top of that, so a borrowed unlocked browser is
 * not enough to take the account over. The new password follows the same strength and breach
 * rules as every other way of setting one. Every other sign-in is ended, because whoever else
 * held the account must not keep access, while the sign-in making the change stays. The person
 * is emailed afterwards, naming the browser.
 */
export class AccountPasswordService {
  private readonly sessions: RecentSessionGuard;

  constructor(
    private readonly ports: AccountPasswordPorts,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.sessions = new RecentSessionGuard(ports.operations, now);
  }

  async change(
    subjectId: string,
    currentSessionId: string,
    input: { currentPassword: string | null; newPassword: string },
  ): Promise<ChangePasswordResult> {
    const current = await this.sessions.findRecent(subjectId, currentSessionId);
    if (!current) return { ok: false, reason: "reauth_required" };
    let outcome: Awaited<ReturnType<IdentityOperationsService["changeAccountPassword"]>>;
    try {
      outcome = await this.ports.operations.changeAccountPassword(subjectId, {
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
        keepSessionId: currentSessionId,
      });
    } catch (error) {
      if (error instanceof IdentityOperationError && REFUSALS.has(error.code)) {
        return { ok: false, kind: error.code as AccountPasswordRefusal };
      }
      throw error;
    }
    // Relying-party sessions (Bid, Shop, Art) can outlive the issuer session they came from, so
    // they are ended even when no issuer session was left to delete.
    await this.ports.durable.settle(ACCOUNT_PASSWORD_PATH, {
      kind: "revoke_tokens_except_session",
      userId: subjectId,
      keepSessionId: currentSessionId,
    });
    void this.ports.notices.notify({
      kind: "password_changed",
      userId: subjectId,
      at: this.now(),
      userAgent: current.userAgent,
    });
    return { ok: true, created: outcome.created };
  }
}
