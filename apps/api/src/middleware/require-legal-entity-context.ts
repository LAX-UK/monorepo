import { X_LEGAL_ENTITY_ID_HEADER } from "@auction/http-headers";
import {
  canAccessPlatformAdminRoutes,
  normalizeUserRoleOrClient,
  normalizeUserStaffRole,
} from "@auction/types";
import type { LegalEntitySummary } from "@auction/types";
import { createMiddleware } from "hono/factory";
import { parseActingLegalEntityCookieFromHeader } from "../lib/impersonation-cookie.js";
import type { ImpersonationSessionService } from "../services/impersonation-session.service.js";
import type {
  ActiveMembership,
  ILegalEntityRepository,
} from "../services/interfaces/legal-entity-repository.js";
import { PersonalLegalEntityUnavailableError } from "../services/legal-entity/personal-legal-entity-resolver.service.js";

export { X_LEGAL_ENTITY_ID_HEADER };

type HeaderResolution =
  | { kind: "ok"; membership: ActiveMembership }
  | { kind: "error"; status: 403; body: Record<string, unknown> };

/** Shared by strict header middleware and submission routes: resolve acting
 * membership from `X-Legal-Entity-Id` + optional admin impersonation cookie. */
export async function resolveLegalEntityContextFromHeader(
  repo: ILegalEntityRepository,
  opts: Pick<RequireLegalEntityContextOptions, "impersonationSessions" | "onImpersonationExpired">,
  input: {
    userId: string;
    userRole: string | undefined;
    userStaffRole?: string | null | undefined;
    legalEntityId: string;
    cookieHeader: string | null | undefined;
  },
): Promise<HeaderResolution> {
  const membership = await repo.findActiveMembership(input.userId, input.legalEntityId);
  if (membership) return { kind: "ok", membership };

  const role = normalizeUserRoleOrClient(input.userRole);
  const staff = normalizeUserStaffRole(input.userStaffRole ?? undefined);
  if (canAccessPlatformAdminRoutes(role, staff)) {
    const cookiePayload = parseActingLegalEntityCookieFromHeader(input.cookieHeader);
    if (cookiePayload && cookiePayload.e === input.legalEntityId && cookiePayload.i?.sid) {
      const validation = await opts.impersonationSessions?.validateForRequest({
        sessionId: cookiePayload.i.sid,
        actorUserId: input.userId,
        targetLegalEntityId: input.legalEntityId,
      });
      if (!validation?.ok) {
        if (validation?.reason === "expired" && opts.onImpersonationExpired) {
          await opts.onImpersonationExpired({
            sessionId: cookiePayload.i.sid,
            actorUserId: input.userId,
            actingLegalEntityId: cookiePayload.e,
          });
        }
        const expired = validation?.reason === "expired";
        return {
          kind: "error",
          status: 403,
          body: {
            error: expired ? "impersonation_session_expired" : "invalid_impersonation_session",
            code: expired ? "impersonation_session_expired" : "invalid_impersonation_session",
          },
        };
      }
      return {
        kind: "ok",
        membership: {
          legalEntityId: cookiePayload.e,
          userId: input.userId,
          role: "admin",
          isPrimaryAdmin: true,
          isImpersonation: true,
          impersonationSessionId: cookiePayload.i.sid,
          impersonationExpiresAt: validation.session.expiresAt,
        },
      };
    }
  }

  return { kind: "error", status: 403, body: { error: "not_a_member_of_legal_entity" } };
}

export type LegalEntityContext = ActiveMembership;

export type ImpersonationExpiredHandler = (input: {
  sessionId: string;
  actorUserId: string;
  actingLegalEntityId: string;
}) => Promise<void>;

export type RequireLegalEntityContextOptions = {
  /** If true, missing/invalid headers fall through (no context set) instead
   * of returning 4xx. Useful for endpoints that are entity-aware but not
   * entity-required.
   */
  optional?: boolean;
  impersonationSessions?: Pick<ImpersonationSessionService, "validateForRequest">;
  /** emit `admin.impersonation_ended` with `end_reason=timeout` when
   * an expired impersonation cookie is observed (best-effort idempotency in
   * the handler).
   */
  onImpersonationExpired?: ImpersonationExpiredHandler;
};

