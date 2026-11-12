import type { AccountContactResponse } from "@auction/identity-contracts";
import { pendingEmailChangeState } from "../lib/pending-email-change.js";
import type { EmailChangeResult, EmailChangeService } from "./email-change.service.js";
import type { IdentityOperationsService } from "./identity-operations.service.js";
import { RecentSessionGuard } from "./recent-session-guard.js";

export type AccountContactPorts = {
  operations: Pick<
    IdentityOperationsService,
    "readSubject" | "readSecurityStatus" | "listSessions"
  >;
  emailChange: Pick<EmailChangeService, "start" | "cancel">;
  /** Whether the issuer can send phone codes; when false Account hides the phone editor. */
  phoneAvailable: () => boolean;
};

/** The caller's own sign-in no longer exists, or is too old for a sensitive change. */
export type ReauthRequired = { ok: false; reason: "reauth_required" };

/**
 * What a signed-in person may do to their own email address from LAX Account: see it, and
 * start or cancel a change. The change itself is the shared EmailChangeService; this class adds
 * the step-up rule. Starting a change needs a recent sign-in, because the new address decides
 * who can recover the account. Cancelling only needs a live one: it can only ever restore the
 * status quo.
 */
export class AccountContactService {
  private readonly sessions: RecentSessionGuard;

  constructor(
    private readonly ports: AccountContactPorts,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.sessions = new RecentSessionGuard(ports.operations, this.now);
  }

  async read(subjectId: string): Promise<AccountContactResponse | null> {
    const [subject, status] = await Promise.all([
      this.ports.operations.readSubject(subjectId),
      this.ports.operations.readSecurityStatus(subjectId),
    ]);
    if (!subject || !status) return null;
    const pending = pendingEmailChangeState(status, this.now());
    return {
      email: subject.email,
      emailVerified: subject.emailVerified,
      pendingEmail: pending.kind === "waiting" ? pending.email : null,
      pendingEmailExpired: pending.kind === "expired",
      phone: status.phoneNumber,
      phoneVerified: status.phoneNumberVerified,
      phoneAvailable: this.ports.phoneAvailable(),
    };
  }

  async startEmailChange(
    subjectId: string,
    currentSessionId: string,
    newEmail: string,
  ): Promise<ReauthRequired | EmailChangeResult<{ pendingEmail: string }>> {
    if (!(await this.sessions.findRecent(subjectId, currentSessionId))) {
      return { ok: false, reason: "reauth_required" };
    }
    return this.ports.emailChange.start(subjectId, newEmail, "account");
  }

  async cancelEmailChange(
    subjectId: string,
    currentSessionId: string,
  ): Promise<ReauthRequired | EmailChangeResult<object>> {
    if (!(await this.sessions.findLive(subjectId, currentSessionId))) {
      return { ok: false, reason: "reauth_required" };
    }
    return this.ports.emailChange.cancel(subjectId);
  }
}
