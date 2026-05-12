import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import {
  type LegalEntitySummary,
  canAccessPlatformAdminRoutes,
  decodeActingContextCookie,
  normalizeUserRoleOrClient,
  normalizeUserStaffRole,
} from "@auction/types";
import { cookies } from "next/headers";
import { ACTING_LEGAL_ENTITY_COOKIE, X_LEGAL_ENTITY_ID_HEADER } from "./client-acting-context";

const DEFAULT_ACTING_COOKIE_MAX_AGE_SEC = 365 * 24 * 60 * 60;

/** When the acting-entity cookie is absent, set it to the user's personal
 * (`individual`) entity so the browser sends `X-Legal-Entity-Id` on later
 * API calls. Best-effort: some static render paths cannot mutate cookies. */
async function seedPersonalActingLegalEntityCookieIfAbsent(
  memberships: LegalEntitySummary[],
): Promise<void> {
  if (memberships.length === 0) return;
  const jar = await cookies();
  if (jar.get(ACTING_LEGAL_ENTITY_COOKIE)?.value?.trim()) return;

  const personal = memberships.find((m) => m.kind === "individual") ?? memberships[0];
  if (!personal) return;
  const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;

  try {
    jar.set(ACTING_LEGAL_ENTITY_COOKIE, encodeURIComponent(personal.id), {
      path: "/",
      sameSite: "lax",
      maxAge: DEFAULT_ACTING_COOKIE_MAX_AGE_SEC,
      secure: process.env.NODE_ENV === "production",
      ...(domain ? { domain } : {}),
    });
  } catch {
    /* cookie mutation unavailable (e.g. fully static segment) */
  }
}

export type ResolvedActingImpersonation = {
  displayName: string;
  expiresAtIso: string;
  sessionId: string;
};

export type ResolvedActingContext = {
  /** The acting summary chosen for this request — explicit cookie if valid,
   * otherwise the user's personal entity. `null` when the user has no
   * memberships at all (should be impossible post-0027 backfill).
   */
  acting: LegalEntitySummary | null;
  /** Every active membership for the user (used by the switcher UI). */
  memberships: LegalEntitySummary[];
  /** active platform-admin impersonation (synthetic acting row). */
  impersonation: ResolvedActingImpersonation | null;
};

/** Resolves the acting legal entity for the current request.
 * * 1. Fetch `/legal-entities/me` (cookie-authenticated).
 * 2. For platform administrators, a structured cookie with an
 * impersonation block is validated via `GET /legal-entities/:id`.
 * 3. Otherwise pick the membership whose id matches the cookie; if no match,
 * fall back to the first membership where `kind = 'individual'`.
 */
export async function resolveActingContext(
  userRole?: string | null,
  userStaffRole?: string | null,
): Promise<ResolvedActingContext> {
  const res = await authedServerFetch("/legal-entities/me", {
    cache: "no-store",
  });
  if (!res.ok) {
    return { acting: null, memberships: [], impersonation: null };
  }
  const body = (await res.json()) as { data?: LegalEntitySummary[] };
  const memberships = body.data ?? [];
  if (memberships.length === 0) {
    return { acting: null, memberships: [], impersonation: null };
  }

  await seedPersonalActingLegalEntityCookieIfAbsent(memberships);

  const jar = await cookies();
  const cookieValue = jar.get(ACTING_LEGAL_ENTITY_COOKIE)?.value;
  const raw = cookieValue ? decodeURIComponent(cookieValue) : "";
  const decoded = raw ? decodeActingContextCookie(raw) : null;

  const role = normalizeUserRoleOrClient(userRole);
  const staff = normalizeUserStaffRole(userStaffRole ?? undefined);
  if (decoded?.i?.sid && canAccessPlatformAdminRoutes(role, staff)) {
    const resEntity = await authedServerFetch(`/legal-entities/${decoded.e}`, {
      cache: "no-store",
    });
    if (resEntity.ok) {
      const entityJson = (await resEntity.json()) as {
        data?: {
          id: string;
          displayName: string;
          kind: LegalEntitySummary["kind"];
          subkind: LegalEntitySummary["subkind"];
          status: LegalEntitySummary["status"];
          membership?: {
            role: LegalEntitySummary["role"];
            isPrimaryAdmin: boolean;
            isImpersonation?: boolean;
            impersonationExpiresAt?: string;
          };
        };
      };
      const d = entityJson.data;
      if (d?.membership?.isImpersonation) {
        const acting: LegalEntitySummary = {
          id: d.id,
          displayName: d.displayName,
          kind: d.kind,
          subkind: d.subkind,
          status: d.status,
          role: d.membership.role,
          isPrimaryAdmin: d.membership.isPrimaryAdmin,
          isImpersonation: true,
        };
        return {
          acting,
          memberships,
          impersonation: d.membership.impersonationExpiresAt
            ? {
                displayName: d.displayName,
                expiresAtIso: d.membership.impersonationExpiresAt,
                sessionId: decoded.i.sid,
              }
            : null,
        };
      }
    }
  }

  const matchedByCookie = decoded ? memberships.find((m) => m.id === decoded.e) : undefined;
  const firstMembership = memberships[0];
  if (!firstMembership) {
    return { acting: null, memberships: [], impersonation: null };
  }
  const fallback = memberships.find((m) => m.kind === "individual") ?? firstMembership;
  const acting = matchedByCookie ?? fallback;
  return { acting, memberships, impersonation: null };
}

/** Convenience for server-side data fetchers that need to forward acting
 * context to the API. Returns `{ "x-legal-entity-id": "<id>" }` when an
 * acting entity is resolved, otherwise an empty object.
 */
export async function getActingLegalEntityHeader(
  userRole?: string | null,
  userStaffRole?: string | null,
): Promise<Record<string, string>> {
  const { acting } = await resolveActingContext(userRole, userStaffRole);
  if (!acting) return {};
  return { [X_LEGAL_ENTITY_ID_HEADER]: acting.id };
}

/** When the acting cookie references an admin impersonation session,
 * {@link resolveActingContext} must know the caller is an `administrator`
 * so it can validate via `GET /legal-entities/:id`. Fetch the role only in
 * that case to avoid an extra `/users/me` on every SSR request. */
export async function getUserRoleIfImpersonationActingCookie(): Promise<string | null | undefined> {
  const jar = await cookies();
  const cookieValue = jar.get(ACTING_LEGAL_ENTITY_COOKIE)?.value;
  const raw = cookieValue ? decodeURIComponent(cookieValue) : "";
  const decoded = raw ? decodeActingContextCookie(raw) : null;
  if (!decoded?.i?.sid) return undefined;
  const user = await getServerSessionUser();
  return user?.role ?? null;
}
