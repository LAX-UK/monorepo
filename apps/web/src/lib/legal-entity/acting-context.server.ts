import "server-only";

import { createHash } from "node:crypto";
import { readBidSessionIdFromStore } from "@/lib/bff/session-cookie.server";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import {
  type StaffRoles,
  canAccessPlatformAdminRoutes,
  decodeActingContextCookie,
  normalizeUserRoleOrClient,
} from "@auction/types";
import { cookies } from "next/headers";
import { cache } from "react";
import type { AccountDirectory, AccountsLookup } from "./account-directory";
import { AccountsCache } from "./accounts-cache";
import { AccountsUnavailableError } from "./accounts-unavailable-error";
import {
  type ActingContextLookup,
  type BrowserAccountChoice,
  type ResolvedActingContext,
  type ResolvedActingImpersonation,
  resolveActingContextWith,
} from "./acting-context-resolver";
import { ACTING_LEGAL_ENTITY_COOKIE, X_LEGAL_ENTITY_ID_HEADER } from "./client-acting-context";
import { HttpAccountDirectory } from "./http-account-directory";

export type {
  ActingContextLookup,
  ResolvedActingContext,
  ResolvedActingImpersonation,
} from "./acting-context-resolver";

/**
 * Short, private, per-session memory of each person's accounts in this server process. Ten
 * seconds absorbs the bursts of ordinary browsing (a page, its prefetches, a quick next page);
 * memberships that change are re-read at once (see `AccountsCache.get`).
 */
const ACCOUNTS_CACHE_TTL_MS = 10_000;
const ACCOUNTS_CACHE_MAX_SESSIONS = 5_000;
const sharedAccountsCache = new AccountsCache({
  ttlMs: ACCOUNTS_CACHE_TTL_MS,
  maxEntries: ACCOUNTS_CACHE_MAX_SESSIONS,
});

/** A key for the signed-in session that never holds the session id itself. */
async function sessionCacheKey(): Promise<string | null> {
  const sessionId = readBidSessionIdFromStore(await cookies());
  return sessionId ? createHash("sha256").update(sessionId).digest("base64url") : null;
}

/** The signed-in person's account directory: the Bid API, cached per session. */
export async function createAccountDirectory(): Promise<AccountDirectory> {
  return new HttpAccountDirectory({
    fetcher: authedServerFetch,
    cache: sharedAccountsCache,
    sessionKey: await sessionCacheKey(),
  });
}

/** Forgets the cached accounts of this session after its memberships changed. */
export async function forgetMyCachedAccounts(): Promise<void> {
  const key = await sessionCacheKey();
  if (key) sharedAccountsCache.forget(key);
}

/** The signed-in person's accounts, or why they could not be read. */
export async function listMyAccounts(options?: {
  mustInclude?: string | null;
}): Promise<AccountsLookup> {
  return (await createAccountDirectory()).listMine(options);
}

/** What this browser's acting cookie says; `null` when it has none it can read. */
async function readBrowserChoice(): Promise<BrowserAccountChoice | null> {
  const raw = (await cookies()).get(ACTING_LEGAL_ENTITY_COOKIE)?.value;
  const decoded = raw ? decodeActingContextCookie(decodeURIComponent(raw)) : null;
  return decoded ? { accountId: decoded.e, viewSessionId: decoded.i?.sid ?? null } : null;
}

/**
 * One resolution per request: the layout, the page and every API call's account header read the
 * same answer, so they can never disagree about whose account a response shows.
 */
const lookupActingContextOnce = cache(
  async (canViewAsClient: boolean): Promise<ActingContextLookup> =>
    resolveActingContextWith({
      directory: await createAccountDirectory(),
      browserChoice: await readBrowserChoice(),
      orgModuleEnabled: resolveOrgModuleEnabledFromRequest,
      canViewAsClient,
    }),
);

function viewerCanViewAsClient(userRole?: string | null, userStaffRoles?: StaffRoles): boolean {
  return canAccessPlatformAdminRoutes(normalizeUserRoleOrClient(userRole), userStaffRoles);
}

/**
 * The account this request acts as, or why the person's accounts could not be read. Read-only:
 * the cookie is written only by the switch action and the `/switch-account` and
 * `/restore-account` hops. Use this where the failure is shown (the client layout, the hops).
 */
export async function lookupActingContext(
  userRole?: string | null,
  userStaffRoles?: StaffRoles,
): Promise<ActingContextLookup> {
  return lookupActingContextOnce(viewerCanViewAsClient(userRole, userStaffRoles));
}

/**
 * The account this request acts as. Throws {@link AccountsUnavailableError} when the accounts
 * could not be read; the client layout has already shown the retry state for the same request,
 * so pages use this and never decide anything from a missing account.
 */
export async function resolveActingContext(
  userRole?: string | null,
  userStaffRoles?: StaffRoles,
): Promise<ResolvedActingContext> {
  const lookup = await lookupActingContext(userRole, userStaffRoles);
  if (!lookup.ok) throw new AccountsUnavailableError(lookup.reason);
  return lookup.context;
}

/**
 * A staff member's live "view as client" session, for the admin area's banner and titles. The
 * admin area does not depend on client accounts, so an outage reading them shows no session
 * rather than failing the page; the API still refuses every write in one.
 */
export async function findViewAsClientSession(
  userRole?: string | null,
  userStaffRoles?: StaffRoles,
): Promise<ResolvedActingImpersonation | null> {
  const lookup = await lookupActingContext(userRole, userStaffRoles);
  return lookup.ok ? lookup.context.impersonation : null;
}

/**
 * The `X-Legal-Entity-Id` header for server-side API calls. While the accounts cannot be read,
 * the browser's own choice is sent as it is: the API checks membership on every request, and
 * acting for nobody would silently turn an organisation's page into the personal account's.
 */
export async function getActingLegalEntityHeader(
  userRole?: string | null,
  userStaffRoles?: StaffRoles,
): Promise<Record<string, string>> {
  const lookup = await lookupActingContext(userRole, userStaffRoles);
  const accountId = lookup.ok
    ? lookup.context.acting.id
    : ((await readBrowserChoice())?.accountId ?? null);
  return accountId ? { [X_LEGAL_ENTITY_ID_HEADER]: accountId } : {};
}

/**
 * Whether a platform admin has a "view as client" session open in this browser. Only the cookie
 * is read; the API validates the session on every request and refuses every write in it.
 */
export async function isViewingAsClient(
  userRole?: string | null,
  userStaffRoles?: StaffRoles | undefined,
): Promise<boolean> {
  if (!viewerCanViewAsClient(userRole, userStaffRoles)) return false;
  return Boolean((await readBrowserChoice())?.viewSessionId);
}

/** When the acting cookie references an admin impersonation session,
 * {@link resolveActingContext} must know the caller is an `administrator`
 * so it can validate via `GET /legal-entities/:id`. Fetch the role only in
 * that case to avoid an extra `/users/me` on every SSR request. */
export async function getUserRoleIfImpersonationActingCookie(): Promise<string | null | undefined> {
  if (!(await readBrowserChoice())?.viewSessionId) return undefined;
  const user = await getServerSessionUser();
  return user?.role ?? null;
}