/** Reads `X-Legal-Entity-Id`, validates that the authenticated user is an
 * active member of that entity, and sets `legalEntityContext` on the Hono
 * variables. Must run *after* the auth middleware that sets `userId` and
 * `userRole`.
 * * platform staff (non–finance-shell-only) may present a structured acting
 * cookie with a valid (non-expired) impersonation session for the same entity
 * id as the header when they are **not** members.
 */
export function createRequireLegalEntityContext(
  repo: ILegalEntityRepository,
  opts: RequireLegalEntityContextOptions = {},
) {
  return createMiddleware<{
    Variables: {
      userId?: string;
      userRole?: string;
      userStaffRole?: string | null;
      legalEntityContext?: LegalEntityContext;
    };
  }>(async (c, next) => {
    const userId = c.get("userId");
    if (!userId) {
      if (opts.optional) {
        await next();
        return;
      }
      return c.json({ error: "Unauthorized" }, 401);
    }

    const headerVal = c.req.header(X_LEGAL_ENTITY_ID_HEADER);
    if (!headerVal) {
      if (opts.optional) {
        await next();
        return;
      }
      return c.json({ error: "missing_legal_entity_context" }, 400);
    }

    const resolved = await resolveLegalEntityContextFromHeader(repo, opts, {
      userId,
      userRole: c.get("userRole"),
      userStaffRole: c.get("userStaffRole"),
      legalEntityId: headerVal,
      cookieHeader: c.req.header("Cookie"),
    });
    if (resolved.kind === "error") {
      return c.json(resolved.body, resolved.status);
    }
    c.set("legalEntityContext", resolved.membership);
    await next();
  });
}

export type SubmissionsLegalEntityContextOptions = Pick<
  RequireLegalEntityContextOptions,
  "impersonationSessions" | "onImpersonationExpired"
> & {
  /** Resolves (and lazily provisions) the user's personal entity when the
   * acting header is absent. */
  resolvePersonalEntity: (userId: string) => Promise<LegalEntitySummary>;
};

/** Like {@link createRequireLegalEntityContext}, but when `X-Legal-Entity-Id` is
 * absent, falls back to the user's personal `individual` entity (created by
 * them, active membership, entity not rejected/archived). Preserves IDOR
 * protection for explicit headers; legacy clients without the header still
 * submit on their own behalf.
 */
export function createSubmissionsLegalEntityContext(
  repo: ILegalEntityRepository,
  opts: SubmissionsLegalEntityContextOptions,
) {
  return createMiddleware<{
    Variables: {
      userId?: string;
      userRole?: string;
      userStaffRole?: string | null;
      legalEntityContext?: LegalEntityContext;
    };
  }>(async (c, next) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const headerVal = c.req.header(X_LEGAL_ENTITY_ID_HEADER)?.trim();
    if (headerVal) {
      const resolved = await resolveLegalEntityContextFromHeader(repo, opts, {
        userId,
        userRole: c.get("userRole"),
        userStaffRole: c.get("userStaffRole"),
        legalEntityId: headerVal,
        cookieHeader: c.req.header("Cookie"),
      });
      if (resolved.kind === "error") {
        return c.json(resolved.body, resolved.status);
      }
      c.set("legalEntityContext", resolved.membership);
      await next();
      return;
    }

    let personalId: string;
    try {
      const personal = await opts.resolvePersonalEntity(userId);
      personalId = personal.id;
    } catch (err) {
      if (err instanceof PersonalLegalEntityUnavailableError) {
        return c.json(
          {
            error: "no_valid_legal_entity_for_submissions",
            code: "no_valid_legal_entity_for_submissions",
          },
          403,
        );
      }
      throw err;
    }

    const membership = await repo.findActiveMembership(userId, personalId);
    if (!membership) {
      return c.json(
        {
          error: "no_valid_legal_entity_for_submissions",
          code: "no_valid_legal_entity_for_submissions",
        },
        403,
      );
    }

    c.set("legalEntityContext", membership);
    await next();
  });
}

/** Convenience optional variant. */
export function createOptionalLegalEntityContext(
  repo: ILegalEntityRepository,
  onImpersonationExpired?: ImpersonationExpiredHandler,
  impersonationSessions?: RequireLegalEntityContextOptions["impersonationSessions"],
) {
  const opts: RequireLegalEntityContextOptions = { optional: true };
  if (onImpersonationExpired) {
    opts.onImpersonationExpired = onImpersonationExpired;
  }
  if (impersonationSessions) {
    opts.impersonationSessions = impersonationSessions;
  }
  return createRequireLegalEntityContext(repo, opts);
}
