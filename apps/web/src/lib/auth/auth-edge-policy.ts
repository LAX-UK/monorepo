import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import { hasAuthSessionCookie } from "@/lib/auth/session-cookie";

const AUTH_EDGE_CALLBACK_PATH = "/auth/social-callback";

/** Query flags that must keep the user on /login or /register (recovery / explicit intent). */
const LOGIN_EDGE_BYPASS: ReadonlyArray<[param: string, value: string]> = [
  ["switch", "1"],
  ["session_expired", "1"],
  ["auth", "required"],
  ["social_error", "1"],
  ["registered", "1"],
  ["reset", "1"],
  ["verify_pending", "1"],
];

/** Shell routes whose SSR guards can detect stale cookies and recover safely. */
export function isProtectedPostAuthPath(path: string): boolean {
  const pathOnly = path.split("?")[0] ?? path;
  return (
    pathOnly === "/dashboard" ||
    pathOnly.startsWith("/dashboard/") ||
    pathOnly === "/admin" ||
    pathOnly.startsWith("/admin/")
  );
}

export function shouldBypassAuthEdgeRedirect(pathname: string, searchParams: URLSearchParams): boolean {
  for (const [param, value] of LOGIN_EDGE_BYPASS) {
    if (searchParams.get(param) === value) return true;
  }
  return pathname === "/register" && searchParams.has("invite");
}

/** `/login` landings where stale auth cookies should be cleared in middleware. */
export function isLoginRecoveryLanding(url: URL): boolean {
  if (url.pathname !== "/login") return false;
  return (
    url.searchParams.get("session_expired") === "1" ||
    url.searchParams.get("auth") === "required" ||
    url.searchParams.get("social_error") === "1"
  );
}

/**
 * Marketing/public URL after a stale edge redirect. Only recover when a session cookie
 * is still present — otherwise the user can stay on the page (e.g. old bookmark).
 */
export function isStaleAuthEdgePublicLanding(url: URL, cookieHeader: string): boolean {
  if (!hasAuthSessionCookie(cookieHeader)) return false;
  if (url.searchParams.get("from") !== "auth-edge") return false;
  if (url.pathname === AUTH_EDGE_CALLBACK_PATH) return false;
  return !isProtectedPostAuthPath(url.pathname);
}

/** Build `/login?session_expired=1` preserving a safe return path (without edge markers). */
export function buildStaleSessionRecoveryLoginUrl(fromUrl: URL): URL {
  const params = new URLSearchParams({ session_expired: "1" });
  const returnParams = new URLSearchParams(fromUrl.search);
  returnParams.delete("from");
  returnParams.delete("welcome");
  const qs = returnParams.toString();
  const returnPath = qs ? `${fromUrl.pathname}?${qs}` : fromUrl.pathname;
  if (isSafeNextPath(returnPath)) {
    params.set("next", returnPath);
  }
  return new URL(`/login?${params.toString()}`, fromUrl);
}

/**
 * Resolve the edge fast-path target for /login or /register when a session cookie exists.
 * Public marketing `next` values route through {@link AUTH_EDGE_CALLBACK_PATH} so SSR can
 * validate the session instead of stranding the user on an unguarded page.
 */
export function resolveAuthEdgeRedirectTarget(requestUrl: URL): URL {
  const next = requestUrl.searchParams.get("next");
  const safeNext = next != null && isSafeNextPath(next) ? next : null;
  const directTarget =
    safeNext != null && isProtectedPostAuthPath(safeNext) ? safeNext : AUTH_EDGE_CALLBACK_PATH;
  const dest = new URL(directTarget, requestUrl);
  if (directTarget === AUTH_EDGE_CALLBACK_PATH && safeNext != null) {
    dest.searchParams.set("next", safeNext);
  }
  if (directTarget !== AUTH_EDGE_CALLBACK_PATH) {
    dest.searchParams.set("from", "auth-edge");
    dest.searchParams.set("welcome", "back");
  }
  return dest;
}
