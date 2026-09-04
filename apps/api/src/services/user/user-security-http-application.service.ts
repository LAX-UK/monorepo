import type { IEmailService } from "@auction/email";
import type { IAttributionStore } from "@auction/marketing-events";
import type { AccountDeletionEligibilityService } from "../account-deletion-eligibility.service.js";
import type { IAuthAuditPublisher } from "../interfaces/auth-audit-publisher.js";
import type { UserHttpJson } from "../interfaces/user-routes/user-route-http.js";
import type { IUserSecurityHttpApplicationService } from "../interfaces/user-routes/user-security-http.js";
import type { SessionRevocationService } from "../session-revocation.service.js";
import type { UserSecurityReadService } from "../user-security-read.service.js";
import type { UserService } from "../user.service.js";

export type UserSecurityHttpDeps = {
  sessionRevocation: SessionRevocationService;
  authAuditPublisher: IAuthAuditPublisher;
  userSecurityReadService: UserSecurityReadService;
  userService: UserService;
  emailService: Pick<IEmailService, "enqueue">;
  accountDeletionEligibilityService: AccountDeletionEligibilityService;
  attributionStore: IAttributionStore;
};

export class UserSecurityHttpApplicationService implements IUserSecurityHttpApplicationService {
  constructor(private readonly deps: UserSecurityHttpDeps) {}

  async listSessions(input: {
    userId: string;
    sessionTokenFromCookie: string | null;
  }): Promise<UserHttpJson> {
    try {
      const rows = await this.deps.sessionRevocation.listForUser(
        input.userId,
        input.sessionTokenFromCookie ?? undefined,
      );
      const data = rows.map(
        ({ ipAddress, userAgent, id, createdAt, expiresAt, lastPasswordAuthAt, isCurrent }) => ({
          id,
          createdAt,
          expiresAt,
          ipAddress,
          userAgent,
          lastPasswordAuthAt,
          isCurrent,
        }),
      );
      return { status: 200, body: { data } };
    } catch (err) {
      console.error("[users/me/sessions] list failed", {
        userId: input.userId,
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        status: 500,
        body: { error: "Could not load sessions", code: "sessions_list_failed" },
      };
    }
  }

  async deleteSession(input: {
    userId: string;
    sessionId: string;
    sessionTokenFromCookie: string | null;
  }): Promise<UserHttpJson> {
    const currentToken = input.sessionTokenFromCookie;
    const rows = await this.deps.sessionRevocation.listForUser(
      input.userId,
      currentToken ?? undefined,
    );
    const current = rows.find((row) => row.isCurrent);
    if (current?.id === input.sessionId) {
      return {
        status: 400,
        body: {
          error: "Use sign out to end this session.",
          code: "session_cannot_delete_current",
        },
      };
    }
    const ok = await this.deps.sessionRevocation.deleteSessionForUser(
      input.userId,
      input.sessionId,
    );
    if (!ok)
      return { status: 404, body: { error: "Session not found", code: "session_not_found" } };
    void this.deps.authAuditPublisher
      .publish({
        eventType: "auth.session_revoked",
        aggregateId: input.userId,
        payload: { sessionId: input.sessionId },
        actorUserId: input.userId,
      })
      .catch(() => {});
    return { status: 204, body: null };
  }

  async revokeAllSessionsExceptCurrent(input: {
    userId: string;
    sessionTokenFromCookie: string | null;
  }): Promise<UserHttpJson> {
    const currentToken = input.sessionTokenFromCookie;
    if (!currentToken) {
      return { status: 401, body: { error: "Unauthorized", code: "session_required" } };
    }
    const sid = await this.deps.sessionRevocation.getSessionIdForCookieToken(
      input.userId,
      currentToken,
    );
    if (!sid)
      return { status: 401, body: { error: "Session not found", code: "session_required" } };
    await this.deps.sessionRevocation.revokeAllForUserExcept(input.userId, currentToken);
    void this.deps.authAuditPublisher
      .publish({
        eventType: "auth.sessions_revoked_all_except_current",
        aggregateId: input.userId,
        payload: {},
        actorUserId: input.userId,
      })
      .catch(() => {});
    return { status: 200, body: { ok: true } };
  }

  async notifyTwoFactorEnabled(input: { userId: string }): Promise<UserHttpJson> {
    const twoFactorEnabled = await this.deps.userSecurityReadService.getTwoFactorEnabled(
      input.userId,
    );
    if (!twoFactorEnabled) {
      return {
        status: 409,
        body: {
          error: "Two-factor authentication is not enabled",
          code: "two_factor_not_enabled",
        },
      };
    }
    const row = await this.deps.userService.getById(input.userId);
    if (!row) return { status: 404, body: { error: "Not found", code: "user_not_found" } };
    void this.deps.emailService.enqueue({
      template: "2fa-enabled",
      to: row.email,
      userId: input.userId,
      category: "auth",
      vars: { userName: row.name },
    });
    void this.deps.authAuditPublisher
      .publish({
        eventType: "auth.two_factor_security_email",
        aggregateId: input.userId,
        payload: { kind: "enabled" },
        actorUserId: input.userId,
      })
      .catch(() => {});
    return { status: 200, body: { ok: true } };
  }

  async notifyTwoFactorDisabled(input: { userId: string }): Promise<UserHttpJson> {
    const twoFactorEnabled = await this.deps.userSecurityReadService.getTwoFactorEnabled(
      input.userId,
    );
    if (twoFactorEnabled) {
      return {
        status: 409,
        body: {
          error: "Two-factor authentication is still enabled",
          code: "two_factor_still_enabled",
        },
      };
    }
    const row = await this.deps.userService.getById(input.userId);
    if (!row) return { status: 404, body: { error: "Not found", code: "user_not_found" } };
    void this.deps.emailService.enqueue({
      template: "2fa-disabled",
      to: row.email,
      userId: input.userId,
      category: "auth",
      vars: { userName: row.name },
    });
    void this.deps.authAuditPublisher
      .publish({
        eventType: "auth.two_factor_security_email",
        aggregateId: input.userId,
        payload: { kind: "disabled" },
        actorUserId: input.userId,
      })
      .catch(() => {});
    return { status: 200, body: { ok: true } };
  }

  async requestAccountDeletion(input: { userId: string }): Promise<UserHttpJson> {
    const eligibility = await this.deps.accountDeletionEligibilityService.check(input.userId);
    if (!eligibility.ok) {
      return { status: 409, body: { error: eligibility.error, code: eligibility.code } };
    }
    await this.deps.attributionStore.delete(input.userId);
    await this.deps.userService.requestAccountDeletion(input.userId);
    return { status: 200, body: { ok: true } };
  }
}
