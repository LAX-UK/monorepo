import { ACCOUNT_STEP_UP_MAX_AGE_SECONDS } from "@auction/identity-contracts";
import type { BackchannelLogoutRevoker } from "./backchannel-logout-revocation.service.js";
import type { IdentityOperationsService, IdentitySession } from "./identity-operations.service.js";
import { type SecurityEffectLogger, settleSecurityEffect } from "./settle-security-effect.js";

export type AccountIdentityPorts = {
  operations: Pick<
    IdentityOperationsService,
    | "readSubject"
    | "updateSubjectProfile"
    | "listSessions"
    | "removeSession"
    | "removeOtherSessions"
  >;
  logout: Pick<
    BackchannelLogoutRevoker,
    "revokeIdentitySessions" | "revokeSubjectExceptIdentitySession"
  >;
};

/**
 * The caller's own sign-in no longer exists (signed out elsewhere, expired) or is too old for
 * a sensitive change. Both are cured the same way, by signing in again, so LAX Account gets one
 * answer for both.
 */
export type ReauthRequired = { ok: false; reason: "reauth_required" };

export type AccountSessionRow = {
  id: string;
  userAgent: string | null;
  createdAt: Date;
  lastActiveAt: Date;
  isCurrent: boolean;
};

/**
 * What a signed-in person may do to their own identity from LAX Account: read and rename
 * themselves, and see and end their sign-ins.
 *
 * `currentSessionId` is the `sid` of the sign-in LAX Account holds, taken from its verified ID
 * token. It is checked against the subject's live sessions on every call, so naming someone
 * else's session, or a session that has ended, never succeeds. The recency check reads the
 * session's own creation time, the value the issuer put in that ID token as `auth_time`,
 * rather than a timestamp the caller reports.
 */
export class AccountIdentityService {
  constructor(
    private readonly ports: AccountIdentityPorts,
    private readonly log: SecurityEffectLogger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async readProfile(subjectId: string): Promise<{ name: string } | null> {
    const subject = await this.ports.operations.readSubject(subjectId);
    return subject ? { name: subject.name } : null;
  }

  async rename(
    subjectId: string,
    currentSessionId: string,
    name: string,
  ): Promise<{ ok: true; name: string } | ReauthRequired> {
    if (!(await this.findRecentSession(subjectId, currentSessionId))) {
      return { ok: false, reason: "reauth_required" };
    }
    // Writes the name and queues user.profile_updated in one transaction; the outbox is what
    // carries a name change to every product.
    await this.ports.operations.updateSubjectProfile(subjectId, { name });
    return { ok: true, name };
  }

  async listSessions(
    subjectId: string,
    currentSessionId: string,
  ): Promise<{ ok: true; sessions: AccountSessionRow[] } | ReauthRequired> {
    const live = await this.liveSessions(subjectId);
    if (!live.some((session) => session.id === currentSessionId)) {
      return { ok: false, reason: "reauth_required" };
    }
    return {
      ok: true,
      sessions: live.map((session) => ({
        id: session.id,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        lastActiveAt: session.updatedAt,
        isCurrent: session.id === currentSessionId,
      })),
    };
  }

  async revokeSession(
    subjectId: string,
    currentSessionId: string,
    targetSessionId: string,
  ): Promise<
    { ok: true; revoked: number } | ReauthRequired | { ok: false; reason: "cannot_revoke_current" }
  > {
    if (targetSessionId === currentSessionId) return { ok: false, reason: "cannot_revoke_current" };
    if (!(await this.findRecentSession(subjectId, currentSessionId))) {
      return { ok: false, reason: "reauth_required" };
    }
    const removed = await this.ports.operations.removeSession(subjectId, targetSessionId);
    if (!removed) return { ok: true, revoked: 0 };
    await this.fanOutLogout("revoke_session", subjectId, () =>
      this.ports.logout.revokeIdentitySessions([targetSessionId]).then(() => undefined),
    );
    return { ok: true, revoked: 1 };
  }

  async revokeOtherSessions(
    subjectId: string,
    currentSessionId: string,
  ): Promise<{ ok: true; revoked: number } | ReauthRequired> {
    if (!(await this.findRecentSession(subjectId, currentSessionId))) {
      return { ok: false, reason: "reauth_required" };
    }
    const removed = await this.ports.operations.removeOtherSessions(subjectId, currentSessionId);
    // Relying-party sessions (Bid, Shop, Art) can outlive the issuer session they came from, so
    // they are ended even when no issuer session was left to delete.
    await this.fanOutLogout("revoke_other_sessions", subjectId, () =>
      this.ports.logout
        .revokeSubjectExceptIdentitySession(subjectId, currentSessionId)
        .then(() => undefined),
    );
    return { ok: true, revoked: removed.length };
  }

  private async liveSessions(subjectId: string): Promise<IdentitySession[]> {
    const nowMs = this.now().getTime();
    const sessions = await this.ports.operations.listSessions(subjectId);
    return sessions.filter((session) => session.expiresAt.getTime() > nowMs);
  }

  private async findRecentSession(
    subjectId: string,
    sessionId: string,
  ): Promise<IdentitySession | null> {
    const session = (await this.liveSessions(subjectId)).find((row) => row.id === sessionId);
    if (!session) return null;
    const ageSeconds = (this.now().getTime() - session.createdAt.getTime()) / 1_000;
    return ageSeconds >= 0 && ageSeconds <= ACCOUNT_STEP_UP_MAX_AGE_SECONDS ? session : null;
  }

  private fanOutLogout(effect: string, userId: string, run: () => Promise<void>): Promise<void> {
    return settleSecurityEffect(this.log, { path: "account-sessions", effect, userId }, run);
  }
}
