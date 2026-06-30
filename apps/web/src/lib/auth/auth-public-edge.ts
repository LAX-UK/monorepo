import { hasAuthSessionCookie } from "@/lib/auth/session-cookie";
import type { NextRequest } from "next/server";
import {
  isProtectedPostAuthPath,
  resolveAuthEdgeRedirectTarget,
  shouldBypassAuthEdgeRedirect,
} from "./auth-edge-policy";

export {
  buildStaleSessionRecoveryLoginUrl,
  isLoginRecoveryLanding,
  isProtectedPostAuthPath,
  isStaleAuthEdgePublicLanding,
  resolveAuthEdgeRedirectTarget,
  shouldBypassAuthEdgeRedirect,
} from "./auth-edge-policy";

/** When the browser lands on a protected route with `?from=auth-edge`, forward a header so SSR
 * can avoid redirect loops if the session cookie was stale.
 */
export function buildRequestWithAuthEdgeHeader(
  request: NextRequest,
): { request: { headers: Headers } } | null {
  const url = request.nextUrl;
  if (url.searchParams.get("from") !== "auth-edge") return null;
  if (!isProtectedPostAuthPath(url.pathname)) return null;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-lax-auth-edge", "1");
  return { request: { headers: requestHeaders } };
}

/** Fast-path redirect for marketing auth pages when a session cookie is present.
 * Skips `/forgot-password` so SSR can send staff/clients to the correct destination.
 *
 * See {@link shouldBypassAuthEdgeRedirect} for cases that must stay on /login.
 * See {@link resolveAuthEdgeRedirectTarget} for how public `next` paths are handled.
 */
export function getAuthPublicCookieRedirectUrl(requestUrl: URL, cookieHeader: string): URL | null {
  const pathname = requestUrl.pathname;
  if (pathname !== "/login" && pathname !== "/register") return null;
  if (shouldBypassAuthEdgeRedirect(pathname, requestUrl.searchParams)) return null;
  if (!hasAuthSessionCookie(cookieHeader)) return null;
  return resolveAuthEdgeRedirectTarget(requestUrl);
}
