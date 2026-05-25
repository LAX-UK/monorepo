import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import { hasAuthSessionCookie } from "@/lib/auth/session-cookie";
import type { NextRequest } from "next/server";

/** When the browser lands on a protected route with `?from=auth-edge`, forward a header so SSR
 * can avoid redirect loops if the session cookie was stale.
 */
export function buildRequestWithAuthEdgeHeader(
  request: NextRequest,
): { request: { headers: Headers } } | null {
  const url = request.nextUrl;
  const p = url.pathname;
  const isDash = p === "/dashboard" || p.startsWith("/dashboard/");
  const isAdmin = p === "/admin" || p.startsWith("/admin/");
  if (!(isDash || isAdmin)) return null;
  if (url.searchParams.get("from") !== "auth-edge") return null;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-lax-auth-edge", "1");
  return { request: { headers: requestHeaders } };
}

/** Fast-path redirect for marketing auth pages when a session cookie is present.
 * Skips `/forgot-password` so SSR can send staff/clients to the correct destination.
 *
 * Bypass cases (do not bounce away from /login):
 * - `?switch=1`           — user explicitly wants to use a different account
 * - `?session_expired=1`  — SSR detected a stale cookie + asked us to stay on /login
 * - `?auth=required`      — user was sent here because a protected page required auth
 * - `?registered=1`       — just-completed sign-up landing
 * - `?reset=1`            — just-completed password reset landing
 *
 * Otherwise the stale Better Auth cookie would cause a /login → /dashboard?from=auth-edge
 * → /login?session_expired=1 loop until the user manually clears cookies.
 */
export function getAuthPublicCookieRedirectUrl(requestUrl: URL, cookieHeader: string): URL | null {
  const pathname = requestUrl.pathname;
  if (pathname !== "/login" && pathname !== "/register") return null;
  const sp = requestUrl.searchParams;
  if (sp.get("switch") === "1") return null;
  if (sp.get("session_expired") === "1") return null;
  if (sp.get("auth") === "required") return null;
  if (sp.get("registered") === "1") return null;
  if (sp.get("reset") === "1") return null;
  if (pathname === "/register" && sp.has("invite")) return null;
  if (!hasAuthSessionCookie(cookieHeader)) return null;

  const next = sp.get("next");
  const targetPath = next != null && isSafeNextPath(next) ? next : "/dashboard";
  const dest = new URL(targetPath, requestUrl);
  dest.searchParams.set("from", "auth-edge");
  dest.searchParams.set("welcome", "back");
  return dest;
}
