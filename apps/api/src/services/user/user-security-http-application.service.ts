import type { IAttributionStore } from "@auction/marketing-events";
import type { IAuthAuditPublisher } from "../interfaces/auth-audit-publisher.js";
import type { UserHttpJson } from "../interfaces/user-routes/user-route-http.js";
import type { IUserSecurityHttpApplicationService } from "../interfaces/user-routes/user-security-http.js";
import type { SessionRevocationService } from "../session-revocation.service.js";
import type { UserService } from "../user.service.js";

export type UserSecurityHttpDeps = {
  sessionRevocation: SessionRevocationService;
  authAuditPublisher: IAuthAuditPublisher;
  userService: UserService;
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

  /**
   * Identity decides: it asks LAX Bid, LAX Shop and anything else the person uses whether they
   * have something in flight, and starts the 30-day deletion only when every one says no.
   * This endpoint keeps its old response shape (`error` and `code` of the first thing in the
   * way) and adds the complete `blockers` list.
   */
  async requestAccountDeletion(input: { userId: string }): Promise<UserHttpJson> {
    const outcome = await this.deps.userService.requestAccountDeletion(input.userId);
    if (outcome.outcome === "already_requested") {
      return {
        status: 409,
        body: { error: "Deletion already requested", code: "account_deletion_already_requested" },
      };
    }
    if (outcome.outcome === "not_eligible") {
      const blockers = outcome.status.products.flatMap((product) =>
        product.blockers.map((blocker) => ({ ...blocker, product: product.product })),
      );
      const [first] = blockers;
      if (first) {
        return {
          status: 409,
          body: { error: first.message, code: first.code, blockers },
        };
      }
      // Nothing was named, but a product could not be asked: refuse rather than guess.
      return {
        status: 503,
        body: {
          error: "We couldn't check your account just now. Please try again in a moment.",
          code: "account_deletion_check_unavailable",
        },
      };
    }
    await this.deps.attributionStore.delete(input.userId);
    return { status: 200, body: { ok: true } };
  }
}
