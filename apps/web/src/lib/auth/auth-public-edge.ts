import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import type { NextRequest } from "next/server";

const sessionCookiePattern = /better-auth|session_token/i;

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
 */
export function getAuthPublicCookieRedirectUrl(requestUrl: URL, cookieHeader: string): URL | null {
  const pathname = requestUrl.pathname;
  if (pathname !== "/login" && pathname !== "/register") return null;
  if (requestUrl.searchParams.get("switch") === "1") return null;
  if (pathname === "/register" && requestUrl.searchParams.has("invite")) return null;
  if (!sessionCookiePattern.test(cookieHeader)) return null;

  const next = requestUrl.searchParams.get("next");
  const targetPath = next != null && isSafeNextPath(next) ? next : "/dashboard";
  const dest = new URL(targetPath, requestUrl);
  dest.searchParams.set("from", "auth-edge");
  dest.searchParams.set("welcome", "back");
  return dest;
}
