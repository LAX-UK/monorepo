import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import {
  type LegalEntitySummary,
  type StaffRoles,
  canAccessPlatformAdminRoutes,
  decodeActingContextCookie,
  normalizeUserRoleOrClient,
} from "@auction/types";
import { cookies } from "next/headers";
import { ACTING_LEGAL_ENTITY_COOKIE, X_LEGAL_ENTITY_ID_HEADER } from "./client-acting-context";

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
  /** True when `/legal-entities/me` reported personal-entity bootstrap failure. */
  bootstrapFailed: boolean;
  /**
   * This browser has no usable account choice: no cookie yet (a new device) or one for an
   * account the person can no longer use. The client area then sends it through
   * `/restore-account`, which opens the remembered account or explains the fallback.
   */
  needsRestore: boolean;
};

/** Resolves the acting legal entity for the current request. Read-only: the cookie is written
 * only by the switch action and the `/switch-account` and `/restore-account` hops.
 * 1. Fetch `/legal-entities/me` (cookie-authenticated).
 * 2. For platform administrators, a structured cookie with an
 * impersonation block is validated via `GET /legal-entities/:id`.
 * 3. Otherwise pick the membership whose id matches the cookie; if no match,
 * fall back to the first membership where `kind = 'individual'`.
 */
export async function resolveActingContext(
  userRole?: string | null,
  userStaffRoles?: StaffRoles | undefined,
): Promise<ResolvedActingContext> {
  const res = await authedServerFetch("/legal-entities/me", {
    cache: "no-store",
  });
  if (!res.ok) {
    const bootstrapFailed = res.status === 503;
    return {
      acting: null,
      memberships: [],
      impersonation: null,
      bootstrapFailed,
      needsRestore: false,
    };
  }
  const body = (await res.json()) as {
    data?: LegalEntitySummary[];
    error?: string;
    code?: string;
  };
  const bootstrapFailed = body.code === "personal_entity_unavailable";
  const memberships = body.data ?? [];
  if (memberships.length === 0) {
    return {
      acting: null,
      memberships: [],
      impersonation: null,
      bootstrapFailed,
      needsRestore: false,
    };
  }

  const jar = await cookies();
  const cookieValue = jar.get(ACTING_LEGAL_ENTITY_COOKIE)?.value;
  const raw = cookieValue ? decodeURIComponent(cookieValue) : "";
  const decoded = raw ? decodeActingContextCookie(raw) : null;

  const role = normalizeUserRoleOrClient(userRole);
  const staff = userStaffRoles;
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
          bootstrapFailed: false,
          needsRestore: false,
        };
      }
    }
  }

  const matchedByCookie = decoded ? memberships.find((m) => m.id === decoded.e) : undefined;

  // Kill switch: a stale org cookie must not leak org acting into SSR fetch
  // headers or capability wiring — reset to the personal entity.
  const orgModuleEnabled = await resolveOrgModuleEnabledFromRequest();
  const orgGatedByKillSwitch = !orgModuleEnabled && matchedByCookie?.kind === "organisation";

  const usable = matchedByCookie !== undefined && !orgGatedByKillSwitch;

  const firstMembership = memberships[0];
  if (!firstMembership) {
    return {
      acting: null,
      memberships: [],
      impersonation: null,
      bootstrapFailed,
      needsRestore: false,
    };
  }
  const fallback = memberships.find((m) => m.kind === "individual") ?? firstMembership;
  const acting = (usable ? matchedByCookie : undefined) ?? fallback;
  return {
    acting,
    memberships,
    impersonation: null,
    bootstrapFailed: false,
    // A staff impersonation cookie is never "restored" over; the staff tools end it.
    needsRestore: !usable && !decoded?.i?.sid,
  };
}

/** Convenience for server-side data fetchers that need to forward acting
 * context to the API. Returns `{ "x-legal-entity-id": "<id>" }` when an
 * acting entity is resolved, otherwise an empty object.
 */
export async function getActingLegalEntityHeader(
  userRole?: string | null,
  userStaffRoles?: StaffRoles | undefined,
): Promise<Record<string, string>> {
  const { acting } = await resolveActingContext(userRole, userStaffRoles);
  if (!acting) return {};
  return { [X_LEGAL_ENTITY_ID_HEADER]: acting.id };
}

/**
 * Whether a platform admin has a "view as client" session open in this browser. Only the cookie
 * is read; the API validates the session on every request and refuses every write in it.
 */
export async function isViewingAsClient(
  userRole?: string | null,
  userStaffRoles?: StaffRoles | undefined,
): Promise<boolean> {
  const role = normalizeUserRoleOrClient(userRole);
  const staff = userStaffRoles;
  if (!canAccessPlatformAdminRoutes(role, staff)) return false;
  const jar = await cookies();
  const cookieValue = jar.get(ACTING_LEGAL_ENTITY_COOKIE)?.value;
  const raw = cookieValue ? decodeURIComponent(cookieValue) : "";
  return Boolean(raw && decodeActingContextCookie(raw)?.i?.sid);
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
