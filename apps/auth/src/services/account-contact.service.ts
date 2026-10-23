import type { AccountContactResponse } from "@auction/identity-contracts";
import type { EmailChangeResult, EmailChangeService } from "./email-change.service.js";
import type { IdentityOperationsService } from "./identity-operations.service.js";
import { RecentSessionGuard } from "./recent-session-guard.js";

export type AccountContactPorts = {
  operations: Pick<
    IdentityOperationsService,
    "readSubject" | "readSecurityStatus" | "listSessions"
  >;
  emailChange: Pick<EmailChangeService, "start" | "cancel">;
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
    now: () => Date = () => new Date(),
  ) {
    this.sessions = new RecentSessionGuard(ports.operations, now);
  }

  async read(subjectId: string): Promise<AccountContactResponse | null> {
    const [subject, status] = await Promise.all([
      this.ports.operations.readSubject(subjectId),
      this.ports.operations.readSecurityStatus(subjectId),
    ]);
    if (!subject || !status) return null;
    return {
      email: subject.email,
      emailVerified: subject.emailVerified,
      pendingEmail: status.pendingNewEmail,
      phone: status.phoneNumber,
      phoneVerified: status.phoneNumberVerified,
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
    const live = await this.sessions.liveSessions(subjectId);
    if (!live.some((session) => session.id === currentSessionId)) {
      return { ok: false, reason: "reauth_required" };
    }
    return this.ports.emailChange.cancel(subjectId);
  }
}
